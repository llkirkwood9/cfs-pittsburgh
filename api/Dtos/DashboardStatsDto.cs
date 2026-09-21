namespace api.Dtos
{
    /// <summary>
    /// The School Stat Sheet, computed. Every field here corresponds to a box on the paper sheet
    /// the crew fills in at the end of an event.
    /// </summary>
    public class DashboardStatsDto
    {
        #region Context

        /// <summary>
        /// FK to the event these figures cover, null when the figures span all events for a date
        /// </summary>
        public int? EventId { get; set; }

        /// <summary>
        /// School name of the event
        /// </summary>
        public string? SchoolName { get; set; }

        /// <summary>
        /// Sponsoring organization
        /// </summary>
        public string? Organization { get; set; }

        /// <summary>
        /// Date the figures cover
        /// </summary>
        public DateTime? EventDate { get; set; }

        #endregion

        #region Unit Tallies

        /// <summary>
        /// Mattresses sold, including Purple and Helix
        /// </summary>
        public int? MattressCount { get; set; }

        /// <summary>
        /// Purple mattresses, a subset of the mattress count
        /// </summary>
        public int? PurpleCount { get; set; }

        /// <summary>
        /// Helix mattresses, a subset of the mattress count
        /// </summary>
        public int? HelixCount { get; set; }

        /// <summary>
        /// Adjustable bases sold
        /// </summary>
        public int? AdjustableBaseCount { get; set; }

        /// <summary>
        /// Mattress protectors sold
        /// </summary>
        public int? MattressProtectorCount { get; set; }

        /// <summary>
        /// Pillows sold
        /// </summary>
        public int? PillowCount { get; set; }

        /// <summary>
        /// Sheet sets sold
        /// </summary>
        public int? SheetCount { get; set; }

        /// <summary>
        /// Frames sold
        /// </summary>
        public int? FrameCount { get; set; }

        /// <summary>
        /// Bean bag chairs sold
        /// </summary>
        public int? BeanBagChairCount { get; set; }

        /// <summary>
        /// Uncategorized items sold
        /// </summary>
        public int? MiscCount { get; set; }

        /// <summary>
        /// "# OF MATTS/ADJ. BASES" box - mattresses plus adjustable bases
        /// </summary>
        public int? MattressAndBaseCount { get; set; }

        #endregion

        #region Money

        /// <summary>
        /// TOTAL SALES box - everything collected including tax and card fees
        /// </summary>
        public decimal? TotalSales { get; set; }

        /// <summary>
        /// Net product revenue before tax and card fees
        /// </summary>
        public decimal? NetSales { get; set; }

        /// <summary>
        /// Sales tax collected
        /// </summary>
        public decimal? TaxCollected { get; set; }

        /// <summary>
        /// Card processing fees collected
        /// </summary>
        public decimal? CcProcessingFees { get; set; }

        /// <summary>
        /// AVERAGE SALE box - total sales divided by completed order count
        /// </summary>
        public decimal? AverageSale { get; set; }

        /// <summary>
        /// Outstanding balance across completed orders
        /// </summary>
        public decimal? OutstandingBalance { get; set; }

        #endregion

        #region Payment Buckets

        /// <summary>
        /// CREDIT CARDS box
        /// </summary>
        public decimal? CreditCardTotal { get; set; }

        /// <summary>
        /// CASH box
        /// </summary>
        public decimal? CashTotal { get; set; }

        /// <summary>
        /// CHECKS box
        /// </summary>
        public decimal? CheckTotal { get; set; }

        /// <summary>
        /// FINANCING BALANCE box
        /// </summary>
        public decimal? FinancingTotal { get; set; }

        /// <summary>
        /// LAYAWAY BALANCE box
        /// </summary>
        public decimal? LayawayTotal { get; set; }

        #endregion

        #region Order Counts

        /// <summary>
        /// Completed orders counted in these figures
        /// </summary>
        public int? CompletedOrderCount { get; set; }

        /// <summary>
        /// Orders still open on the sales floor
        /// </summary>
        public int? DraftOrderCount { get; set; }

        /// <summary>
        /// Orders waiting at the checkout table
        /// </summary>
        public int? AwaitingCheckoutCount { get; set; }

        /// <summary>
        /// Voided orders, excluded from every money figure above
        /// </summary>
        public int? VoidedOrderCount { get; set; }

        #endregion

        #region Breakdowns

        /// <summary>
        /// Units sold per product, best sellers first
        /// </summary>
        public List<ProductTallyDto>? TopProducts { get; set; }

        /// <summary>
        /// Completed sales per rep
        /// </summary>
        public List<RepTallyDto>? RepTotals { get; set; }

        #endregion
    }
}
