namespace api.Dtos
{
    /// <summary>
    /// One event's headline figures, for the dashboard's overview of every event.
    /// </summary>
    public class EventTallyDto
    {
        /// <summary>
        /// FK to the event
        /// </summary>
        public int EventId { get; set; }

        /// <summary>
        /// Sponsoring organization
        /// </summary>
        public string? Organization { get; set; }

        /// <summary>
        /// Date of the event
        /// </summary>
        public DateTime? EventDate { get; set; }

        /// <summary>
        /// Whether the event is currently taking orders
        /// </summary>
        public bool IsActive { get; set; }

        /// <summary>
        /// Completed orders
        /// </summary>
        public int CompletedOrderCount { get; set; }

        /// <summary>
        /// Mattresses plus adjustable bases sold
        /// </summary>
        public int MattressAndBaseCount { get; set; }

        /// <summary>
        /// Product revenue before tax
        /// </summary>
        public decimal NetSales { get; set; }

        /// <summary>
        /// Total collected, including tax
        /// </summary>
        public decimal TotalSales { get; set; }

        /// <summary>
        /// Total sales divided by completed orders
        /// </summary>
        public decimal AverageSale { get; set; }
    }
}
