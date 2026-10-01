namespace api.Dtos
{
    /// <summary>
    /// Who to email, and an optional note to include.
    /// </summary>
    public class EmailRequestDto
    {
        /// <summary>
        /// Comma-separated addresses
        /// </summary>
        public string? To { get; set; }

        /// <summary>
        /// Optional message shown at the top of a report
        /// </summary>
        public string? Message { get; set; }
    }
}
