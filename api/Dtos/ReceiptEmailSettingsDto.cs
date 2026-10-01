namespace api.Dtos
{
    /// <summary>
    /// The receipt email's wording, as the settings screen sees it.
    /// </summary>
    public class ReceiptEmailSettingsDto
    {
        /// <summary>
        /// The subject line in use - the saved one, or the default when none is saved
        /// </summary>
        public string? Subject { get; set; }

        /// <summary>
        /// The body in use - the saved wording, or the default when none is saved
        /// </summary>
        public string? Body { get; set; }

        /// <summary>
        /// Whether both the subject and body are the built-in defaults
        /// </summary>
        public bool? IsDefault { get; set; }

        /// <summary>
        /// The built-in subject line, for "Reset to default"
        /// </summary>
        public string? DefaultSubject { get; set; }

        /// <summary>
        /// The built-in body, for "Reset to default"
        /// </summary>
        public string? DefaultBody { get; set; }

        /// <summary>
        /// The longest subject line that can be saved
        /// </summary>
        public int? MaxSubjectLength { get; set; }

        /// <summary>
        /// The longest body that can be saved
        /// </summary>
        public int? MaxLength { get; set; }

        /// <summary>
        /// Every placeholder the subject and body can use
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
    /// A placeholder a receipt email can use.
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
    /// A receipt email's subject and body to save or preview.
    /// </summary>
    public class ReceiptEmailBodyDto
    {
        /// <summary>
        /// The subject line; empty for the default, left out to keep the saved one
        /// </summary>
        public string? Subject { get; set; }

        /// <summary>
        /// The wording; empty for the default, left out to keep the saved one
        /// </summary>
        public string? Body { get; set; }
    }

    /// <summary>
    /// What a receipt email looks like for a sample order.
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
        /// The attachment's file name, e.g. CFS-Receipt-1017.pdf
        /// </summary>
        public string? AttachmentName { get; set; }

        /// <summary>
        /// Placeholders that aren't recognised - most likely typos
        /// </summary>
        public List<string>? UnknownPlaceholders { get; set; }
    }

    /// <summary>
    /// The general settings: business details shown on sheets and emails, and dashboard levels.
    /// Every field is optional when saving; one left out keeps its current value.
    /// </summary>
    public class GeneralSettingsDto
    {
        /// <summary>
        /// Shown in the menu bar, on the sign-in screen and as the email sender
        /// </summary>
        public string? AppName { get; set; }

        /// <summary>
        /// Named at the top of every sales sheet and in the receipt email
        /// </summary>
        public string? CompanyName { get; set; }

        /// <summary>
        /// On sales sheets and in emails
        /// </summary>
        public string? CustomerServicePhone { get; set; }

        /// <summary>
        /// Net sales that earn the dashboard's first star
        /// </summary>
        public decimal? StarsFirstAt { get; set; }

        /// <summary>
        /// Net sales between each star after the first
        /// </summary>
        public decimal? StarsEvery { get; set; }

        /// <summary>
        /// This many or fewer left is flagged as running low
        /// </summary>
        public int? LowStockAt { get; set; }

        /// <summary>
        /// The values when nothing has been changed (returned, not saved)
        /// </summary>
        public GeneralSettingsDto? Defaults { get; set; }
    }
}
