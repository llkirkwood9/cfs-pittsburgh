namespace api.Dtos
{
    /// <summary>
    /// One row of the product grid on the sales sheet.
    /// </summary>
    public class OrderLineDto
    {
        /// <summary>
        /// Primary Key - ID of line
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// Whether the row came from the catalog, a delivery option or free text
        /// </summary>
        public string? LineType { get; set; }

        /// <summary>
        /// Category snapshot used for dashboard tallies
        /// </summary>
        public string? Category { get; set; }

        /// <summary>
        /// FK to the catalog variant, when the row came from the catalog
        /// </summary>
        public int? ProductVariantId { get; set; }

        /// <summary>
        /// FK to the delivery option, when the row is a service charge
        /// </summary>
        public int? DeliveryOptionId { get; set; }

        /// <summary>
        /// Id of the product line this delivery charge hangs off
        /// </summary>
        public int? ParentLineId { get; set; }

        /// <summary>
        /// Brand column
        /// </summary>
        public string? Brand { get; set; }

        /// <summary>
        /// Size column
        /// </summary>
        public string? Size { get; set; }

        /// <summary>
        /// Description column
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// Qty column
        /// </summary>
        public int? Quantity { get; set; }

        /// <summary>
        /// Take With tick box
        /// </summary>
        public bool? TakeWith { get; set; }

        /// <summary>
        /// Unit Price column
        /// </summary>
        public decimal? UnitPrice { get; set; }

        /// <summary>
        /// Discount column as a percentage
        /// </summary>
        public decimal? DiscountPercent { get; set; }

        /// <summary>
        /// Discount column as a flat dollar amount
        /// </summary>
        public decimal? DiscountAmount { get; set; }

        /// <summary>
        /// Sale Price column, computed by the server
        /// </summary>
        public decimal? SalePrice { get; set; }

        /// <summary>
        /// Total column, computed by the server
        /// </summary>
        public decimal? LineTotal { get; set; }

        /// <summary>
        /// Whether the sold configuration included an adjustable base
        /// </summary>
        public bool? IncludesAdjustableBase { get; set; }

        /// <summary>
        /// Whether a delivery row prints on the sales sheet
        /// </summary>
        public bool? ShowOnSalesSheet { get; set; }

        /// <summary>
        /// Whether this row feeds the taxable subtotal
        /// </summary>
        public bool? IsTaxable { get; set; }

        /// <summary>
        /// Print order within the grid
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Units of the sold size on hand at the cart, when the product tracks inventory. Null
        /// for anything that is not counted. Read-only.
        /// </summary>
        public int? QuantityOnHand { get; set; }
    }
}
