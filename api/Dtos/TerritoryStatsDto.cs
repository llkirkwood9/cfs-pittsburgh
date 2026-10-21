namespace api.Dtos
{
    /// <summary>
    /// One territory's row on the all-territories comparison: the headline figures from its
    /// completed sales over the chosen dates.
    /// </summary>
    public class TerritoryStatsDto
    {
        /// <summary>
        /// The territory
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// Its name
        /// </summary>
        public string? TerritoryName { get; set; }

        /// <summary>
        /// Whether it is switched on
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// Organization of its active event, if one is running
        /// </summary>
        public string? ActiveEvent { get; set; }

        /// <summary>
        /// Events with at least one sale in the dates
        /// </summary>
        public int? EventCount { get; set; }

        /// <summary>
        /// Completed sales
        /// </summary>
        public int? CompletedOrderCount { get; set; }

        /// <summary>
        /// Total of completed sales, including tax and card fees
        /// </summary>
        public decimal? TotalSales { get; set; }

        /// <summary>
        /// Merchandise subtotal of completed sales
        /// </summary>
        public decimal? NetSales { get; set; }

        /// <summary>
        /// Total sales divided by completed sales
        /// </summary>
        public decimal? AverageSale { get; set; }

        /// <summary>
        /// Mattresses sold
        /// </summary>
        public int? MattressCount { get; set; }

        /// <summary>
        /// Adjustable bases sold, including those in sets
        /// </summary>
        public int? AdjustableBaseCount { get; set; }

        /// <summary>
        /// Balance still owed on completed sales
        /// </summary>
        public decimal? OutstandingBalance { get; set; }
    }
}
