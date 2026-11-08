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
        /// Whether a new product of a category has a warranty unless told otherwise: mattresses and
        /// adjustable bases do.
        /// </summary>
        /// <param name="category">The product's category</param>
        /// <returns>True for a mattress or a base.</returns>
        public static bool WarrantyByDefault(ProductCategory category) =>
            category is ProductCategory.Mattress or ProductCategory.AdjustableBase;

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
        /// What a delivery option costs for a product: the product's own price for it when it has
        /// one, otherwise the option's.
        /// </summary>
        /// <param name="option">The delivery option</param>
        /// <param name="forProduct">The product's entry for the option, if it lists it</param>
        /// <returns>The price.</returns>
        public static decimal DeliveryPrice(DeliveryOption option, ProductDeliveryOption? forProduct) =>
            forProduct?.PriceOverride ?? option.Price;

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
