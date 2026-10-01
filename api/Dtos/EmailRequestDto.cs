using Microsoft.AspNetCore.Http;

namespace api.Dtos
{
    /// <summary>
    /// Who to email, an optional note, and the sheets as a PDF. Sent as multipart form data.
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

        /// <summary>
        /// The sheets, as built by the dashboard from what is on screen
        /// </summary>
        public IFormFile? Pdf { get; set; }
    }
}
