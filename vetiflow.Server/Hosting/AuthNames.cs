namespace vetiflow.Server.Hosting;

// Names shared by sign-in, the token and the endpoints that check it.
public static class AuthNames
{
	// The account's AccountKind; the experience comes only from this claim.
	public const string KindClaim = "kind";

	// Hospital team members only (the board, from S.18).
	public const string TeamMemberPolicy = "TeamMember";
}
