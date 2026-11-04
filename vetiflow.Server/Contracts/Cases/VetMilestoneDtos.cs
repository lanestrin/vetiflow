using System.Linq.Expressions;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// The two independent milestones after arrival (build plan 2.16a, decided
// 2026-11-03): the vet assessment, and a next action with a named owner.
public enum VetMilestone
{
	// No assessment and no next action owner yet.
	AwaitingVet,
	// "Task assigned · Vet assessment pending": the door-to-doctor wait goes on.
	AssessmentPending,
	// "Awaiting vet next action": assessed, the handoff is still missing.
	AwaitingNextAction,
	// Assessed, with the next action and its owner.
	NextActionAssigned
}

public static class VetMilestones
{
	// The one rule the list and detail share; the client never derives it.
	public static VetMilestone For(bool assessed, bool hasNextActionOwner) => (assessed, hasNextActionOwner) switch
	{
		(false, false) => VetMilestone.AwaitingVet,
		(false, true) => VetMilestone.AssessmentPending,
		(true, false) => VetMilestone.AwaitingNextAction,
		(true, true) => VetMilestone.NextActionAssigned
	};
}

// When the vet assessed the patient, when it was entered, and who entered it.
public class VetAssessmentDto
{
	public DateTimeOffset OccurredAt { get; set; }

	public DateTimeOffset RecordedAt { get; set; }

	public CaseReferenceDto? RecordedBy { get; set; }
}

// The designated Next Care Action's owner (4.13a): a technician is the
// handoff, a veterinarian means the vet handles the next step personally.
public class NextActionOwnerDto
{
	public Guid Id { get; set; }

	public required string Name { get; set; }

	public StaffRole Role { get; set; }

	// For the list and detail projections, so EF translates them to SQL:
	// case.Tasks.AsQueryable().Where(IsOwnedNextAction).Select(FromTask).
	// Only an active technician or veterinarian counts as an owner.
	public static readonly Expression<Func<CaseTask, bool>> IsOwnedNextAction = task =>
		task.IsNextAction
		&& task.AssignedToStaff != null
		&& task.AssignedToStaff.IsActive
		&& (task.AssignedToStaff.Role == StaffRole.Technician || task.AssignedToStaff.Role == StaffRole.Veterinarian);

	public static readonly Expression<Func<CaseTask, NextActionOwnerDto>> FromTask = task => new NextActionOwnerDto
	{
		Id = task.AssignedToStaff!.Id,
		Name = task.AssignedToStaff.FirstName + " " + task.AssignedToStaff.LastName,
		Role = task.AssignedToStaff.Role
	};
}
