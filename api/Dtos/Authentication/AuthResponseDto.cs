namespace api.Dtos.Authentication
{
    /// <summary>
    /// What a sign-in or refresh returns. For the dashboard the refresh token is never in the body -
    /// it's set as an httpOnly cookie the dashboard's code can't read. The phone app, which has no
    /// such cookie jar, gets it in RefreshToken and keeps it in the phone's secure storage.
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

        /// <summary>
        /// The rotating refresh token - for the phone app only (X-CFS-Client: app); null otherwise
        /// </summary>
        public string? RefreshToken { get; set; }
    }
}
