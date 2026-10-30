using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;

namespace vetiflow.Server.Data;

public static class DbSeeder
{
	// Fictional and shown on the demo sign-in screen (project plan section 10).
	public const string DemoPassword = "welcome1";

	// Each part runs only when its data is missing, so seeding on every boot
	// never duplicates rows, and a database seeded before accounts existed
	// still gets them.
	public static async Task SeedAsync(VetiFlowDbContext dbContext)
	{
		if (!await dbContext.EmergencyCases.AnyAsync())
		{
			await SeedCasesAsync(dbContext);
		}

		if (!await dbContext.Accounts.AnyAsync())
		{
			await SeedDemoAccountsAsync(dbContext);
		}

		await LinkDemoPetAsync(dbContext);
		await RefreshDemoTimesAsync(dbContext);
		await SeedAdditionalCasesAsync(dbContext);
	}

	// IDs belong to these fixtures, independent of names, case counts and edits.
	// Never reuse an index for another patient: old demo databases backfill by ID.
	private sealed record DemoCaseSeed(int Index, string Name, string Species, string Breed,
		AcuityLevel Acuity, CaseStage Stage, int MinutesAgo, string Complaint, string NextAction);

	private static readonly DemoCaseSeed[] AdditionalCases =
	[
		new(1, "Pepper", "Cat", "Domestic Longhair", AcuityLevel.Critical, CaseStage.Treatment, 95, "Increased breathing effort and open-mouth breathing at rest.", "Recheck respiratory effort"),
		new(2, "Winston Montgomery", "Dog", "Cavalier King Charles Spaniel", AcuityLevel.Critical, CaseStage.Diagnostics, 130, "Sudden collapse during a walk with continued weakness and pale gums.", "Review bedside imaging"),
		new(3, "Olive", "Dog", "Labrador Retriever", AcuityLevel.Critical, CaseStage.Incoming, 24, "Reported ingestion of an unknown quantity of medication; arriving by car.", "Confirm intake and reassess on arrival"),
		new(4, "Jasper", "Cat", "Siamese Mix", AcuityLevel.Critical, CaseStage.Triage, 48, "Repeated straining in the litter box without passing urine.", "Complete initial assessment"),
		new(5, "Ruby", "Dog", "Boxer", AcuityLevel.Critical, CaseStage.Recheck, 185, "Weakness following treatment for an allergic reaction.", "Repeat perfusion assessment"),
		new(6, "Archie", "Dog", "Miniature Australian Shepherd", AcuityLevel.Urgent, CaseStage.Diagnostics, 115, "Persistent vomiting and abdominal discomfort after chewing a toy.", "Review abdominal radiographs"),
		new(7, "Clementine", "Cat", "Domestic Medium Hair", AcuityLevel.Urgent, CaseStage.Treatment, 78, "Painful wound on the left shoulder after an outdoor altercation.", "Reassess comfort after wound care"),
		new(8, "Finn", "Dog", "Border Collie", AcuityLevel.Urgent, CaseStage.Incoming, 20, "Facial swelling reported after an insect sting; patient en route.", "Assess swelling on arrival"),
		new(9, "Mabel", "Cat", "Maine Coon", AcuityLevel.Urgent, CaseStage.Recheck, 210, "Reduced appetite and lethargy with a history of chronic kidney disease.", "Review response to supportive care"),
		new(10, "Poppy", "Dog", "Beagle", AcuityLevel.Stable, CaseStage.Discharge, 250, "Small paw-pad cut after a walk; bleeding has stopped.", "Review home-care instructions"),
		new(11, "Theodore Roosevelt", "Cat", "British Shorthair", AcuityLevel.Stable, CaseStage.Diagnostics, 155, "Intermittent sneezing and watery eyes while otherwise bright and eating.", "Review examination findings"),
		new(12, "Nori", "Cat", "Domestic Shorthair", AcuityLevel.Stable, CaseStage.Triage, 38, "Mild ear irritation and head shaking since yesterday.", "Complete ear examination"),
		new(13, "Hazel", "Dog", "Bernese Mountain Dog and Poodle Mix", AcuityLevel.Stable, CaseStage.Treatment, 105, "Broken toenail with mild intermittent bleeding and discomfort when walking.", "Recheck bandage and comfort"),
		new(14, "Milo", "Dog", "Dachshund", AcuityLevel.Stable, CaseStage.Recheck, 165, "One episode of vomiting; comfortable and drinking during observation.", "Confirm discharge readiness"),
		new(15, "Juniper", "Cat", "Ragdoll", AcuityLevel.Stable, CaseStage.Incoming, 18, "Reported mild limping after play with no visible wound; arriving shortly.", "Confirm arrival and assess gait")
	];

