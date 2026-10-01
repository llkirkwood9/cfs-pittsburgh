using System.Globalization;
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
        public const string DefaultAppName = "CFS Pittsburgh";

        /// <summary>The company's name when none is set.</summary>
        public const string DefaultCompanyName = "Custom Fundraising Solutions";

        /// <summary>The customer service number when none is set.</summary>
        public const string DefaultCustomerServicePhone = "440-381-2888";

        /// <summary>Net sales for the first dashboard star when none is set.</summary>
        public const decimal DefaultStarsFirstAt = 30000m;

        /// <summary>Net sales between stars when none is set.</summary>
        public const decimal DefaultStarsEvery = 10000m;

        /// <summary>The running-low level when none is set.</summary>
        public const int DefaultLowStockAt = 2;

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
            };
            var rows = await db.AppSettings.AsNoTracking()
                .Where(s => keys.Contains(s.Key))
                .ToDictionaryAsync(s => s.Key, s => s.Value);

            string Text(string key, string fallback) =>
                rows.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : fallback;
            decimal Money(string key, decimal fallback) =>
                rows.TryGetValue(key, out var v) && decimal.TryParse(v, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) && d > 0 ? d : fallback;
            int Count(string key, int fallback) =>
                rows.TryGetValue(key, out var v) && int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) && n >= 0 ? n : fallback;

            return new GeneralSettings(
                Text(AppSettingKeys.AppName, DefaultAppName),
                Text(AppSettingKeys.CompanyName, DefaultCompanyName),
                Text(AppSettingKeys.CustomerServicePhone, DefaultCustomerServicePhone),
                Money(AppSettingKeys.StarsFirstAt, DefaultStarsFirstAt),
                Money(AppSettingKeys.StarsEvery, DefaultStarsEvery),
                Count(AppSettingKeys.LowStockAt, DefaultLowStockAt));
        }

        /// <summary>
        /// The general settings as they are when nothing has been changed.
        /// </summary>
        public static GeneralSettings Defaults { get; } = new(
            DefaultAppName, DefaultCompanyName, DefaultCustomerServicePhone,
            DefaultStarsFirstAt, DefaultStarsEvery, DefaultLowStockAt);

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
        public static string Store(decimal value) => value.ToString("0.##", CultureInfo.InvariantCulture);

        /// <summary>
        /// A count written for storing.
        /// </summary>
        public static string Store(int value) => value.ToString(CultureInfo.InvariantCulture);

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
    public record GeneralSettings(
        string AppName,
        string CompanyName,
        string CustomerServicePhone,
        decimal StarsFirstAt,
        decimal StarsEvery,
        int LowStockAt);
}
