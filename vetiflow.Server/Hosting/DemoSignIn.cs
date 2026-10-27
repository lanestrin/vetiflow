namespace vetiflow.Server.Hosting;

// The simulated phone sign-in (build plan S.19, project plan section 10).
// No text is ever sent: the code is fixed and works only while the setting is
// on, which is never the case where real clinic data lives (8.10).
public static class DemoSignIn
{
	public const string EnabledSetting = "DemoSignIn:Enabled";

	public const string Code = "123456";

	// Accepts the usual ways of writing a US mobile number ("312-555-0101",
	// "(312) 555-0101", "3125550101", "+1 312 555 0101") and returns it as
	// stored on accounts: "+1" and 10 digits.
	public static bool TryNormalizePhone(string input, out string phoneNumber)
	{
		phoneNumber = "";

		if (input.Any(character => !char.IsDigit(character) && !" -().+".Contains(character)))
		{
			return false;
		}

		var digits = new string(input.Where(char.IsDigit).ToArray());

		if (digits.Length == 11 && digits[0] == '1')
		{
			digits = digits[1..];
		}

		if (digits.Length != 10)
		{
			return false;
		}

		phoneNumber = "+1" + digits;
		return true;
	}
}
