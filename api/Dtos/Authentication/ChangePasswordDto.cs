namespace api.Dtos.Authentication
{
    /// <summary>
    /// A signed-in user changing their own password.
    /// </summary>
    public class ChangePasswordDto
    {
        /// <summary>
        /// The password (or old PIN) they signed in with
        /// </summary>
        public string? CurrentPassword { get; set; }

        /// <summary>
        /// The new password
        /// </summary>
        public string? NewPassword { get; set; }
    }
}
