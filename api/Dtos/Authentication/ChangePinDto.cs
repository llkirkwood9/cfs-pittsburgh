namespace api.Dtos.Authentication
{
    /// <summary>
    /// A crew member changing their own PIN.
    /// </summary>
    public class ChangePinDto
    {
        /// <summary>
        /// The PIN they sign in with now
        /// </summary>
        public string? CurrentPin { get; set; }

        /// <summary>
        /// The PIN they want instead, 4 to 12 digits
        /// </summary>
        public string? NewPin { get; set; }
    }
}
