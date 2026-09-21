namespace api.Dtos.Authentication
{
    /// <summary>
    /// Sign-in request from the tablet keypad.
    /// </summary>
    public class LoginDto
    {
        /// <summary>
        /// Login handle typed on the sign-in screen
        /// </summary>
        public string? Username { get; set; }

        /// <summary>
        /// Numeric PIN
        /// </summary>
        public string? Pin { get; set; }
    }
}
