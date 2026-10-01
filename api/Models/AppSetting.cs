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
    }
}
