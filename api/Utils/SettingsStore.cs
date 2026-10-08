using System.Globalization;
using System.Text.Json;
using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Utils
{
    /// <summary>
    /// The settings an administrator changes from the dashboard, with their defaults. Only a
    /// setting that differs from its default has a row in AppSettings, so a later change to a
    /// default reaches everyone who never changed it.
    /// </summary>
    public static class SettingsStore
    {
        #region Public Fields

        /// <summary>The app's name when none is set.</summary>
        public const string DefaultAppName = "CFS";

        /// <summary>The company's name when none is set.</summary>
        public const string DefaultCompanyName = "CFS";

        /// <summary>The customer service number when none is set.</summary>
        public const string DefaultCustomerServicePhone = "440-381-2888";

        /// <summary>Net sales for the first dashboard star when none is set.</summary>
        public const decimal DefaultStarsFirstAt = 30000m;

        /// <summary>Net sales between stars when none is set.</summary>
        public const decimal DefaultStarsEvery = 10000m;

        /// <summary>The running-low level when none is set.</summary>
        public const int DefaultLowStockAt = 2;

        /// <summary>A new event's sales tax rate when none is set: 7%.</summary>
        public const decimal DefaultSalesTaxRate = 0.07m;

        /// <summary>A new event's card processing fee when none is set: 2%.</summary>
        public const decimal DefaultCcProcessingFeeRate = 0.02m;

        /// <summary>Longest app name: it has to fit in the menu bar.</summary>
        public const int MaxAppNameLength = 30;

        /// <summary>Longest company name: it has to fit across the top of a sales sheet.</summary>
        public const int MaxCompanyNameLength = 60;

        /// <summary>Longest customer service number.</summary>
        public const int MaxPhoneLength = 30;

        /// <summary>Largest star amount, to keep typos like an extra zero or two in check.</summary>
        public const decimal MaxStarAmount = 10_000_000m;

        /// <summary>Highest running-low level.</summary>
        public const int MaxLowStockAt = 999;

        /// <summary>Highest default tax or card fee rate (25%), to catch "7" typed for "0.07".</summary>
        public const decimal MaxDefaultRate = 0.25m;

        /// <summary>Longest title or heading for a term.</summary>
        public const int MaxTermHeadingLength = 60;

        /// <summary>Longest term paragraph: each one has to fit on the one-page sales sheet.</summary>
        public const int MaxTermTextLength = 1200;

        /// <summary>
        /// Whether checkout may type in a financing type that isn't one of the finance options,
        /// when not set: yes.
        /// </summary>
        public const bool DefaultAllowOtherFinanceType = true;

        /// <summary>
        /// The four statements a customer initials, in the order they're signed. The keys match
        /// the order's initials fields, so there are always exactly these four.
        /// </summary>
        public static readonly IReadOnlyList<SalesTerm> DefaultTerms =
        [
            new("customerInfo", "Check your details", "",
                "Customer confirms the name, address, phone, email and delivery details above are correct."),
            new("warranty", "Warranty & mattress protectors", "Customer Service & Warranty Information",
                "All products come with a manufacturer warranty. Customer service and warranty issues are the responsibility of the manufacturer. " +
                "All manufacturers require the use of mattress protectors. They reserve the right to refuse service or invalidate the warranty if there are " +
                "any stains or soils present even if the product is defective. Customer has been notified that sleep sets must be clean, free of tears, " +
                "burns, odors, pet hair and stains of any kind for the warranty to be valid. In addition, manufacturer warranties only cover the cost of " +
                "the replacement item, not additional expenses such as delivery or set-up."),
            new("dropShip", "How your bed arrives", "Drop Ship Delivery",
                "**ALL ITEMS WILL BE DROP SHIPPED DIRECTLY TO THE CUSTOMER UNLESS OTHERWISE NOTED.** Items do not require a signature when delivered. " +
                "The mattress will be compressed, vacuum sealed and boxed. The product may be heavy and may require additional persons to move it. " +
                "Once open, the bed will completely recover within 24-48 hours, however, sleeping on it sooner will not damage the bed."),
            new("advisory", "All sales are final", "Advisory",
                "Customer acknowledges and understands that this is a sanctioned fundraising event with a portion of the proceeds allocated " +
                "directly to the above mentioned organization and therefore, **__ALL SALES AND TRANSACTIONS ARE FINAL__**."),
        ];

        #endregion

        #region Public Methods

        /// <summary>
        /// Every general setting, with defaults filled in for those never changed.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <returns>The settings in force.</returns>
        public static async Task<GeneralSettings> LoadAsync(ApplicationDbContext db)
        {
            var keys = new[]
            {
                AppSettingKeys.AppName, AppSettingKeys.CompanyName, AppSettingKeys.CustomerServicePhone,
                AppSettingKeys.StarsFirstAt, AppSettingKeys.StarsEvery, AppSettingKeys.LowStockAt,
                AppSettingKeys.DefaultSalesTaxRate, AppSettingKeys.DefaultCcProcessingFeeRate,
                AppSettingKeys.SalesSheetTerms, AppSettingKeys.AllowOtherFinanceType,
            };
            var rows = await db.AppSettings.AsNoTracking()
                .Where(s => keys.Contains(s.Key))
                .ToDictionaryAsync(s => s.Key, s => s.Value);

            string Text(string key, string fallback) =>
                rows.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : fallback;
            decimal Amount(string key, decimal fallback, bool allowZero = false) =>
                rows.TryGetValue(key, out var v) && decimal.TryParse(v, NumberStyles.Number, CultureInfo.InvariantCulture, out var d)
                    && (d > 0 || (allowZero && d == 0)) ? d : fallback;
            bool Flag(string key, bool fallback) =>
                rows.TryGetValue(key, out var v) && bool.TryParse(v, out var f) ? f : fallback;
            int Count(string key, int fallback) =>
                rows.TryGetValue(key, out var v) && int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) && n >= 0 ? n : fallback;

            return new GeneralSettings(
                Text(AppSettingKeys.AppName, DefaultAppName),
                Text(AppSettingKeys.CompanyName, DefaultCompanyName),
                Text(AppSettingKeys.CustomerServicePhone, DefaultCustomerServicePhone),
                Amount(AppSettingKeys.StarsFirstAt, DefaultStarsFirstAt),
                Amount(AppSettingKeys.StarsEvery, DefaultStarsEvery),
                Count(AppSettingKeys.LowStockAt, DefaultLowStockAt),
                Amount(AppSettingKeys.DefaultSalesTaxRate, DefaultSalesTaxRate, allowZero: true),
                Amount(AppSettingKeys.DefaultCcProcessingFeeRate, DefaultCcProcessingFeeRate, allowZero: true),
                ReadTerms(rows.GetValueOrDefault(AppSettingKeys.SalesSheetTerms)),
                Flag(AppSettingKeys.AllowOtherFinanceType, DefaultAllowOtherFinanceType));
        }

        /// <summary>
        /// The general settings as they are when nothing has been changed.
        /// </summary>
        public static GeneralSettings Defaults { get; } = new(
            DefaultAppName, DefaultCompanyName, DefaultCustomerServicePhone,
            DefaultStarsFirstAt, DefaultStarsEvery, DefaultLowStockAt,
            DefaultSalesTaxRate, DefaultCcProcessingFeeRate, DefaultTerms, DefaultAllowOtherFinanceType);

        /// <summary>
        /// Saves one setting, or removes its row when the value is empty or the default. The
        /// caller saves the changes.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="key">Which setting</param>
        /// <param name="value">The new value</param>
        /// <param name="defaultValue">Its default</param>
        /// <param name="updatedBy">Who changed it</param>
        public static async Task SetAsync(ApplicationDbContext db, string key, string? value, string defaultValue, string? updatedBy)
        {
            var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key);
            if (string.IsNullOrWhiteSpace(value) || value == defaultValue)
            {
                if (row != null)
                    db.AppSettings.Remove(row);
                return;
            }

            if (row == null)
            {
                row = new AppSetting { Key = key };
                db.AppSettings.Add(row);
            }
            if (row.Value == value)
                return;
            row.Value = value;
            row.UpdatedAt = DateTime.UtcNow;
            row.UpdatedBy = updatedBy;
        }

        /// <summary>
        /// A number written the same way whatever the server's language, for storing.
        /// </summary>
        public static string Store(decimal value) => value.ToString("0.####", CultureInfo.InvariantCulture);

        /// <summary>
        /// A count written for storing.
        /// </summary>
        public static string Store(int value) => value.ToString(CultureInfo.InvariantCulture);

        /// <summary>
        /// Terms written for storing (and for a completed order's copy).
        /// </summary>
        public static string Store(IEnumerable<SalesTerm> terms) => JsonSerializer.Serialize(terms.ToList(), JsonOptions);

        /// <summary>
        /// A yes/no setting written for storing.
        /// </summary>
        public static string Store(bool value) => value ? "true" : "false";

        /// <summary>
        /// Reads stored terms. Any of the four that is missing or blank falls back to its
        /// default, and anything else is ignored, so there are always exactly the four.
        /// </summary>
        /// <param name="json">Stored terms, or null</param>
        /// <returns>The four terms, in signing order.</returns>
        public static IReadOnlyList<SalesTerm> ReadTerms(string? json)
        {
            List<SalesTerm>? saved = null;
            if (!string.IsNullOrWhiteSpace(json))
            {
                try
                {
                    saved = JsonSerializer.Deserialize<List<SalesTerm>>(json, JsonOptions);
                }
                catch (JsonException)
                {
                    saved = null;
                }
            }

            return DefaultTerms.Select(d =>
            {
                var s = saved?.FirstOrDefault(t => t.Key == d.Key);
                return s == null || string.IsNullOrWhiteSpace(s.Text)
                    ? d
                    : new SalesTerm(d.Key, string.IsNullOrWhiteSpace(s.Title) ? d.Title : s.Title.Trim(), s.Heading?.Trim() ?? "", s.Text.Trim());
            }).ToList();
        }

        #endregion

        #region Private Fields

        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        #endregion
    }

    /// <summary>
    /// The general settings in force.
    /// </summary>
    /// <param name="AppName">Shown in the menu bar, on the sign-in screen and as the email sender</param>
    /// <param name="CompanyName">Named at the top of every sales sheet and in the receipt email</param>
    /// <param name="CustomerServicePhone">On sales sheets and in emails</param>
    /// <param name="StarsFirstAt">Net sales that earn the dashboard's first star</param>
    /// <param name="StarsEvery">Net sales between each star after the first</param>
    /// <param name="LowStockAt">This many or fewer left is flagged as running low</param>
    /// <param name="DefaultSalesTaxRate">A new event's sales tax rate, e.g. 0.07</param>
    /// <param name="DefaultCcProcessingFeeRate">A new event's card processing fee, e.g. 0.02</param>
    /// <param name="Terms">The four statements a customer initials</param>
    /// <param name="AllowOtherFinanceType">Whether checkout may type in a financing type that isn't a finance option</param>
    public record GeneralSettings(
        string AppName,
        string CompanyName,
        string CustomerServicePhone,
        decimal StarsFirstAt,
        decimal StarsEvery,
        int LowStockAt,
        decimal DefaultSalesTaxRate,
        decimal DefaultCcProcessingFeeRate,
        IReadOnlyList<SalesTerm> Terms,
        bool AllowOtherFinanceType);

    /// <summary>
    /// One statement the customer initials, on the sales sheet and on their initialling screen.
    /// </summary>
    /// <param name="Key">customerInfo, warranty, dropShip or advisory - which initials it takes</param>
    /// <param name="Title">The heading on the customer's initialling screen</param>
    /// <param name="Heading">The underlined heading on the sales sheet; may be empty</param>
    /// <param name="Text">The paragraph, the same in both places. **bold** and __underline__ allowed.</param>
    public record SalesTerm(string Key, string Title, string Heading, string Text);
}
