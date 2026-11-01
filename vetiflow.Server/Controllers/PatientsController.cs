using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts;
using vetiflow.Server.Contracts.Cases;
using vetiflow.Server.Contracts.Patients;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Hubs;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// Patient records for hospital team members (build plan 4.6a). A patient may
// have no owner: a stray, or the owner is not known yet. Pet parents reach
// their own pets only through api/pet-parent/pets.
[ApiController]
[Route("api/patients")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class PatientsController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public PatientsController(
			VetiFlowDbContext dbContext,
			IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	// Patients whose name, or whose owner's first, last or full name, contains
	// the text.
	[HttpGet]
	public async Task<ActionResult<List<PatientListItemDto>>> SearchPatients(string? search, CancellationToken cancellationToken)
	{
		if (!SearchText.TryClean(search, out var text))
		{
			ModelState.AddModelError("search", SearchText.ErrorMessage);
			return ValidationProblem();
		}

		var pattern = SearchText.ContainsPattern(text);

		var patients = await _dbContext.Patients
				.AsNoTracking()
				.Where(patient =>
					EF.Functions.ILike(patient.Name, pattern, SearchText.EscapeCharacter)
					|| (patient.Owner != null && (
						EF.Functions.ILike(patient.Owner.FirstName, pattern, SearchText.EscapeCharacter)
						|| EF.Functions.ILike(patient.Owner.LastName, pattern, SearchText.EscapeCharacter)
						|| EF.Functions.ILike(patient.Owner.FirstName + " " + patient.Owner.LastName, pattern, SearchText.EscapeCharacter))))
				.OrderBy(patient => patient.Name)
				.ThenBy(patient => patient.Owner == null ? null : patient.Owner.LastName)
				.Take(SearchText.MaxResults)
				.Select(patient => new PatientListItemDto
				{
					Id = patient.Id,
					Name = patient.Name,
					Species = patient.Species,
					Breed = patient.Breed,
					OwnerId = patient.OwnerId,
					OwnerName = patient.Owner == null ? null : patient.Owner.FirstName + " " + patient.Owner.LastName,
					InCare = _dbContext.EmergencyCases.Any(emergencyCase =>
						emergencyCase.PatientId == patient.Id && emergencyCase.DischargedAt == null)
				})
				.ToListAsync(cancellationToken);

		return patients;
	}

	[HttpGet("{id:guid}")]
	public async Task<ActionResult<PatientDto>> GetPatient(Guid id, CancellationToken cancellationToken)
	{
		var patient = await _dbContext.Patients
				.AsNoTracking()
				.Include(patient => patient.Owner)
				.FirstOrDefaultAsync(patient => patient.Id == id, cancellationToken);

		if (patient is null)
		{
			return NotFound();
		}

		return PatientDto.From(patient);
	}

	// The patient's ER visits, active and discharged, for the profile's Visit
	// History (build plan 4.21b).
	[HttpGet("{id:guid}/visits")]
	public async Task<ActionResult<PatientVisitHistoryDto>> GetPatientVisits(Guid id, CancellationToken cancellationToken)
	{
		var patient = await _dbContext.Patients
				.AsNoTracking()
				.Where(patient => patient.Id == id)
				.Select(patient => new PatientHeaderDto
				{
					Id = patient.Id,
					Name = patient.Name,
					Species = patient.Species,
					Breed = patient.Breed
				})
				.FirstOrDefaultAsync(cancellationToken);

		if (patient is null)
		{
			return NotFound();
		}

		var visits = await _dbContext.EmergencyCases
				.AsNoTracking()
				.Where(emergencyCase => emergencyCase.PatientId == id)
				.OrderByDescending(emergencyCase => emergencyCase.ArrivalTime)
				.Select(emergencyCase => new PatientVisitDto
				{
					CaseId = emergencyCase.Id,
					CaseNumber = "ER-" + emergencyCase.CaseNumber,
					ArrivalTime = emergencyCase.ArrivalTime,
					PresentingComplaint = emergencyCase.PresentingComplaint,
					DischargedAt = emergencyCase.DischargedAt,
					AttendingDoctor = emergencyCase.AssignedDoctor == null
						? null
						: new CaseReferenceDto
						{
							Id = emergencyCase.AssignedDoctor.Id,
							Name = emergencyCase.AssignedDoctor.FirstName + " " + emergencyCase.AssignedDoctor.LastName
						}
				})
				.ToListAsync(cancellationToken);

		return new PatientVisitHistoryDto { Patient = patient, Visits = visits };
	}

	[HttpPost]
	public async Task<ActionResult<PatientDto>> CreatePatient(SavePatientRequest request, CancellationToken cancellationToken)
	{
		var owner = await FindOwnerAsync(request.OwnerId, cancellationToken);
		CheckDateOfBirth(request.DateOfBirth);

		if (!ModelState.IsValid)
		{
			return ValidationProblem();
		}

		var patient = new Patient
		{
			Name = request.Name!,
			Species = request.Species!,
			Breed = request.Breed,
			Sex = request.Sex,
			DateOfBirth = request.DateOfBirth,
			Owner = owner
		};

		_dbContext.Patients.Add(patient);
		await _dbContext.SaveChangesAsync(cancellationToken);

		return CreatedAtAction(nameof(GetPatient), new { id = patient.Id }, PatientDto.From(patient));
	}

	[HttpPut("{id:guid}")]
	public async Task<ActionResult<PatientDto>> UpdatePatient(Guid id, SavePatientRequest request, CancellationToken cancellationToken)
	{
		var patient = await _dbContext.Patients
				.Include(patient => patient.Owner)
				.FirstOrDefaultAsync(patient => patient.Id == id, cancellationToken);

		if (patient is null)
		{
			return NotFound();
		}

		var owner = await FindOwnerAsync(request.OwnerId, cancellationToken);
		CheckDateOfBirth(request.DateOfBirth);

		if (!ModelState.IsValid)
		{
			return ValidationProblem();
		}

		patient.Name = request.Name!;
		patient.Species = request.Species!;
		patient.Breed = request.Breed;
		patient.Sex = request.Sex;
		patient.DateOfBirth = request.DateOfBirth;
		patient.Owner = owner;
		patient.OwnerId = owner?.Id;

		await _dbContext.SaveChangesAsync(cancellationToken);

		await NotifyBoardsAsync(patient.Id, cancellationToken);

		return PatientDto.From(patient);
	}

	// Null when there is no owner ID, or when it matches no owner; the second
	// is a field error.
	private async Task<Owner?> FindOwnerAsync(Guid? ownerId, CancellationToken cancellationToken)
	{
		if (ownerId is null)
		{
			return null;
		}

		var owner = await _dbContext.Owners
				.FirstOrDefaultAsync(owner => owner.Id == ownerId, cancellationToken);

		if (owner is null)
		{
			ModelState.AddModelError(nameof(SavePatientRequest.OwnerId), "No owner has this ID.");
		}

		return owner;
	}

	private void CheckDateOfBirth(DateOnly? dateOfBirth)
	{
		if (dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
		{
			ModelState.AddModelError(nameof(SavePatientRequest.DateOfBirth), "The date of birth can't be in the future.");
		}
	}

	// The board shows the patient's name, species and breed, so boards
	// refetch when a patient in care changes. Only the case ID is sent.
	private async Task NotifyBoardsAsync(Guid patientId, CancellationToken cancellationToken)
	{
		var activeCaseId = await _dbContext.EmergencyCases
				.AsNoTracking()
				.Where(emergencyCase => emergencyCase.PatientId == patientId && emergencyCase.DischargedAt == null)
				.Select(emergencyCase => (Guid?)emergencyCase.Id)
				.FirstOrDefaultAsync(cancellationToken);

		if (activeCaseId is not null)
		{
			await _caseHub.Clients.All.SendAsync("caseUpdated", activeCaseId.Value, cancellationToken);
		}
	}
}
