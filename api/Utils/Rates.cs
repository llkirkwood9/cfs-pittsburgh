namespace api.Utils
{
    /// <summary>
    /// The sales tax and card processing fee rates an event or an order carries, as fractions
    /// (0.07 = 7%).
    /// </summary>
    public static class Rates
    {
        /// <summary>
        /// Why a sales tax or card fee rate can't be used, or null when both can: each, when
        /// given, must be from 0 to 1.
        /// </summary>
        /// <param name="salesTaxRate">The sales tax rate, if sent</param>
        /// <param name="ccProcessingFeeRate">The card processing fee rate, if sent</param>
        /// <returns>A message, or null.</returns>
        public static string? Problem(decimal? salesTaxRate, decimal? ccProcessingFeeRate)
        {
            if (salesTaxRate is < 0 or > 1)
                return "The sales tax rate must be between 0 and 1.";

            if (ccProcessingFeeRate is < 0 or > 1)
                return "The card processing fee rate must be between 0 and 1.";

            return null;
        }
    }
}
