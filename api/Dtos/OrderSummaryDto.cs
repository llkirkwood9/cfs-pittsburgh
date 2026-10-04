namespace api.Dtos
{
    /// <summary>
    /// Lightweight order shape for the floor queue, the checkout queue and the day's sales list.
    /// Avoids shipping every address and line item just to render a tile.
    /// </summary>
    public class OrderSummaryDto
    {
        /// <summary>
        /// Primary Key - ID of order
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// FK to the event
        /// </summary>
        public int? EventId { get; set; }

        /// <summary>
        /// The event's territory (returned, not saved)
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// The territory's name (returned, not saved)
        /// </summary>
        public string? TerritoryName { get; set; }

        /// <summary>
        /// Sequential number printed on the sheet
        /// </summary>
        public int? OrderNumber { get; set; }

        /// <summary>
        /// Organization of the owning event
        /// </summary>
        public string? EventOrganization { get; set; }

        /// <summary>
        /// Date of the owning event
        /// </summary>
        public DateTime? EventDate { get; set; }

        /// <summary>
        /// Draft, AwaitingCheckout, Completed or Voided
        /// </summary>
        public string? Status { get; set; }

        /// <summary>
        /// Free-text label used to tell concurrent drafts apart
        /// </summary>
        public string? DraftLabel { get; set; }

        /// <summary>
        /// Customer name from the billing block
        /// </summary>
        public string? BillingName { get; set; }

        /// <summary>
        /// CFS Rep Name cell
        /// </summary>
        public string? CfsRepName { get; set; }

        /// <summary>
        /// Customer's cell number, for looking an order up by phone
        /// </summary>
        public string? BillingCell { get; set; }

        /// <summary>
        /// Customer's other number
        /// </summary>
        public string? BillingAlt { get; set; }

        /// <summary>
        /// Customer's email, for looking an order up by email
        /// </summary>
        public string? BillingEmail { get; set; }

        /// <summary>
        /// Number of line items on the order
        /// </summary>
        public int? LineCount { get; set; }

        /// <summary>
        /// Subtotal before tax
        /// </summary>
        public decimal? Subtotal { get; set; }

        /// <summary>
        /// Grand total including tax and any card fee
        /// </summary>
        public decimal? Total { get; set; }

        /// <summary>
        /// Outstanding balance
        /// </summary>
        public decimal? BalanceDue { get; set; }

        /// <summary>
        /// When the draft was opened
        /// </summary>
        public DateTime? CreatedAt { get; set; }

        /// <summary>
        /// When the rep handed the order to checkout
        /// </summary>
        public DateTime? SubmittedAt { get; set; }

        /// <summary>
        /// When checkout finished the sale
        /// </summary>
        public DateTime? CompletedAt { get; set; }

        /// <summary>
        /// Last time any field changed
        /// </summary>
        public DateTime? UpdatedAt { get; set; }
    }
}