	private static async Task SeedAdditionalCasesAsync(VetiFlowDbContext dbContext)
	{
		var caseIds = AdditionalCases.Select(seed => DemoFixtureId(1, seed.Index)).ToArray();
		// Includes discharged fixtures, so a restart never brings them back.
		var existingIds = await dbContext.EmergencyCases.AsNoTracking()
			.Where(emergencyCase => caseIds.Contains(emergencyCase.Id))
			.Select(emergencyCase => emergencyCase.Id).ToHashSetAsync();
		var missing = AdditionalCases.Where(seed => !existingIds.Contains(DemoFixtureId(1, seed.Index))).ToArray();
		if (missing.Length == 0) return;

		var patientIds = missing.Select(seed => DemoFixtureId(2, seed.Index)).ToArray();
		var patients = await dbContext.Patients.Where(patient => patientIds.Contains(patient.Id))
			.ToDictionaryAsync(patient => patient.Id);
		var ownerIds = missing.Select(seed => DemoFixtureId(3, seed.Index)).ToArray();
		var owners = await dbContext.Owners.Where(owner => ownerIds.Contains(owner.Id))
			.ToDictionaryAsync(owner => owner.Id);
		var activePatientIds = await dbContext.EmergencyCases.AsNoTracking()
			.Where(emergencyCase => patientIds.Contains(emergencyCase.PatientId) && emergencyCase.DischargedAt == null)
			.Select(emergencyCase => emergencyCase.PatientId).ToHashSetAsync();
		var staff = await dbContext.StaffMembers.AsNoTracking().Where(member => member.IsActive)
			.OrderBy(member => member.LastName).Select(member => new { member.Id, member.Role }).ToListAsync();
		var doctorId = staff.FirstOrDefault(member => member.Role == StaffRole.Veterinarian)?.Id;
		var technicianId = staff.FirstOrDefault(member => member.Role == StaffRole.Technician)?.Id;
		var now = DateTimeOffset.UtcNow;

		foreach (var seed in missing)
		{
			var patientId = DemoFixtureId(2, seed.Index);
			// Preserve a fixture patient that has since been admitted to another case.
			if (activePatientIds.Contains(patientId)) continue;

			if (!patients.TryGetValue(patientId, out var patient))
			{
				var ownerId = DemoFixtureId(3, seed.Index);
				if (!owners.TryGetValue(ownerId, out var owner))
				{
					owner = new Owner
					{
						Id = ownerId, FirstName = "Demo", LastName = $"Family {seed.Index}",
						Phone = $"555-01{seed.Index + 19:D2}", Email = $"demo.family{seed.Index}@example.com"
					};
				}
				patient = new Patient
				{
					Id = patientId, Name = seed.Name, Species = seed.Species, Breed = seed.Breed,
					Sex = seed.Species == "Cat" ? PatientSex.FemaleSpayed : PatientSex.MaleNeutered,
					DateOfBirth = DateOnly.FromDateTime(now.UtcDateTime).AddYears(-(seed.Index % 12 + 1)), Owner = owner
				};
			}

			var incoming = seed.Stage == CaseStage.Incoming;
			var blocked = !incoming && seed.Index % 4 == 0;
			var arrivedAt = now.AddMinutes(-seed.MinutesAgo);
			var assessedAt = arrivedAt.AddMinutes(incoming ? 0 : 5);
			var emergencyCase = new EmergencyCase
			{
				Id = DemoFixtureId(1, seed.Index), Patient = patient, PresentingComplaint = seed.Complaint,
				WeightKg = seed.Species == "Cat" ? 4.2m + seed.Index / 10m : 12m + seed.Index,
				Stage = seed.Stage, StageEnteredAt = assessedAt, ArrivalTime = arrivedAt,
				Status = incoming ? CaseStatus.Unassigned : blocked ? CaseStatus.Blocked : CaseStatus.InProgress,
				AssignedDoctorId = incoming ? null : doctorId, AssignedTechnicianId = incoming ? null : technicianId,
				NextAction = seed.NextAction,
				OwnerUpdateStatus = seed.Index % 2 == 0 ? OwnerUpdateStatus.Updated : OwnerUpdateStatus.NotYetUpdated,
				LastOwnerUpdateAt = seed.Index % 2 == 0 ? now.AddMinutes(-10) : null
			};
			emergencyCase.RecordTriage(new TriageAssessment
			{
				Acuity = seed.Acuity, RawIntakeNotes = seed.Complaint,
				AssessedAt = assessedAt, AssessedByStaffId = doctorId
			});
			// Fictional readings for layout coverage, including partial sets.
			emergencyCase.RecordVitals(new VitalsRecord
			{
				HeartRate = seed.Species == "Cat" ? 180 : 110,
				RespiratoryRate = seed.Index % 3 == 0 ? null : 28,
				TemperatureF = seed.Index % 3 == 0 ? null : 101.8m,
				SpO2 = seed.Acuity == AcuityLevel.Critical ? 93 : 98,
				RecordedAt = assessedAt, RecordedByStaffId = doctorId
			});
			if (!incoming && doctorId is not null)
			{
				emergencyCase.RecordPainScore(new PainScore
				{
					Score = seed.Index % 11, RecordedAt = assessedAt, RecordedByStaffId = doctorId,
					Notes = "Fictional demo assessment for dashboard preview."
				});
			}
			emergencyCase.Events.Add(new CaseEvent { Type = CaseEventType.Arrived, Description = $"{seed.Name} arrived.", CreatedAt = arrivedAt });
			emergencyCase.Events.Add(new CaseEvent { Type = CaseEventType.Triaged, Description = $"Triaged as {seed.Acuity}.", CreatedAt = assessedAt, CreatedByStaffId = doctorId });
			emergencyCase.Tasks.Add(new CaseTask
			{
				Type = blocked ? CaseTaskType.Blocker : CaseTaskType.Reassessment,
				Description = blocked ? "Awaiting diagnostic results" : seed.NextAction,
				CreatedAt = assessedAt, DueAt = now.AddMinutes(seed.Index % 2 == 0 ? -8 : 15),
				CreatedByStaffId = doctorId, AssignedToStaffId = incoming ? null : technicianId
			});
			dbContext.EmergencyCases.Add(emergencyCase);
		}

		await dbContext.SaveChangesAsync();
	}

