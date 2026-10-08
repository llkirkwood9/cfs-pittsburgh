using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A setting an administrator can change from the dashboard, such as the wording of the
    /// receipt email. A setting with no row uses its built-in default.
    /// </summary>
    public class AppSetting
    {
        /// <summary>
        /// Which setting this is, e.g. "ReceiptEmailBody"
        /// </summary>
        [Key]
        [MaxLength(100)]
        public string Key { get; set; } = string.Empty;

        /// <summary>
        /// The saved value
        /// </summary>
        public string Value { get; set; } = string.Empty;

        /// <summary>
        /// When it was last saved (UTC)
        /// </summary>
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Who last saved it
        /// </summary>
        [MaxLength(150)]
        public string? UpdatedBy { get; set; }
    }

    /// <summary>
    /// The keys of the settings stored in AppSettings.
    /// </summary>
    public static class AppSettingKeys
    {
        /// <summary>
        /// The body of the email that goes with a customer's receipt
        /// </summary>
        public const string ReceiptEmailBody = "ReceiptEmailBody";

        /// <summary>
        /// The subject line of the receipt email
        /// </summary>
        public const string ReceiptEmailSubject = "ReceiptEmailSubject";

        /// <summary>
        /// The app's name in the menu bar, on the sign-in screen and as the email sender
        /// </summary>
        public const string AppName = "AppName";

        /// <summary>
        /// The company named at the top of every sales sheet and in the receipt email
        /// </summary>
        public const string CompanyName = "CompanyName";

        /// <summary>
        /// The customer service number on sales sheets and in emails
        /// </summary>
        public const string CustomerServicePhone = "CustomerServicePhone";

        /// <summary>
        /// Net sales that earn the dashboard's first star
        /// </summary>
        public const string StarsFirstAt = "StarsFirstAt";

        /// <summary>
        /// Net sales between each star after the first
        /// </summary>
        public const string StarsEvery = "StarsEvery";

        /// <summary>
        /// A counted item with this many or fewer left is flagged as running low
        /// </summary>
        public const string LowStockAt = "LowStockAt";

        /// <summary>
        /// The sales tax rate a new event starts with
        /// </summary>
        public const string DefaultSalesTaxRate = "DefaultSalesTaxRate";

        /// <summary>
        /// The card processing fee a new event starts with
        /// </summary>
        public const string DefaultCcProcessingFeeRate = "DefaultCcProcessingFeeRate";

        /// <summary>
        /// The four statements a customer initials, as JSON
        /// </summary>
        public const string SalesSheetTerms = "SalesSheetTerms";

        /// <summary>
        /// The kinds of financing offered at checkout, as a JSON list. No longer used: the options
        /// are kept in the FinanceOptions table, and the migration that made it moved them there.
        /// </summary>
        public const string FinanceOptions = "FinanceOptions";

        /// <summary>
        /// Whether checkout may type in a financing type that isn't one of the finance options
        /// </summary>
        public const string AllowOtherFinanceType = "AllowOtherFinanceType";
    }
}
