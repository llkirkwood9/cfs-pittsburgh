namespace api.Dtos
{
    /// <summary>
    /// The receipt email's wording, as the settings screen sees it.
    /// </summary>
    public class ReceiptEmailSettingsDto
    {
        /// <summary>
        /// The body in use - the saved wording, or the default when none is saved
        /// </summary>
        public string? Body { get; set; }

        /// <summary>
        /// Whether the body is the built-in default
        /// </summary>
        public bool? IsDefault { get; set; }

        /// <summary>
        /// The built-in default, for "Reset to default"
        /// </summary>
        public string? DefaultBody { get; set; }

        /// <summary>
        /// The longest body that can be saved
        /// </summary>
        public int? MaxLength { get; set; }

        /// <summary>
        /// Every placeholder the body can use
        /// </summary>
        public List<PlaceholderDto>? Placeholders { get; set; }

        /// <summary>
        /// When the saved wording was last changed (UTC)
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// Who last changed it
        /// </summary>
        public string? UpdatedBy { get; set; }
    }

    /// <summary>
    /// A placeholder a receipt body can use.
    /// </summary>
    public class PlaceholderDto
    {
        /// <summary>
        /// The name, without braces
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// What it becomes
        /// </summary>
        public string? Description { get; set; }
    }

    /// <summary>
    /// A receipt body to save or preview.
    /// </summary>
    public class ReceiptEmailBodyDto
    {
        /// <summary>
        /// The wording; empty to go back to the default
        /// </summary>
        public string? Body { get; set; }
    }

    /// <summary>
    /// What a receipt body looks like for a sample order.
    /// </summary>
    public class ReceiptEmailPreviewDto
    {
        /// <summary>
        /// The email's subject line
        /// </summary>
        public string? Subject { get; set; }

        /// <summary>
        /// The email's body, as sent
        /// </summary>
        public string? Html { get; set; }

        /// <summary>
        /// Placeholders that aren't recognised - most likely typos
        /// </summary>
        public List<string>? UnknownPlaceholders { get; set; }
    }
}