	private static Guid DemoFixtureId(int entity, int index) =>
		Guid.Parse($"89dd4a0{entity}-648e-4b16-9a12-{index:D12}");

	// Demo case times are set relative to the first seed and would otherwise
	// age forever (a database seeded weeks earlier showed waits of about 1,190
	// hours). Once the newest active case is older than this, startup moves
	// every case time forward by the same amount, so the newest active case
	// arrived FreshestArrivalAge ago, as on a fresh seed, and all gaps stay.
	private static readonly TimeSpan StaleAfter = TimeSpan.FromHours(12);
	private static readonly TimeSpan FreshestArrivalAge = TimeSpan.FromMinutes(18);

	private static async Task RefreshDemoTimesAsync(VetiFlowDbContext dbContext)
	{
		var newestActiveArrival = await dbContext.EmergencyCases
				.Where(emergencyCase => emergencyCase.DischargedAt == null)
				.Select(emergencyCase => (DateTimeOffset?)emergencyCase.ArrivalTime)
				.MaxAsync();

		var now = DateTimeOffset.UtcNow;
		if (newestActiveArrival is null || now - newestActiveArrival.Value <= StaleAfter)
		{
			return;
		}

		var by = now - FreshestArrivalAge - newestActiveArrival.Value;

		// All or nothing, so the timeline never ends up half moved.
		await using var transaction = await dbContext.Database.BeginTransactionAsync();

		await dbContext.EmergencyCases.ExecuteUpdateAsync(setters => setters
				.SetProperty(emergencyCase => emergencyCase.ArrivalTime, emergencyCase => emergencyCase.ArrivalTime + by)
				.SetProperty(emergencyCase => emergencyCase.StageEnteredAt, emergencyCase => emergencyCase.StageEnteredAt + by)
				.SetProperty(emergencyCase => emergencyCase.LastUpdated, emergencyCase => emergencyCase.LastUpdated + by)
				.SetProperty(emergencyCase => emergencyCase.LastOwnerUpdateAt, emergencyCase => emergencyCase.LastOwnerUpdateAt + by)
				.SetProperty(emergencyCase => emergencyCase.DischargedAt, emergencyCase => emergencyCase.DischargedAt + by));
		await dbContext.CaseTasks.ExecuteUpdateAsync(setters => setters
				.SetProperty(task => task.CreatedAt, task => task.CreatedAt + by)
				.SetProperty(task => task.DueAt, task => task.DueAt + by)
				.SetProperty(task => task.ResolvedAt, task => task.ResolvedAt + by));
		await dbContext.VitalsRecords.ExecuteUpdateAsync(setters => setters
				.SetProperty(vitals => vitals.RecordedAt, vitals => vitals.RecordedAt + by));
		await dbContext.PainScores.ExecuteUpdateAsync(setters => setters
				.SetProperty(painScore => painScore.RecordedAt, painScore => painScore.RecordedAt + by));
		await dbContext.TriageAssessments.ExecuteUpdateAsync(setters => setters
				.SetProperty(triage => triage.AssessedAt, triage => triage.AssessedAt + by));
		await dbContext.CaseEvents.ExecuteUpdateAsync(setters => setters
				.SetProperty(caseEvent => caseEvent.CreatedAt, caseEvent => caseEvent.CreatedAt + by));
		await dbContext.AiSummaries.ExecuteUpdateAsync(setters => setters
				.SetProperty(summary => summary.GeneratedAt, summary => summary.GeneratedAt + by)
				.SetProperty(summary => summary.ReviewedAt, summary => summary.ReviewedAt + by));
		await dbContext.Handoffs.ExecuteUpdateAsync(setters => setters
				.SetProperty(handoff => handoff.CreatedAt, handoff => handoff.CreatedAt + by)
				.SetProperty(handoff => handoff.AcknowledgedAt, handoff => handoff.AcknowledgedAt + by));

		await transaction.CommitAsync();
	}

