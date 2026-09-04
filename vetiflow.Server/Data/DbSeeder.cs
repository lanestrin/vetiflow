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

		var buddy = new Patient
		{
			Name = "Buddy",
			Species = "Dog",
			Breed = "Golden Retriever",
			Sex = "Male"
		};

		var luna = new Patient
		{
			Name = "Luna",
			Species = "Cat",
			Breed = "Domestic Shorthair",
			Sex = "Female"
		};

		var max = new Patient
		{
			Name = "Max",
			Species = "Dog",
			Breed = "German Shepherd",
			Sex = "Male"
		};

		var emergencyCases = new[]
		{
						new EmergencyCase
						{
								Patient = buddy,
								PatientId = buddy.Id,
								PresentingComplaint =
										"Non-productive retching, restlessness, and abdominal distension.",
								WeightKg = 31.4m,
								Stage = CaseStage.Triage,
								Status = CaseStatus.InProgress,
								Acuity = AcuityLevel.Critical,
								ArrivalTime = DateTimeOffset.UtcNow.AddMinutes(-18),
								NextAction = "Move to treatment immediately"
						},

						new EmergencyCase
						{
								Patient = luna,
								PatientId = luna.Id,
								PresentingComplaint =
										"Repeated vomiting since this morning with decreased appetite.",
								WeightKg = 4.8m,
								Stage = CaseStage.Diagnostics,
								Status = CaseStatus.Waiting,
								Acuity = AcuityLevel.Urgent,
								ArrivalTime = DateTimeOffset.UtcNow.AddMinutes(-42),
								NextAction = "Review bloodwork results"
						},

						new EmergencyCase
						{
								Patient = max,
								PatientId = max.Id,
								PresentingComplaint =
										"Right hind limb lameness after jumping from a vehicle.",
								WeightKg = 36.2m,
								Stage = CaseStage.Treatment,
								Status = CaseStatus.Assigned,
								Acuity = AcuityLevel.Stable,
								ArrivalTime = DateTimeOffset.UtcNow.AddMinutes(-67),
								NextAction = "Administer pain medication"
						}
				};

		dbContext.EmergencyCases.AddRange(emergencyCases);

		await dbContext.SaveChangesAsync();
	}
}