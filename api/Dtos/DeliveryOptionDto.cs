namespace api.Dtos
{
    /// <summary>
    /// Request and response shape for a delivery method or in-home service.
    /// </summary>
    public class DeliveryOptionDto
    {
        /// <summary>
        /// Primary Key - ID of delivery option
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// The territory this delivery option belongs to; null for a global delivery option offered everywhere
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// The territory's name (returned, not saved)
        /// </summary>
        public string? TerritoryName { get; set; }

        /// <summary>
        /// Whether the signed-in user may change it (returned, not saved) - a manager can't change global ones
        /// </summary>
        public bool? CanEdit { get; set; }

        /// <summary>
        /// Name written on the sales sheet line
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Default charge
        /// </summary>
        public decimal? Price { get; set; }

        /// <summary>
        /// Whether the charge is included in the taxable subtotal
        /// </summary>
        public bool? IsTaxable { get; set; }

        /// <summary>
        /// Whether choosing this option ticks the Take With box
        /// </summary>
        public bool? IsTakeWith { get; set; }

        /// <summary>
        /// Whether a row for this option prints on the sales sheet
        /// </summary>
        public bool? ShowOnSalesSheet { get; set; }

        /// <summary>
        /// Ordering on the delivery picker
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Whether the option is offered on the floor
        /// </summary>
        public bool? IsActive { get; set; }
    }
}
