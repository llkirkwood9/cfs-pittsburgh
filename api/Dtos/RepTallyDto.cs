namespace api.Dtos
{
    /// <summary>
    /// Completed sales for one rep on the dashboard breakdown.
    /// </summary>
    public class RepTallyDto
    {
        /// <summary>
        /// Rep name as written on the sheets
        /// </summary>
        public string? RepName { get; set; }

        /// <summary>
        /// Completed orders
        /// </summary>
        public int? OrderCount { get; set; }

        /// <summary>
        /// Total collected
        /// </summary>
        public decimal? Total { get; set; }

        /// <summary>
        /// Average sale for this rep
        /// </summary>
        public decimal? AverageSale { get; set; }
    }
}
