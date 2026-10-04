namespace api.Utils
{
    /// <summary>
    /// Named rate-limit policies, registered in Program.cs.
    /// </summary>
    public static class RateLimits
    {
        /// <summary>
        /// Sign-in, session renewal and sign-out: a tighter limit per client address, on top of the
        /// per-account lockout, to slow password guessing. Generous enough for a cart's tablets
        /// sharing one venue connection.
        /// </summary>
        public const string SignIn = "sign-in";
    }
}