	// The demo pet parent should have a pet to show. A fresh seed gives Morgan
	// Hale Buddy; on databases seeded before owners existed, Buddy has no owner
	// (AddOwners added Patient.OwnerId without a backfill). Runs every boot but
	// acts only while the demo Morgan Hale owns no pets, and never takes a pet
	// that has an owner or creates a case.
	private static async Task LinkDemoPetAsync(VetiFlowDbContext dbContext)
	{
		var ownerId = await dbContext.Accounts
				.Where(account => account.Email == "parent@vetiflow.demo")
				.Select(account => account.OwnerId)
				.SingleOrDefaultAsync();

		if (ownerId is null || await dbContext.Patients.AnyAsync(patient => patient.OwnerId == ownerId))
		{
			return;
		}

		var freeBuddy = await dbContext.Patients
				.FirstOrDefaultAsync(patient => patient.Name == "Buddy" && patient.Species == "Dog" && patient.OwnerId == null);

		if (freeBuddy is not null)
		{
			freeBuddy.OwnerId = ownerId;
		}
		else
		{
			dbContext.Patients.Add(new Patient
			{
				Name = "Buddy",
				Species = "Dog",
				Breed = "Golden Retriever",
				Sex = PatientSex.MaleIntact,
				OwnerId = ownerId
			});
		}

		await dbContext.SaveChangesAsync();
	}

