namespace api.Dtos
{
    /// <summary>
    /// A delivery option as offered for one specific product, carrying the effective price after
    /// any per-product override.
    /// </summary>
    public class ProductDeliveryOptionDto
    {
        /// <summary>
        /// Primary Key - ID of the join row
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// FK to the product
        /// </summary>
        public int? ProductId { get; set; }

        /// <summary>
        /// FK to the delivery option
        /// </summary>
        public int? DeliveryOptionId { get; set; }

        /// <summary>
        /// Delivery option name, copied for display
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Price to charge for this option on this product
        /// </summary>
        public decimal? Price { get; set; }

        /// <summary>
        /// Per-product override, null when the catalog default applies
        /// </summary>
        public decimal? PriceOverride { get; set; }

        /// <summary>
        /// Whether the charge is taxable
        /// </summary>
        public bool? IsTaxable { get; set; }

        /// <summary>
        /// Whether choosing this option ticks the Take With box
        /// </summary>
        public bool? IsTakeWith { get; set; }

        /// <summary>
        /// Whether this option is preselected when the product is added
        /// </summary>
        public bool? IsDefault { get; set; }

        /// <summary>
        /// Whether this product has its own sale on the option instead of the option's own
        /// </summary>
        public bool? HasOwnSale { get; set; }

        /// <summary>
        /// This product's own sale on the option, as a percent off
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// This product's own sale on the option, as a fixed amount off, when there is no percent
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }

        /// <summary>
        /// The delivery option's own sale as a percent (read only), which applies unless the
        /// product has its own
        /// </summary>
        public decimal? OptionSaleDiscountPercent { get; set; }

        /// <summary>
        /// The delivery option's own sale as an amount off (read only)
        /// </summary>
        public decimal? OptionSaleDiscountAmount { get; set; }
    }
}
