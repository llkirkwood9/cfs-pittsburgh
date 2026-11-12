using Microsoft.AspNetCore.Http;

namespace api.Dtos
{
    /// <summary>
    /// Who to email, an optional note, and the sheets: pages uploaded beforehand, or a whole PDF.
    /// Sent as multipart form data.
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
        /// The sheets' pages, uploaded one at a time beforehand (EmailController.StartPages)
        /// </summary>
        public Guid? UploadId { get; set; }

        /// <summary>
        /// The sheets as a whole PDF, from app builds that don't upload page by page
        /// </summary>
        public IFormFile? Pdf { get; set; }
    }
}
