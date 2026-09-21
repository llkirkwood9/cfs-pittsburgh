namespace api.Dtos.Authentication
{
    /// <summary>
    /// Request to exchange a refresh token for a fresh token pair.
    /// </summary>
    public class RefreshDto
    {
        /// <summary>
        /// The refresh token issued at sign-in
        /// </summary>
        public string? RefreshToken { get; set; }
    }
}
