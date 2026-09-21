namespace api.Dtos
{
    /// <summary>
    /// Request and response shape for a fundraiser event.
    /// </summary>
    public class EventDto
    {
        /// <summary>
        /// Primary Key - ID of event
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// Organization running the fundraiser; the event's name
        /// </summary>
        public string? Organization { get; set; }

        /// <summary>
        /// Date the sale is held
        /// </summary>
        public DateTime? EventDate { get; set; }

        /// <summary>
        /// Cart / crew running the event
        /// </summary>
        public string? CartName { get; set; }

        /// <summary>
        /// Sales tax rate as a decimal fraction, e.g. 0.07
        /// </summary>
        public decimal? SalesTaxRate { get; set; }

        /// <summary>
        /// Card processing fee rate as a decimal fraction
        /// </summary>
        public decimal? CcProcessingFeeRate { get; set; }

        /// <summary>
        /// Next order number to hand out
        /// </summary>
        public int? NextOrderNumber { get; set; }

        /// <summary>
        /// Whether this is the event the floor app defaults to
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// When the event record was created
        /// </summary>
        public DateTime? CreatedAt { get; set; }
    }
}
