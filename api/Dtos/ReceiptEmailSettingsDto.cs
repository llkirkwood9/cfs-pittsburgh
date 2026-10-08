namespace api.Dtos
{
    /// <summary>
    /// The receipt email's wording, as the settings screen sees it.
    /// </summary>
    public class ReceiptEmailSettingsDto
    {
        /// <summary>
        /// The territory these settings are for; null for the company-wide settings
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// Whether the signed-in user may change them (returned, not saved)
        /// </summary>
        public bool? CanEdit { get; set; }

        /// <summary>
        /// The subject line in use - the saved one, or the default when none is saved
        /// </summary>
        public string? Subject { get; set; }

        /// <summary>
        /// The body in use - the saved wording, or the default when none is saved
        /// </summary>
        public string? Body { get; set; }

        /// <summary>
        /// Whether neither the subject nor the body has its own value here: company-wide, that
        /// means the built-in wording; for a territory, the company-wide wording
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
    /// One statement a customer initials, on the sales sheet and on their initialling screen.
    /// </summary>
    public class SalesTermDto
    {
        /// <summary>
        /// customerInfo, warranty, dropShip or advisory - which initials it takes
        /// </summary>
        public string? Key { get; set; }

        /// <summary>
        /// The heading on the customer's initialling screen
        /// </summary>
        public string? Title { get; set; }

        /// <summary>
        /// The underlined heading on the sales sheet; may be empty
        /// </summary>
        public string? Heading { get; set; }

        /// <summary>
        /// The paragraph, the same in both places. **bold** and __underline__ allowed.
        /// </summary>
        public string? Text { get; set; }
    }

    /// <summary>
    /// The general settings: business details shown on sheets and emails, and dashboard levels.
    /// Every field is optional when saving; one left out keeps its current value.
    /// </summary>
    public class GeneralSettingsDto
    {
        /// <summary>
        /// The territory these settings are for; null for the company-wide settings
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// Whether the signed-in user may change them (returned, not saved)
        /// </summary>
        public bool? CanEdit { get; set; }

        /// <summary>
        /// The settings a territory has its own value for (returned, not saved). Anything not
        /// listed follows the company-wide value.
        /// </summary>
        public List<string>? Overridden { get; set; }

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
        /// The sales tax rate a new event starts with, e.g. 0.07
        /// </summary>
        public decimal? DefaultSalesTaxRate { get; set; }

        /// <summary>
        /// The card processing fee a new event starts with, e.g. 0.02
        /// </summary>
        public decimal? DefaultCcProcessingFeeRate { get; set; }

        /// <summary>
        /// The four statements a customer initials, in signing order
        /// </summary>
        public List<SalesTermDto>? Terms { get; set; }

        /// <summary>
        /// The kinds of financing offered, picked at checkout when a sale is financed. Null on
        /// write leaves them unchanged.
        /// </summary>
        public List<string>? FinanceOptions { get; set; }

        /// <summary>
        /// What each setting would be without this scope's own values (returned, not saved): the
        /// built-in defaults company-wide, the company-wide values for a territory
        /// </summary>
        public GeneralSettingsDto? Defaults { get; set; }
    }
}
