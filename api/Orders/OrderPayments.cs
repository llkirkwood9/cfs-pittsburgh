using Microsoft.EntityFrameworkCore;
using api.Data;
using api.Settings;
using api.Utils;

namespace api.Orders
{
    /// <summary>
    /// Rules for the payment rows checkout records against an order.
    /// </summary>
    public static class OrderPayments
    {
        #region Public Fields

        /// <summary>Longest financing number or financing type.</summary>
        public const int MaxReferenceLength = 100;

        /// <summary>Why a financing number or type is refused for its length.</summary>
        public const string TooLongMessage = "The financing number and type can be at most 100 characters.";

        /// <summary>Why a payment amount is refused.</summary>
        public const string AmountMessage = "The payment amount must be greater than zero.";

        #endregion

        #region Public Methods

        /// <summary>
        /// Checks a financing type and spells it as its finance option is, so the same kind always
        /// reads the same on sales sheets. It must be one of the finance options offered in the
        /// order's territory, unless that territory's settings let checkout type in another.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="financeType">Trimmed financing type</param>
        /// <param name="territoryId">The order's territory</param>
        /// <returns>The type to record, or a message for checkout.</returns>
        public static async Task<(string? FinanceType, string? Problem)> ResolveFinanceTypeAsync(
            ApplicationDbContext db, string financeType, int territoryId)
        {
            var lower = financeType.ToLower();
            var option = await db.FinanceOptions
                .Where(f => f.IsActive && f.Name.ToLower() == lower
                            && f.TerritoryId == territoryId)
                .Select(f => f.Name)
                .FirstOrDefaultAsync();
            if (option != null)
                return (option, null);

            return (await SettingsStore.LoadAsync(db, territoryId)).AllowOtherFinanceType
                ? (financeType, null)
                : (null, "Choose one of the financing options.");
        }

        #endregion
    }
}