	// Two demo sign-ins, linked by name to the seeded people. A database seeded
	// before those people existed (any older one) gets them created here, so the
	// locked board always has someone who can sign in.
	private static async Task SeedDemoAccountsAsync(VetiFlowDbContext dbContext)
	{
		var passwordHasher = new PasswordHasher<Account>();

		var jordanLee = await dbContext.StaffMembers
				.FirstOrDefaultAsync(staff => staff.FirstName == "Jordan" && staff.LastName == "Lee")
				?? new StaffMember { FirstName = "Jordan", LastName = "Lee", Role = StaffRole.Veterinarian };
		// Synthetic contact details only: 555-01xx and example.com.
		var morganHale = await dbContext.Owners
				.FirstOrDefaultAsync(owner => owner.FirstName == "Morgan" && owner.LastName == "Hale")
				?? new Owner { FirstName = "Morgan", LastName = "Hale", Phone = "555-0101", Email = "morgan.hale@example.com" };

		dbContext.Accounts.Add(WithDemoPassword(passwordHasher, new Account
		{
			Kind = AccountKind.TeamMember,
			StaffMember = jordanLee,
			Email = "team@vetiflow.demo",
			PhoneNumber = "+13125550101"
		}));

		dbContext.Accounts.Add(WithDemoPassword(passwordHasher, new Account
		{
			Kind = AccountKind.PetParent,
			Owner = morganHale,
			Email = "parent@vetiflow.demo",
			PhoneNumber = "+13125550102"
		}));

		await dbContext.SaveChangesAsync();
	}

	private static Account WithDemoPassword(PasswordHasher<Account> passwordHasher, Account account)
	{
		account.PasswordHash = passwordHasher.HashPassword(account, DemoPassword);
		return account;
	}

