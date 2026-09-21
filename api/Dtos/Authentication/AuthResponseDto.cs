namespace api.Dtos.Authentication
{
    /// <summary>
    /// Token pair and profile returned from a successful sign-in or refresh.
    /// </summary>
    public class AuthResponseDto
    {
        /// <summary>
        /// Short-lived JWT bearer token
        /// </summary>
        public string? AccessToken { get; set; }

        /// <summary>
        /// Long-lived opaque refresh token
        /// </summary>
        public string? RefreshToken { get; set; }

        /// <summary>
        /// Profile of the signed-in user
        /// </summary>
        public UserDto? User { get; set; }
    }
}
