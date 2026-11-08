using api.Models;

namespace api.Catalog
{
    /// <summary>
    /// The limits and cleaning rules every way into the catalog shares: the product editor, the
    /// catalog file, copying between territories and the sample catalog.
    /// </summary>
    public static class CatalogRules
    {
        #region Limits

        /// <summary>Longest product name.</summary>
        public const int MaxProductNameLength = 150;

        /// <summary>Longest brand.</summary>
        public const int MaxBrandLength = 100;

        /// <summary>Longest warranty length, e.g. "10 years".</summary>
        public const int MaxWarrantyLength = 60;

        /// <summary>Longest note on a size.</summary>
        public const int MaxSizeNotesLength = 300;

        /// <summary>Longest delivery option name.</summary>
        public const int MaxDeliveryNameLength = 100;

        /// <summary>Highest delivery option price.</summary>
        public const decimal MaxDeliveryPrice = 100_000;

        /// <summary>Longest financing option name.</summary>
        public const int MaxFinanceNameLength = 100;

        /// <summary>Longest category name.</summary>
        public const int MaxCategoryNameLength = 60;

        /// <summary>The tab that shows every category, so no category may take its name.</summary>
        public const string AllCategoriesTab = "All";

        /// <summary>Most of one item a bundle can include.</summary>
        public const int MaxBundleQuantity = 20;

        /// <summary>Why a sale's percent is refused (the product and delivery option editors).</summary>
        public const string SalePercentMessage = "A sale percent must be between 0 and 100.";

        /// <summary>Why a sale's amount is refused (the product and delivery option editors).</summary>
        public const string SaleAmountMessage = "A sale amount can't be negative.";

        /// <summary>Most selections (such as Color) on one product.</summary>
        public const int MaxOptions = 10;

        /// <summary>Longest selection or choice name.</summary>
        public const int MaxOptionNameLength = 50;

        /// <summary>Most choices in one selection.</summary>
        public const int MaxChoices = 50;

        /// <summary>Largest price change for one choice, either way.</summary>
        public const decimal MaxPriceAdjustment = 100_000;

        #endregion

        #region Public Methods

        /// <summary>
        /// Whether a new product has a warranty unless told otherwise: those in a category that
        /// counts as mattresses or adjustable bases do.
        /// </summary>
        /// <param name="column">The stat-sheet column its category counts in</param>
        /// <returns>True for a mattress or a base.</returns>
        public static bool WarrantyByDefault(StatColumn column) =>
            column is StatColumn.Mattress or StatColumn.AdjustableBase;

        /// <summary>
        /// A warranty length as stored: trimmed, at most 60 characters, nothing when blank.
        /// </summary>
        /// <param name="length">What was typed</param>
        /// <returns>The cleaned length, or null.</returns>
        public static string? CleanWarrantyLength(string? length) => Clip(length, MaxWarrantyLength);

        /// <summary>
        /// A size's note as stored: trimmed, at most 300 characters, nothing when blank.
        /// </summary>
        /// <param name="notes">What was typed</param>
        /// <returns>The cleaned note, or null.</returns>
        public static string? CleanSizeNotes(string? notes) => Clip(notes, MaxSizeNotesLength);

        /// <summary>
        /// A sale as stored and as taken onto an order: a percent (at most 100), or else an amount,
        /// or nothing. Zero or less clears it.
        /// </summary>
        /// <param name="percent">Percent off</param>
        /// <param name="amount">Amount off</param>
        /// <returns>Percent and amount off - at most one of them set.</returns>
        public static (decimal? Percent, decimal? Amount) CleanSale(decimal? percent, decimal? amount)
        {
            if (percent is > 0)
                return (Math.Min(percent.Value, 100m), null);
            if (amount is > 0)
                return (null, amount);
            return (null, null);
        }

        /// <summary>
        /// Whether a sale's percent can be saved: none, or 0 to 100.
        /// </summary>
        /// <param name="percent">Percent off</param>
        /// <returns>True when it can.</returns>
        public static bool IsValidSalePercent(decimal? percent) => percent is not (< 0 or > 100);

        /// <summary>
        /// Whether a sale's amount can be saved: none, or 0 or more.
        /// </summary>
        /// <param name="amount">Amount off</param>
        /// <returns>True when it can.</returns>
        public static bool IsValidSaleAmount(decimal? amount) => !(amount < 0);

        /// <summary>
        /// Why some sales can't be saved, for the editors: any bad percent first, then any bad
        /// amount. Null when all of them can.
        /// </summary>
        /// <param name="sales">Percent and amount of each sale</param>
        /// <returns>A message, or null.</returns>
        public static string? SalesProblem(IEnumerable<(decimal? Percent, decimal? Amount)> sales)
        {
            var list = sales.ToList();
            if (list.Any(s => !IsValidSalePercent(s.Percent)))
                return SalePercentMessage;
            if (list.Any(s => !IsValidSaleAmount(s.Amount)))
                return SaleAmountMessage;
            return null;
        }

        /// <summary>
        /// Whether a bundle may include this many of one item: none given, or 1 to 20.
        /// </summary>
        /// <param name="quantity">How many</param>
        /// <returns>True when it may.</returns>
        public static bool IsValidBundleQuantity(int? quantity) => quantity is not (< 1 or > MaxBundleQuantity);

        /// <summary>
        /// Whether a financing option's name, trimmed, is usable: 1 to 100 characters.
        /// </summary>
        /// <param name="trimmed">The trimmed name, or null</param>
        /// <returns>True when it is.</returns>
        public static bool IsValidFinanceName(string? trimmed) => (trimmed?.Length ?? 0) is > 0 and <= MaxFinanceNameLength;

        /// <summary>
        /// What a delivery option costs for a product: the product's own price for it when it has
        /// one, otherwise the option's.
        /// </summary>
        /// <param name="option">The delivery option</param>
        /// <param name="forProduct">The product's entry for the option, if it lists it</param>
        /// <returns>The price.</returns>
        public static decimal DeliveryPrice(DeliveryOption option, ProductDeliveryOption? forProduct) =>
            forProduct?.PriceOverride ?? option.Price;

        /// <summary>
        /// Whether two catalog names (a brand, product, size, configuration, delivery option or
        /// financing option) are the same in a catalog file or a copy between territories:
        /// ignoring case and the spaces around them, with nothing counting as empty.
        /// </summary>
        /// <param name="a">One name</param>
        /// <param name="b">The other</param>
        /// <returns>True when they match.</returns>
        public static bool SameName(string? a, string? b) => NameKey(a) == NameKey(b);

        /// <summary>
        /// A catalog name reduced to what SameName compares: trimmed and lower case; empty for none.
        /// Spacing inside the name counts (the dashboard's sales tally uses a looser key).
        /// </summary>
        /// <param name="value">The name</param>
        /// <returns>The key.</returns>
        public static string NameKey(string? value) => value?.Trim().ToLowerInvariant() ?? "";

        #endregion

        #region Private Methods

        private static string? Clip(string? text, int max)
        {
            var trimmed = text?.Trim();
            if (string.IsNullOrEmpty(trimmed)) return null;
            return trimmed.Length > max ? trimmed[..max] : trimmed;
        }

        #endregion
    }
}