	private static async Task SeedCasesAsync(VetiFlowDbContext dbContext)
	{
		var now = DateTimeOffset.UtcNow;
		var today = DateOnly.FromDateTime(now.UtcDateTime);

		var drLee = new StaffMember
		{
			FirstName = "Jordan",
			LastName = "Lee",
			Role = StaffRole.Veterinarian,
			Status = StaffStatus.Busy
		};

		var drShah = new StaffMember
		{
			FirstName = "Priya",
			LastName = "Shah",
			Role = StaffRole.Veterinarian,
			Status = StaffStatus.Available
		};

		var techOrtiz = new StaffMember
		{
			FirstName = "Sam",
			LastName = "Ortiz",
			Role = StaffRole.Technician,
			Status = StaffStatus.Available
		};

		var techKim = new StaffMember
		{
			FirstName = "Alex",
			LastName = "Kim",
			Role = StaffRole.Technician,
			Status = StaffStatus.Busy
		};

		var treatmentBay1 = new Room { Name = "Treatment Bay 1", Type = RoomType.Treatment };
		var treatmentBay2 = new Room { Name = "Treatment Bay 2", Type = RoomType.Treatment };
		var exam1 = new Room { Name = "Exam 1", Type = RoomType.Exam };
		var exam2 = new Room { Name = "Exam 2", Type = RoomType.Exam };
		var icu = new Room { Name = "ICU", Type = RoomType.ICU };
		var oxygen = new Room { Name = "Oxygen Cage", Type = RoomType.Oxygen };
		var imaging = new Room { Name = "Imaging", Type = RoomType.Imaging };
		var surgery = new Room { Name = "Surgery", Type = RoomType.Surgery };

		// Synthetic contact details only: 555-01xx numbers and example.com.
		var buddyOwner = new Owner
		{
			FirstName = "Morgan",
			LastName = "Hale",
			Phone = "555-0101",
			Email = "morgan.hale@example.com"
		};

		var lunaOwner = new Owner
		{
			FirstName = "Casey",
			LastName = "Rivera",
			Phone = "555-0102",
			Email = "casey.rivera@example.com"
		};

		var maxOwner = new Owner
		{
			FirstName = "Taylor",
			LastName = "Brooks",
			Phone = "555-0103"
		};

		var buddy = new Patient
		{
			Name = "Buddy",
			Species = "Dog",
			Breed = "Golden Retriever",
			Sex = PatientSex.MaleIntact,
			DateOfBirth = today.AddYears(-8).AddMonths(-3),
			Owner = buddyOwner
		};

		var luna = new Patient
		{
			Name = "Luna",
			Species = "Cat",
			Breed = "Domestic Shorthair",
			Sex = PatientSex.FemaleSpayed,
			DateOfBirth = today.AddYears(-11).AddMonths(-7),
			Owner = lunaOwner
		};

		var max = new Patient
		{
			Name = "Max",
			Species = "Dog",
			Breed = "German Shepherd",
			Sex = PatientSex.MaleNeutered,
			DateOfBirth = today.AddYears(-3).AddMonths(-1),
			Owner = maxOwner
		};

		var buddyCase = new EmergencyCase
		{
			Patient = buddy,
			PresentingComplaint =
					"Non-productive retching, restlessness, and abdominal distension.",
			WeightKg = 31.4m,
			Stage = CaseStage.Triage,
			StageEnteredAt = now.AddMinutes(-12),
			Status = CaseStatus.Blocked,
			ArrivalTime = now.AddMinutes(-18),
			AssignedDoctor = drLee,
			AssignedTechnician = techOrtiz,
			Room = treatmentBay1,
			NextAction = "Move to treatment immediately",
			OwnerUpdateStatus = OwnerUpdateStatus.ConsentNeeded
		};

		buddyCase.RecordVitals(new VitalsRecord
		{
			HeartRate = 168,
			RespiratoryRate = 44,
			SpO2 = 93,
			MucousMembraneColor = "Pale",
			CapillaryRefillTime = ">2 s",
			Mentation = "Restless",
			RecordedAt = now.AddMinutes(-12),
			RecordedByStaff = drLee
		});

		buddyCase.RecordTriage(new TriageAssessment
		{
			Acuity = AcuityLevel.Critical,
			RawIntakeNotes =
					"Owner reports retching without producing anything for about an hour. " +
					"Belly looks bigger. Not neutered.",
			AssessedAt = now.AddMinutes(-12),
			AssessedByStaff = drLee
		});

		// A technician's recheck: repeated vitals without a new acuity decision.
		buddyCase.RecordVitals(new VitalsRecord
		{
			HeartRate = 180,
			RespiratoryRate = 48,
			SpO2 = 91,
			MucousMembraneColor = "Pale",
			CapillaryRefillTime = ">2 s",
			Mentation = "Restless",
			RecordedAt = now.AddMinutes(-3),
			RecordedByStaff = techOrtiz
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
			StageEnteredAt = now.AddMinutes(-24),
			Status = CaseStatus.Waiting,
			ArrivalTime = now.AddMinutes(-42),
			AssignedDoctor = drShah,
			AssignedTechnician = techKim,
			Room = exam1,
			NextAction = "Review bloodwork results",
			OwnerUpdateStatus = OwnerUpdateStatus.Updated,
			LastOwnerUpdateAt = now.AddMinutes(-15)
		};

		lunaCase.RecordVitals(new VitalsRecord
		{
			HeartRate = 210,
			RespiratoryRate = 32,
			TemperatureF = 102.9m,
			SpO2 = 97,
			MucousMembraneColor = "Pink, tacky",
			CapillaryRefillTime = "2 s",
			Mentation = "Quiet",
			RecordedAt = now.AddMinutes(-35),
			RecordedByStaff = drShah
		});

		lunaCase.RecordTriage(new TriageAssessment
		{
			Acuity = AcuityLevel.Urgent,
			RawIntakeNotes = "Vomited 5 times since 7am. Won't eat. Spayed.",
			AssessedAt = now.AddMinutes(-35),
			AssessedByStaff = drShah
		});

		lunaCase.RecordPainScore(new PainScore
		{
			Score = 7,
			Notes = "Tense abdomen on palpation",
			RecordedAt = now.AddMinutes(-35),
			RecordedByStaff = drShah
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
			StageEnteredAt = now.AddMinutes(-40),
			Status = CaseStatus.Assigned,
			ArrivalTime = now.AddMinutes(-67),
			AssignedDoctor = drLee,
			AssignedTechnician = techKim,
			Room = exam2,
			NextAction = "Administer pain medication"
		};

		maxCase.RecordVitals(new VitalsRecord
		{
			HeartRate = 96,
			RespiratoryRate = 24,
			TemperatureF = 101.5m,
			SpO2 = 98,
			MucousMembraneColor = "Pink",
			CapillaryRefillTime = "<2 s",
			Mentation = "Bright, alert",
			RecordedAt = now.AddMinutes(-60),
			RecordedByStaff = drShah
		});

		maxCase.RecordTriage(new TriageAssessment
		{
			Acuity = AcuityLevel.Urgent,
			RawIntakeNotes = "Jumped out of truck, holding right back leg up. Neutered.",
			AssessedAt = now.AddMinutes(-60),
			AssessedByStaff = drShah
		});

		maxCase.RecordPainScore(new PainScore
		{
			Score = 6,
			Notes = "Non-weight-bearing on right hind",
			RecordedAt = now.AddMinutes(-60),
			RecordedByStaff = drShah
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
