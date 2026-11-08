using System.Globalization;
using api.Data;
using api.Models;
using api.Utils;
using Microsoft.EntityFrameworkCore;

namespace api.Settings
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
        public const decimal DefaultSalesTaxRate = Event.DefaultSalesTaxRate;

        /// <summary>A new event's card processing fee when none is set: 2%.</summary>
        public const decimal DefaultCcProcessingFeeRate = Event.DefaultCcProcessingFeeRate;

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

        #endregion

        #region Public Methods

        /// <summary>
        /// Every general setting in force for a territory - its own overrides, then the
        /// company-wide values, then the defaults - or the company-wide settings when no territory
        /// is given. The app name is always company-wide.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory, or null for company-wide</param>
        /// <returns>The settings in force.</returns>
        public static async Task<GeneralSettings> LoadAsync(ApplicationDbContext db, int? territoryId = null)
        {
            var rows = await RowsAsync(db, territoryId, GeneralKeys);

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
                SalesTerms.Read(rows.GetValueOrDefault(AppSettingKeys.SalesSheetTerms)),
                Flag(AppSettingKeys.AllowOtherFinanceType, DefaultAllowOtherFinanceType));
        }

        /// <summary>
        /// The raw stored values for some keys: the company-wide row, overlaid by the territory's own
        /// row where it has one. The app name is never taken from a territory.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory, or null for company-wide only</param>
        /// <param name="keys">Which settings</param>
        /// <returns>Key to stored value; keys with no row are left out.</returns>
        public static async Task<Dictionary<string, string>> RowsAsync(ApplicationDbContext db, int? territoryId, IReadOnlyCollection<string> keys)
        {
            var rows = await db.AppSettings.AsNoTracking()
                .Where(s => keys.Contains(s.Key))
                .ToDictionaryAsync(s => s.Key, s => s.Value);

            if (territoryId != null)
            {
                var own = await db.TerritorySettings.AsNoTracking()
                    .Where(s => s.TerritoryId == territoryId && keys.Contains(s.Key) && s.Key != AppSettingKeys.AppName)
                    .ToListAsync();
                foreach (var row in own)
                    rows[row.Key] = row.Value;
            }

            return rows;
        }

        /// <summary>The keys of the receipt email's subject and wording.</summary>
        public static readonly string[] ReceiptEmailKeys = [AppSettingKeys.ReceiptEmailBody, AppSettingKeys.ReceiptEmailSubject];

        /// <summary>
        /// The receipt email's subject and wording in force for a territory (or company-wide); null
        /// for either means the built-in wording.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory, or null for company-wide</param>
        /// <returns>The subject and body.</returns>
        public static async Task<(string? Subject, string? Body)> LoadReceiptEmailAsync(ApplicationDbContext db, int? territoryId)
        {
            var rows = await RowsAsync(db, territoryId, ReceiptEmailKeys);
            return (rows.GetValueOrDefault(AppSettingKeys.ReceiptEmailSubject), rows.GetValueOrDefault(AppSettingKeys.ReceiptEmailBody));
        }

        /// <summary>
        /// One scope's own rows for some keys, with who changed them and when: the company-wide
        /// rows, or a territory's - without falling back from one to the other.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory, or null for company-wide</param>
        /// <param name="keys">Which settings</param>
        /// <returns>The rows that exist.</returns>
        public static async Task<List<(string Key, string Value, DateTime UpdatedAt, string? UpdatedBy)>> OwnRowsAsync(
            ApplicationDbContext db, int? territoryId, IReadOnlyCollection<string> keys)
        {
            return territoryId == null
                ? (await db.AppSettings.AsNoTracking()
                    .Where(s => keys.Contains(s.Key))
                    .ToListAsync())
                    .Select(s => (s.Key, s.Value, s.UpdatedAt, s.UpdatedBy)).ToList()
                : (await db.TerritorySettings.AsNoTracking()
                    .Where(s => s.TerritoryId == territoryId && keys.Contains(s.Key))
                    .ToListAsync())
                    .Select(s => (s.Key, s.Value, s.UpdatedAt, s.UpdatedBy)).ToList();
        }

        /// <summary>
        /// Which settings a territory has its own value for.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory</param>
        /// <returns>The keys it overrides.</returns>
        public static async Task<List<string>> OverriddenKeysAsync(ApplicationDbContext db, int territoryId)
        {
            return await db.TerritorySettings.AsNoTracking()
                .Where(s => s.TerritoryId == territoryId)
                .Select(s => s.Key)
                .ToListAsync();
        }

        /// <summary>The keys LoadAsync reads.</summary>
        public static readonly string[] GeneralKeys =
        [
            AppSettingKeys.AppName, AppSettingKeys.CompanyName, AppSettingKeys.CustomerServicePhone,
            AppSettingKeys.StarsFirstAt, AppSettingKeys.StarsEvery, AppSettingKeys.LowStockAt,
            AppSettingKeys.DefaultSalesTaxRate, AppSettingKeys.DefaultCcProcessingFeeRate,
            AppSettingKeys.SalesSheetTerms, AppSettingKeys.AllowOtherFinanceType,
        ];

        /// <summary>
        /// The general settings as they are when nothing has been changed.
        /// </summary>
        public static GeneralSettings Defaults { get; } = new(
            DefaultAppName, DefaultCompanyName, DefaultCustomerServicePhone,
            DefaultStarsFirstAt, DefaultStarsEvery, DefaultLowStockAt,
            DefaultSalesTaxRate, DefaultCcProcessingFeeRate, SalesTerms.Defaults, DefaultAllowOtherFinanceType);

        /// <summary>
        /// Saves one setting, or removes its row when the value is empty or the same as what it
        /// would otherwise be. For a territory, "otherwise" is the company-wide value, so a
        /// territory that sets a setting back to the company's simply follows the company again.
        /// The caller saves the changes.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="key">Which setting</param>
        /// <param name="value">The new value</param>
        /// <param name="defaultValue">What it is without a row: the default, or for a territory the company-wide value</param>
        /// <param name="updatedBy">Who changed it</param>
        /// <param name="territoryId">The territory, or null for company-wide</param>
        public static async Task SetAsync(ApplicationDbContext db, string key, string? value, string defaultValue, string? updatedBy, int? territoryId = null)
        {
            if (territoryId != null)
            {
                await SetTerritoryAsync(db, territoryId.Value, key, value, defaultValue, updatedBy);
                return;
            }

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

        private static async Task SetTerritoryAsync(ApplicationDbContext db, int territoryId, string key, string? value, string companyValue, string? updatedBy)
        {
            var row = await db.TerritorySettings.FirstOrDefaultAsync(s => s.TerritoryId == territoryId && s.Key == key);
            if (string.IsNullOrWhiteSpace(value) || value == companyValue)
            {
                if (row != null)
                    db.TerritorySettings.Remove(row);
                return;
            }

            if (row == null)
            {
                row = new TerritorySetting { TerritoryId = territoryId, Key = key };
                db.TerritorySettings.Add(row);
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
        /// A yes/no setting written for storing.
        /// </summary>
        public static string Store(bool value) => value ? "true" : "false";

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
}
