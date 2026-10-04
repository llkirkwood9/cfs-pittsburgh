namespace api.Dtos.Authentication
{
    /// <summary>
    /// What a sign-in or refresh returns. The refresh token is never in the body - it's set as an
    /// httpOnly cookie the dashboard's code can't read.
    /// </summary>
    public class AuthResponseDto
    {
        /// <summary>
        /// Short-lived bearer token for API calls, kept in memory only
        /// </summary>
        public string? AccessToken { get; set; }

        /// <summary>
        /// Seconds until the access token expires
        /// </summary>
        public int? ExpiresIn { get; set; }

        /// <summary>
        /// The signed-in user
        /// </summary>
        public UserDto? User { get; set; }
    }
}
