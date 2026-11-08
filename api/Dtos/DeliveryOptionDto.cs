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
        /// The territory whose catalog this delivery option is in
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// The territory's name (returned, not saved)
        /// </summary>
        public string? TerritoryName { get; set; }

        /// <summary>
        /// Whether the signed-in user may change it (returned, not saved) - a manager only their own territories
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

        /// <summary>
        /// A sale on this delivery option, as a percent off
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// A sale on this delivery option, as a fixed amount off, when there is no percent
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }

        /// <summary>
        /// The sale taken when this is sold - percent off (returned, not saved). The server works it
        /// out; at most one of the two is set.
        /// </summary>
        public decimal? EffectiveSalePercent { get; set; }

        /// <summary>
        /// The sale taken when this is sold - amount off each (returned, not saved)
        /// </summary>
        public decimal? EffectiveSaleAmount { get; set; }
    }
}
