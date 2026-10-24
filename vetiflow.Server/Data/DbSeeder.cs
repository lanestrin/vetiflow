using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;

namespace vetiflow.Server.Data;

public static class DbSeeder
{
	public static async Task SeedAsync(VetiFlowDbContext dbContext)
	{
		if (await dbContext.EmergencyCases.AnyAsync())
		{
			return;
		}

		var now = DateTimeOffset.UtcNow;

		var drLee = new StaffMember
		{
			FirstName = "Jordan",
			LastName = "Lee",
			Role = StaffRole.Veterinarian
		};

		var drShah = new StaffMember
		{
			FirstName = "Priya",
			LastName = "Shah",
			Role = StaffRole.Veterinarian
		};

		var techOrtiz = new StaffMember
		{
			FirstName = "Sam",
			LastName = "Ortiz",
			Role = StaffRole.Technician
		};

		var techKim = new StaffMember
		{
			FirstName = "Alex",
			LastName = "Kim",
			Role = StaffRole.Technician
		};

		var treatmentBay1 = new Room { Name = "Treatment Bay 1", Type = RoomType.Treatment };
		var treatmentBay2 = new Room { Name = "Treatment Bay 2", Type = RoomType.Treatment };
		var exam1 = new Room { Name = "Exam 1", Type = RoomType.Exam };
		var exam2 = new Room { Name = "Exam 2", Type = RoomType.Exam };
		var icu = new Room { Name = "ICU", Type = RoomType.ICU };
		var oxygen = new Room { Name = "Oxygen Cage", Type = RoomType.Oxygen };
		var imaging = new Room { Name = "Imaging", Type = RoomType.Imaging };
		var surgery = new Room { Name = "Surgery", Type = RoomType.Surgery };

		var buddy = new Patient
		{
			Name = "Buddy",
			Species = "Dog",
			Breed = "Golden Retriever",
			Sex = PatientSex.MaleIntact
		};

		var luna = new Patient
		{
			Name = "Luna",
			Species = "Cat",
			Breed = "Domestic Shorthair",
			Sex = PatientSex.FemaleSpayed
		};

		var max = new Patient
		{
			Name = "Max",
			Species = "Dog",
			Breed = "German Shepherd",
			Sex = PatientSex.MaleNeutered
		};

		var buddyCase = new EmergencyCase
		{
			Patient = buddy,
			PresentingComplaint =
					"Non-productive retching, restlessness, and abdominal distension.",
			WeightKg = 31.4m,
			Stage = CaseStage.Triage,
			Status = CaseStatus.Blocked,
			ArrivalTime = now.AddMinutes(-18),
			AssignedDoctor = drLee,
			AssignedTechnician = techOrtiz,
			Room = treatmentBay1,
			NextAction = "Move to treatment immediately"
		};

		buddyCase.RecordTriage(new TriageAssessment
		{
			Acuity = AcuityLevel.Critical,
			HeartRate = 168,
			RespiratoryRate = 44,
			MucousMembraneColor = "Pale",
			CapillaryRefillTime = ">2 s",
			Mentation = "Restless",
			RawIntakeNotes =
					"Owner reports retching without producing anything for about an hour. " +
					"Belly looks bigger. Not neutered.",
			AssessedAt = now.AddMinutes(-12),
			AssessedByStaff = drLee
		});

		buddyCase.Tasks.Add(new CaseTask
		{
			Type = CaseTaskType.Blocker,
			Description = "Awaiting owner consent for surgery",
			DueAt = now.AddMinutes(5),
			AssignedToStaff = drLee,
			CreatedByStaff = drLee,
			CreatedAt = now.AddMinutes(-10)
		});

		var lunaCase = new EmergencyCase
		{
			Patient = luna,
			PresentingComplaint =
					"Repeated vomiting since this morning with decreased appetite.",
			WeightKg = 4.8m,
			Stage = CaseStage.Diagnostics,
			Status = CaseStatus.Waiting,
			ArrivalTime = now.AddMinutes(-42),
			AssignedDoctor = drShah,
			AssignedTechnician = techKim,
			Room = exam1,
			NextAction = "Review bloodwork results"
		};

		lunaCase.RecordTriage(new TriageAssessment
		{
			Acuity = AcuityLevel.Urgent,
			HeartRate = 210,
			RespiratoryRate = 32,
			TemperatureF = 102.9m,
			MucousMembraneColor = "Pink, tacky",
			CapillaryRefillTime = "2 s",
			Mentation = "Quiet",
			RawIntakeNotes = "Vomited 5 times since 7am. Won't eat. Spayed.",
			AssessedAt = now.AddMinutes(-35),
			AssessedByStaff = drShah
		});

		lunaCase.Tasks.Add(new CaseTask
		{
			Type = CaseTaskType.Blocker,
			Description = "Bloodwork results pending",
			DueAt = now.AddMinutes(-5),
			AssignedToStaff = techKim,
			CreatedByStaff = drShah,
			CreatedAt = now.AddMinutes(-30)
		});

		var maxCase = new EmergencyCase
		{
			Patient = max,
			PresentingComplaint =
					"Right hind limb lameness after jumping from a vehicle.",
			WeightKg = 36.2m,
			Stage = CaseStage.Treatment,
			Status = CaseStatus.Assigned,
			ArrivalTime = now.AddMinutes(-67),
			AssignedDoctor = drLee,
			AssignedTechnician = techKim,
			Room = exam2,
			NextAction = "Administer pain medication"
		};

		maxCase.RecordTriage(new TriageAssessment
		{
			Acuity = AcuityLevel.Stable,
			HeartRate = 96,
			RespiratoryRate = 24,
			TemperatureF = 101.5m,
			MucousMembraneColor = "Pink",
			CapillaryRefillTime = "<2 s",
			Mentation = "Bright, alert",
			RawIntakeNotes = "Jumped out of truck, holding right back leg up. Neutered.",
			AssessedAt = now.AddMinutes(-60),
			AssessedByStaff = drShah
		});

		maxCase.Tasks.Add(new CaseTask
		{
			Type = CaseTaskType.Task,
			Description = "Administer pain medication",
			DueAt = now.AddMinutes(10),
			AssignedToStaff = techKim,
			CreatedByStaff = drLee,
			CreatedAt = now.AddMinutes(-20)
		});

		var emergencyCases = new[] { buddyCase, lunaCase, maxCase };

		foreach (var emergencyCase in emergencyCases)
		{
			emergencyCase.Events.Add(new CaseEvent
			{
				Type = CaseEventType.Arrived,
				Description = $"{emergencyCase.Patient.Name} arrived.",
				CreatedAt = emergencyCase.ArrivalTime
			});

			var triage = emergencyCase.TriageAssessments[0];

			emergencyCase.Events.Add(new CaseEvent
			{
				Type = CaseEventType.Triaged,
				Description = $"Triaged as {triage.Acuity}.",
				CreatedByStaff = triage.AssessedByStaff,
				CreatedAt = triage.AssessedAt
			});
		}

		dbContext.StaffMembers.AddRange(drLee, drShah, techOrtiz, techKim);
		dbContext.Rooms.AddRange(
				treatmentBay1, treatmentBay2, exam1, exam2,
				icu, oxygen, imaging, surgery);
		dbContext.EmergencyCases.AddRange(emergencyCases);

		await dbContext.SaveChangesAsync();
	}
}
