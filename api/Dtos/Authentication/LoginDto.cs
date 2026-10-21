namespace api.Dtos.Authentication
{
    /// <summary>
    /// Sign-in request.
    /// </summary>
    public class LoginDto
    {
        /// <summary>
        /// Login handle
        /// </summary>
        public string? Username { get; set; }

        /// <summary>
        /// Password. An account from before passwords may give its old PIN here once, and must
        /// then choose a password.
        /// </summary>
        public string? Password { get; set; }
    }
}
