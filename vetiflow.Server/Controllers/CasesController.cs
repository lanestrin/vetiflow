using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Cases;
using vetiflow.Server.Contracts.Owners;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Hubs;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// The ER board is for hospital team members only: signed out gets 401, a pet
// parent 403 (owners never see the staff board).
[ApiController]
[Route("api/cases")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class CasesController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public CasesController(
			VetiFlowDbContext dbContext,
			IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpGet]
	public async Task<ActionResult<List<EmergencyCaseListItemDto>>> GetCases()
	{
		// Active cases only. Untriaged first (risk unknown, next step is triage),
		// then by acuity, then the longest wait. Acuity is stored as text, so it
		// is ranked here; sorting the column would be alphabetical.
		var cases = await _dbContext.EmergencyCases
				.AsNoTracking()
				.Where(emergencyCase => emergencyCase.DischargedAt == null)
				.OrderBy(emergencyCase =>
					emergencyCase.Acuity == null ? 0
					: emergencyCase.Acuity == AcuityLevel.Critical ? 1
					: emergencyCase.Acuity == AcuityLevel.Urgent ? 2
					: 3)
				.ThenBy(emergencyCase => emergencyCase.ArrivalTime)
				.Select(emergencyCase => new EmergencyCaseListItemDto
				{
					Id = emergencyCase.Id,
					CaseNumber = "ER-" + emergencyCase.CaseNumber,
					PatientId = emergencyCase.PatientId,
					PatientName = emergencyCase.Patient.Name,
					Species = emergencyCase.Patient.Species,
					Breed = emergencyCase.Patient.Breed,
					PatientDateOfBirth = emergencyCase.Patient.DateOfBirth,
					OwnerName = emergencyCase.Patient.Owner == null
						? null
						: emergencyCase.Patient.Owner.FirstName + " " + emergencyCase.Patient.Owner.LastName,
					WeightKg = emergencyCase.WeightKg,
					PresentingComplaint = emergencyCase.PresentingComplaint,
					Stage = emergencyCase.Stage,
					StageEnteredAt = emergencyCase.StageEnteredAt,
					Status = emergencyCase.Status,
					Acuity = emergencyCase.Acuity,
					ArrivalTime = emergencyCase.ArrivalTime,
					NextAction = emergencyCase.NextAction,
					AssignedDoctor = emergencyCase.AssignedDoctor == null
						? null
						: new CaseReferenceDto
						{
							Id = emergencyCase.AssignedDoctor.Id,
							Name = emergencyCase.AssignedDoctor.FirstName + " " + emergencyCase.AssignedDoctor.LastName
						},
					AssignedTechnician = emergencyCase.AssignedTechnician == null
						? null
						: new CaseReferenceDto
						{
							Id = emergencyCase.AssignedTechnician.Id,
							Name = emergencyCase.AssignedTechnician.FirstName + " " + emergencyCase.AssignedTechnician.LastName
						},
					Room = emergencyCase.Room == null
						? null
						: new CaseRoomDto
						{
							Id = emergencyCase.Room.Id,
							Name = emergencyCase.Room.Name,
							Type = emergencyCase.Room.Type
						},
					Clinician = emergencyCase.AssignedDoctor != null
						? new CaseClinicianDto
						{
							Id = emergencyCase.AssignedDoctor.Id,
							ShortName = emergencyCase.AssignedDoctor.LastName,
							Initials = emergencyCase.AssignedDoctor.FirstName.Substring(0, 1).ToUpper()
								+ emergencyCase.AssignedDoctor.LastName.Substring(0, 1).ToUpper()
						}
						: emergencyCase.AssignedTechnician != null
							? new CaseClinicianDto
							{
								Id = emergencyCase.AssignedTechnician.Id,
								ShortName = emergencyCase.AssignedTechnician.LastName,
								Initials = emergencyCase.AssignedTechnician.FirstName.Substring(0, 1).ToUpper()
									+ emergencyCase.AssignedTechnician.LastName.Substring(0, 1).ToUpper()
							}
							: null,
					Blockers = emergencyCase.Tasks
						.Where(task => task.Type == CaseTaskType.Blocker && task.Status == CaseTaskStatus.Open)
						.OrderBy(task => task.CreatedAt)
						.Select(task => new CaseBlockerDto
						{
							Id = task.Id,
							Description = task.Description
						})
						.ToList(),
					NextReassessment = emergencyCase.Tasks.AsQueryable()
						.Where(task => task.Type == CaseTaskType.Reassessment && task.Status == CaseTaskStatus.Open)
						.OrderBy(task => task.DueAt)
						.Select(CaseDueItemDto.FromTask)
						.FirstOrDefault(),
					NextClientUpdate = emergencyCase.Tasks.AsQueryable()
						.Where(task => task.Type == CaseTaskType.ClientUpdate && task.Status == CaseTaskStatus.Open)
						.OrderBy(task => task.DueAt)
						.Select(CaseDueItemDto.FromTask)
						.FirstOrDefault(),
					LatestPainScore = emergencyCase.PainScores
						.OrderByDescending(painScore => painScore.RecordedAt)
						.Select(painScore => new PainScoreSummaryDto
						{
							Score = painScore.Score,
							OccurredAt = painScore.OccurredAt,
							RecordedAt = painScore.RecordedAt
						})
						.FirstOrDefault(),
					LastUpdated = emergencyCase.LastUpdated
				})
				.ToListAsync();

		// A plain rule, applied after the query rather than translated to SQL.
		foreach (var item in cases)
		{
			item.WaitChip = WaitChipRule.For(item.Acuity, item.Status, item.Stage);
		}

		return Ok(cases);
	}

	// One case with everything the detail drawer shows (build plan 3.1).
	// Discharged cases are returned too, so a case can be looked up after it
	// leaves the board. Each collection is its own query (split), so one case
	// with many vitals, tasks and events doesn't multiply rows.
	[HttpGet("{id:guid}")]
	public async Task<ActionResult<CaseDetailDto>> GetCase(Guid id, CancellationToken cancellationToken)
	{
		var detail = await _dbContext.EmergencyCases
				.AsNoTracking()
				.AsSplitQuery()
				.Where(emergencyCase => emergencyCase.Id == id)
				.Select(emergencyCase => new CaseDetailDto
				{
					Id = emergencyCase.Id,
					CaseNumber = "ER-" + emergencyCase.CaseNumber,
					Patient = new CasePatientDto
					{
						Id = emergencyCase.Patient.Id,
						Name = emergencyCase.Patient.Name,
						Species = emergencyCase.Patient.Species,
						Breed = emergencyCase.Patient.Breed,
						Sex = emergencyCase.Patient.Sex,
						DateOfBirth = emergencyCase.Patient.DateOfBirth,
						DateOfBirthIsEstimated = emergencyCase.Patient.DateOfBirthIsEstimated,
						Allergies = emergencyCase.Patient.Allergies,
						CurrentMedications = emergencyCase.Patient.CurrentMedications
					},
					Owner = emergencyCase.Patient.Owner == null
						? null
						: new OwnerDto
						{
							Id = emergencyCase.Patient.Owner.Id,
							FirstName = emergencyCase.Patient.Owner.FirstName,
							LastName = emergencyCase.Patient.Owner.LastName,
							Phone = emergencyCase.Patient.Owner.Phone,
							Email = emergencyCase.Patient.Owner.Email
						},
					PresentingComplaint = emergencyCase.PresentingComplaint,
					WeightKg = emergencyCase.WeightKg,
					Stage = emergencyCase.Stage,
					StageEnteredAt = emergencyCase.StageEnteredAt,
					Status = emergencyCase.Status,
					Acuity = emergencyCase.Acuity,
					ArrivalTime = emergencyCase.ArrivalTime,
					LastUpdated = emergencyCase.LastUpdated,
					DischargedAt = emergencyCase.DischargedAt,
					NextAction = emergencyCase.NextAction,
					AssignedDoctor = emergencyCase.AssignedDoctor == null
						? null
						: new CaseReferenceDto
						{
							Id = emergencyCase.AssignedDoctor.Id,
							Name = emergencyCase.AssignedDoctor.FirstName + " " + emergencyCase.AssignedDoctor.LastName
						},
					AssignedTechnician = emergencyCase.AssignedTechnician == null
						? null
						: new CaseReferenceDto
						{
							Id = emergencyCase.AssignedTechnician.Id,
							Name = emergencyCase.AssignedTechnician.FirstName + " " + emergencyCase.AssignedTechnician.LastName
						},
					Room = emergencyCase.Room == null
						? null
						: new CaseRoomDto
						{
							Id = emergencyCase.Room.Id,
							Name = emergencyCase.Room.Name,
							Type = emergencyCase.Room.Type
						},
					AllergiesAtIntake = emergencyCase.AllergiesAtIntake,
					MedicationsAtIntake = emergencyCase.MedicationsAtIntake,
					TreatmentAuthorization = emergencyCase.TreatmentAuthorization,
					ReferringClinic = emergencyCase.ReferringClinic,
					OwnerUpdateStatus = emergencyCase.OwnerUpdateStatus,
					LastOwnerUpdateAt = emergencyCase.LastOwnerUpdateAt,
					Tags = emergencyCase.Tags
						.OrderBy(tag => tag.CreatedAt)
						.Select(tag => new CaseTagDto
						{
							Id = tag.Id,
							Text = tag.Text,
							Tone = tag.Tone,
							CreatedAt = tag.CreatedAt,
							CreatedBy = tag.CreatedByStaff == null
								? null
								: new CaseReferenceDto
								{
									Id = tag.CreatedByStaff.Id,
									Name = tag.CreatedByStaff.FirstName + " " + tag.CreatedByStaff.LastName
								}
						})
						.ToList(),
					TriageAssessments = emergencyCase.TriageAssessments
						.OrderByDescending(triage => triage.AssessedAt)
						.Select(triage => new TriageAssessmentDto
						{
							Id = triage.Id,
							Acuity = triage.Acuity,
							RawIntakeNotes = triage.RawIntakeNotes,
							OccurredAt = triage.OccurredAt,
							AssessedAt = triage.AssessedAt,
							AssessedBy = triage.AssessedByStaff == null
								? null
								: new CaseReferenceDto
								{
									Id = triage.AssessedByStaff.Id,
									Name = triage.AssessedByStaff.FirstName + " " + triage.AssessedByStaff.LastName
								}
						})
						.ToList(),
					Vitals = emergencyCase.VitalsRecords
						.OrderByDescending(vitals => vitals.RecordedAt)
						.Select(vitals => new VitalsRecordDto
						{
							Id = vitals.Id,
							HeartRate = vitals.HeartRate,
							RespiratoryRate = vitals.RespiratoryRate,
							TemperatureF = vitals.TemperatureF,
							SpO2 = vitals.SpO2,
							MucousMembraneColor = vitals.MucousMembraneColor,
							CapillaryRefillTime = vitals.CapillaryRefillTime,
							Mentation = vitals.Mentation,
							OccurredAt = vitals.OccurredAt,
							RecordedAt = vitals.RecordedAt,
							RecordedBy = vitals.RecordedByStaff == null
								? null
								: new CaseReferenceDto
								{
									Id = vitals.RecordedByStaff.Id,
									Name = vitals.RecordedByStaff.FirstName + " " + vitals.RecordedByStaff.LastName
								}
						})
						.ToList(),
					LatestPainScore = emergencyCase.PainScores
						.OrderByDescending(painScore => painScore.RecordedAt)
						.Select(painScore => new PainScoreDto
						{
							Id = painScore.Id,
							Score = painScore.Score,
							Notes = painScore.Notes,
							OccurredAt = painScore.OccurredAt,
							RecordedAt = painScore.RecordedAt,
							RecordedBy = painScore.RecordedByStaff == null
								? null
								: new CaseReferenceDto
								{
									Id = painScore.RecordedByStaff.Id,
									Name = painScore.RecordedByStaff.FirstName + " " + painScore.RecordedByStaff.LastName
								}
						})
						.FirstOrDefault(),
					Tasks = emergencyCase.Tasks
						.OrderBy(task => task.Status == CaseTaskStatus.Open ? 0 : 1)
						.ThenBy(task => task.CreatedAt)
						.Select(task => new CaseTaskDto
						{
							Id = task.Id,
							Type = task.Type,
							Description = task.Description,
							Status = task.Status,
							DueAt = task.DueAt,
							AssignedTo = task.AssignedToStaff == null
								? null
								: new CaseReferenceDto
								{
									Id = task.AssignedToStaff.Id,
									Name = task.AssignedToStaff.FirstName + " " + task.AssignedToStaff.LastName
								},
							CreatedAt = task.CreatedAt,
							CreatedBy = task.CreatedByStaff == null
								? null
								: new CaseReferenceDto
								{
									Id = task.CreatedByStaff.Id,
									Name = task.CreatedByStaff.FirstName + " " + task.CreatedByStaff.LastName
								},
							ResolvedAt = task.ResolvedAt,
							ResolvedBy = task.ResolvedByStaff == null
								? null
								: new CaseReferenceDto
								{
									Id = task.ResolvedByStaff.Id,
									Name = task.ResolvedByStaff.FirstName + " " + task.ResolvedByStaff.LastName
								}
						})
						.ToList(),
					NextReassessment = emergencyCase.Tasks.AsQueryable()
						.Where(task => task.Type == CaseTaskType.Reassessment && task.Status == CaseTaskStatus.Open)
						.OrderBy(task => task.DueAt)
						.Select(CaseDueItemDto.FromTask)
						.FirstOrDefault(),
					NextClientUpdate = emergencyCase.Tasks.AsQueryable()
						.Where(task => task.Type == CaseTaskType.ClientUpdate && task.Status == CaseTaskStatus.Open)
						.OrderBy(task => task.DueAt)
						.Select(CaseDueItemDto.FromTask)
						.FirstOrDefault(),
					Timeline = emergencyCase.Events
						.OrderBy(caseEvent => caseEvent.CreatedAt)
						.Select(caseEvent => new CaseEventDto
						{
							Id = caseEvent.Id,
							Type = caseEvent.Type,
							Description = caseEvent.Description,
							CreatedAt = caseEvent.CreatedAt,
							CreatedBy = caseEvent.CreatedByStaff == null
								? null
								: new CaseReferenceDto
								{
									Id = caseEvent.CreatedByStaff.Id,
									Name = caseEvent.CreatedByStaff.FirstName + " " + caseEvent.CreatedByStaff.LastName
								}
						})
						.ToList()
				})
				.SingleOrDefaultAsync(cancellationToken);

		if (detail is null)
		{
			return NotFound();
		}

		foreach (var vitals in detail.Vitals)
		{
			vitals.FlagOutOfRange(detail.Patient.Species);
		}

		return detail;
	}

	[HttpPatch("{id:guid}/status")]
	public async Task<IActionResult> UpdateStatus(
		Guid id,
		UpdateCaseStatusRequest request,
		CancellationToken cancellationToken)
	{
		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id);

		if (emergencyCase is null)
		{
			return NotFound();
		}

		var refusal = emergencyCase.RefuseStageAndStatus(request.Stage, request.Status);
		if (refusal is not null)
		{
			return Problem(
					statusCode: StatusCodes.Status409Conflict,
					title: refusal);
		}

		var now = DateTimeOffset.UtcNow;
		var staffMemberId = await SignedInStaffMemberIdAsync(cancellationToken);
		var previousStage = emergencyCase.Stage;
		var previousStatus = emergencyCase.Status;

		emergencyCase.MoveToStage(request.Stage);
		emergencyCase.Status = request.Status;
		emergencyCase.NextAction = request.NextAction;
		emergencyCase.LastUpdated = now;

		if (previousStage != request.Stage)
		{
			AddEvent(emergencyCase, CaseEventType.StageChanged, $"Stage changed: {previousStage} to {request.Stage}", now, staffMemberId);
		}

		if (previousStatus != request.Status)
		{
			AddEvent(emergencyCase, CaseEventType.StatusChanged, $"Status changed: {previousStatus} to {request.Status}", now, staffMemberId);
		}

		await _dbContext.SaveChangesAsync();

		await _caseHub.Clients.All.SendAsync(
				"caseUpdated",
				emergencyCase.Id);

		return NoContent();
	}

	private void AddEvent(
		EmergencyCase emergencyCase,
		CaseEventType type,
		string description,
		DateTimeOffset now,
		Guid? staffMemberId)
	{
		var caseEvent = new CaseEvent
		{
			Type = type,
			Description = description,
			CreatedAt = now,
			CreatedByStaffId = staffMemberId
		};
		emergencyCase.Events.Add(caseEvent);

		// The new row already carries its Guid id, so on a tracked case EF would
		// take it for an existing row and insert nothing. Mark it as new.
		_dbContext.CaseEvents.Add(caseEvent);
	}

	private async Task<Guid?> SignedInStaffMemberIdAsync(CancellationToken cancellationToken)
	{
		var accountId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

		return await _dbContext.Accounts
				.Where(account => account.Id == accountId)
				.Select(account => account.StaffMemberId)
				.FirstOrDefaultAsync(cancellationToken);
	}
}