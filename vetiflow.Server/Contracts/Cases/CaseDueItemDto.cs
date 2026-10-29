using System.Linq.Expressions;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// The next open due item of one type on a case (build plan 4.4a): the earliest
// due open Reassessment or ClientUpdate task.
public class CaseDueItemDto
{
	public Guid Id { get; set; }

	public required string Description { get; set; }

	public DateTimeOffset? DueAt { get; set; }

	public CaseReferenceDto? AssignedTo { get; set; }

	// For the list and detail projections, so EF translates it to SQL.
	public static readonly Expression<Func<CaseTask, CaseDueItemDto>> FromTask = task => new CaseDueItemDto
	{
		Id = task.Id,
		Description = task.Description,
		DueAt = task.DueAt,
		AssignedTo = task.AssignedToStaff == null
			? null
			: new CaseReferenceDto
			{
				Id = task.AssignedToStaff.Id,
				Name = task.AssignedToStaff.FirstName + " " + task.AssignedToStaff.LastName
			}
	};
}
