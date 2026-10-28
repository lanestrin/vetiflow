using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using vetiflow.Server.Contracts.Cases;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Hubs;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// New patient intake (build plan 4.1a): adds an arriving pet to the triage
// queue. The case starts in Incoming with a provisional priority until a
// clinician completes triage (4.2). Never log the request: it holds the owner's
// phone and clinical notes.
[ApiController]
[Route("api/cases/intake")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class CaseIntakeController : ControllerBase
{
	private const string ActiveCaseIndex = "IX_EmergencyCases_PatientId_Active";

	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public CaseIntakeController(VetiFlowDbContext dbContext, IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpPost]
	public async Task<ActionResult<CaseIntakeResultDto>> CreateIntake(
		CaseIntakeRequest request,
		CancellationToken cancellationToken)
	{
		var now = DateTimeOffset.UtcNow;
		DateOnly? dateOfBirth = null;

		if (request.Age is not null)
		{
			if (IntakeAge.TryEstimateDateOfBirth(request.Age, DateOnly.FromDateTime(now.UtcDateTime), out var estimate))
			{
				dateOfBirth = estimate;
			}
			else
			{
				ModelState.AddModelError(nameof(CaseIntakeRequest.Age), IntakeAge.ErrorMessage);
				return ValidationProblem();
			}
		}

		Patient? patient;

		if (request.PatientId is { } patientId)
		{
			patient = await _dbContext.Patients.FirstOrDefaultAsync(patient => patient.Id == patientId, cancellationToken);

			if (patient is null)
			{
				return NotFound();
			}

			var activeCase = await FindActiveCaseAsync(patient.Id, cancellationToken);

			if (activeCase is not null)
			{
				return ActiveCaseConflict(activeCase.Value.Id, activeCase.Value.Number);
			}
		}
		else
		{
			patient = new Patient
			{
				Name = request.PetName!,
				Species = request.Species!,
				Breed = request.Breed,
				DateOfBirth = dateOfBirth,
				DateOfBirthIsEstimated = dateOfBirth is not null,
				Owner = await FindOrCreateOwnerAsync(request, cancellationToken)
			};
		}

		patient.Allergies = request.Allergies ?? patient.Allergies;
		patient.CurrentMedications = request.Medications ?? patient.CurrentMedications;

		var staffMemberId = await SignedInStaffMemberIdAsync(cancellationToken);
		var emergencyCase = new EmergencyCase
		{
			Patient = patient,
			PresentingComplaint = request.ChiefComplaint!,
			Stage = CaseStage.Incoming,
			Status = CaseStatus.Unassigned,
			ArrivalTime = now,
			StageEnteredAt = now,
			LastUpdated = now,
			AllergiesAtIntake = request.Allergies,
			MedicationsAtIntake = request.Medications,
			TreatmentAuthorization = request.TreatmentAuthorization ?? TreatmentAuthorization.NotDiscussed,
			ReferringClinic = request.ReferringClinic
		};
		emergencyCase.RecordTriage(new TriageAssessment
		{
			Acuity = request.Priority!.Value,
			RawIntakeNotes = request.TriageNotes,
			AssessedAt = now,
			AssessedByStaffId = staffMemberId
		});
		emergencyCase.Events.Add(new CaseEvent
		{
			Type = CaseEventType.Arrived,
			Description = "Intake received · priority provisional",
			CreatedAt = now,
			CreatedByStaffId = staffMemberId
		});
		// RecordTriage touches LastUpdated; keep every intake time the same.
		emergencyCase.LastUpdated = now;

		_dbContext.EmergencyCases.Add(emergencyCase);

		try
		{
			await _dbContext.SaveChangesAsync(cancellationToken);
		}
		catch (DbUpdateException exception)
			when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: ActiveCaseIndex })
		{
			// Another intake for the same patient won the race.
			var activeCase = await FindActiveCaseAsync(patient.Id, cancellationToken);
			return ActiveCaseConflict(activeCase?.Id, activeCase?.Number);
		}

		await _caseHub.Clients.All.SendAsync("caseUpdated", emergencyCase.Id, cancellationToken);

		return CreatedAtAction(
			nameof(CasesController.GetCase),
			"Cases",
			new { id = emergencyCase.Id },
			new CaseIntakeResultDto
			{
				Id = emergencyCase.Id,
				CaseNumber = $"ER-{emergencyCase.CaseNumber}",
				PatientId = patient.Id
			});
	}

	// Decided 2026-10-28: a phone whose digits match an existing owner's reuses
	// that owner and keeps their stored details.
	private async Task<Owner> FindOrCreateOwnerAsync(CaseIntakeRequest request, CancellationToken cancellationToken)
	{
		var digits = request.PhoneDigits;
		var returningOwner = await _dbContext.Owners
				// Phones hold only digits and these separators (SaveOwnerRequest and
				// intake check), so removing them leaves the digits. Npgsql turns
				// Regex.Replace into a first-match-only regexp_replace.
				.Where(owner => owner.Phone != null
					&& owner.Phone.Replace(" ", "").Replace("(", "").Replace(")", "").Replace("+", "").Replace(".", "").Replace("-", "") == digits)
				.OrderBy(owner => owner.LastName)
				.FirstOrDefaultAsync(cancellationToken);

		if (returningOwner is not null)
		{
			return returningOwner;
		}

		var (firstName, lastName) = request.SplitOwnerName();
		return new Owner { FirstName = firstName, LastName = lastName, Phone = request.OwnerPhone };
	}

	private async Task<(Guid Id, int Number)?> FindActiveCaseAsync(Guid patientId, CancellationToken cancellationToken)
	{
		var activeCase = await _dbContext.EmergencyCases
				.AsNoTracking()
				.Where(emergencyCase => emergencyCase.PatientId == patientId && emergencyCase.DischargedAt == null)
				.Select(emergencyCase => new { emergencyCase.Id, emergencyCase.CaseNumber })
				.FirstOrDefaultAsync(cancellationToken);

		return activeCase is null ? null : (activeCase.Id, activeCase.CaseNumber);
	}

	private ObjectResult ActiveCaseConflict(Guid? caseId, int? caseNumber)
	{
		var result = Problem(
				statusCode: StatusCodes.Status409Conflict,
				title: "This patient already has an active case");
		var problem = (ProblemDetails)result.Value!;
		problem.Extensions["activeCaseId"] = caseId;
		problem.Extensions["activeCaseNumber"] = caseNumber is null ? null : $"ER-{caseNumber}";
		return result;
	}

	// The team member's staff record, from the signed-in account.
	private async Task<Guid?> SignedInStaffMemberIdAsync(CancellationToken cancellationToken)
	{
		var accountId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

		return await _dbContext.Accounts
				.Where(account => account.Id == accountId)
				.Select(account => account.StaffMemberId)
				.FirstOrDefaultAsync(cancellationToken);
	}
}
