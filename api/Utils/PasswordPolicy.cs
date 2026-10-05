namespace api.Utils
{
    /// <summary>
    /// What makes an acceptable password, following current NIST guidance: long enough, not a
    /// well-known password, not the username - and no forced mix of symbols, which only pushes
    /// people towards "Password1!". A short phrase like "blue tablet on the cart" is ideal.
    /// </summary>
    public static class PasswordPolicy
    {
        #region Public Fields

        /// <summary>Shortest password accepted.</summary>
        public const int MinLength = 8;

        /// <summary>Longest password accepted - long enough for any passphrase or password manager.</summary>
        public const int MaxLength = 128;

        /// <summary>The rule in words, for the sign-in and crew screens.</summary>
        public const string Description =
            "At least 8 characters. A short phrase works well, like \"blue tablet on the cart\".";

        #endregion

        #region Public Methods

        /// <summary>
        /// Checks a new password.
        /// </summary>
        /// <param name="password">The proposed password</param>
        /// <param name="username">The account's username</param>
        /// <param name="name">The account's display name</param>
        /// <returns>What's wrong with it, or null when it's acceptable.</returns>
        public static string? Check(string? password, string? username, string? name)
        {
            if (string.IsNullOrEmpty(password))
                return "Enter a password.";

            if (password.Length < MinLength)
                return $"The password must be at least {MinLength} characters.";

            if (password.Length > MaxLength)
                return $"The password can be at most {MaxLength} characters.";

            var lower = password.ToLowerInvariant();

            if (lower.Distinct().Count() < 4)
                return "That password is too easy to guess. Use more different characters.";

            if (!string.IsNullOrWhiteSpace(username) && lower.Contains(username.Trim().ToLowerInvariant()))
                return "The password can't contain the username.";

            if (!string.IsNullOrWhiteSpace(name) && name.Trim().Length >= 4 && lower.Contains(name.Trim().ToLowerInvariant()))
                return "The password can't contain the person's name.";

            if (IsSequence(lower))
                return "That password is too easy to guess. Avoid runs like 1234567890 or abcdefghij.";

            var bare = new string(lower.Where(char.IsLetterOrDigit).ToArray());
            if (Common.Contains(lower) || Common.Contains(bare) || Common.Any(c => bare.StartsWith(c) && bare.Length - c.Length <= 4))
                return "That is a commonly used password. Choose something less predictable.";

            return null;
        }

        #endregion

        #region Private Methods

        /// <summary>A run of keys or digits in order, such as "1234567890" or "qwertyuiop".</summary>
        private static bool IsSequence(string value)
        {
            const string rows = "abcdefghijklmnopqrstuvwxyz 0123456789 qwertyuiop asdfghjkl zxcvbnm";
            return value.Length >= MinLength
                   && (rows.Contains(value) || new string(value.Reverse().ToArray()) is var r && rows.Contains(r));
        }

        /// <summary>
        /// Passwords that turn up near the top of every breach list, plus this app's own
        /// obvious guesses. Matched after lower-casing, with and without punctuation.
        /// </summary>
        private static readonly HashSet<string> Common = new(StringComparer.Ordinal)
        {
            "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd",
            "123456789", "1234567890", "12345678910", "0123456789", "987654321", "1111111111", "0000000000",
            "qwertyuiop", "qwerty123", "qwerty1234", "1q2w3e4r5t", "1qaz2wsx3edc", "zaq12wsx", "asdfghjkl",
            "iloveyou", "iloveyou1", "sunshine1", "princess1", "football1", "baseball1", "starwars1",
            "welcome1", "welcome123", "letmein1", "letmein123", "trustno1", "monkey123", "dragon123",
            "superman1", "michael1", "jennifer1", "jordan23", "shadow123", "master123", "computer1",
            "abc123456", "abcd1234", "abcdefghij", "changeme", "changeme1", "changeme123", "default1",
            "admin123", "admin1234", "administrator", "adminadmin", "root1234", "test1234", "testing123",
            "mattress", "mattress1", "mattress123", "fundraiser", "fundraiser1", "fundraising", "cfspittsburgh",
            "pittsburgh", "pittsburgh1", "steelers", "steelers1", "cleveland1", "summer2026", "winter2026",
            "spring2026", "autumn2026", "fall2026", "summer2025", "winter2025",
        };

        #endregion
    }
}
