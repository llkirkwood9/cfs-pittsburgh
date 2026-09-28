using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// One row of the product grid on the sales sheet. Brand, size and description are stored as
    /// text snapshots so that editing the catalog later never rewrites a printed receipt.
    /// </summary>
    public class OrderLine
    {
        /// <summary>
        /// Primary Key - ID of line
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// FK to the owning order
        /// </summary>
        public int OrderId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public Order? Order { get; set; }

        /// <summary>
        /// Whether the row came from the catalog, a delivery option or free text
        /// </summary>
        public OrderLineType LineType { get; set; }

        /// <summary>
        /// Category snapshot, used for the dashboard tallies
        /// </summary>
        public ProductCategory Category { get; set; }

        /// <summary>
        /// FK to the catalog variant, when the row came from the catalog
        /// </summary>
        public int? ProductVariantId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public ProductVariant? ProductVariant { get; set; }

        /// <summary>
        /// FK to the delivery option, when the row is a delivery or service charge
        /// </summary>
        public int? DeliveryOptionId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public DeliveryOption? DeliveryOption { get; set; }

        /// <summary>
        /// Id of the product line this delivery charge hangs off, so the two stay together
        /// </summary>
        public int? ParentLineId { get; set; }

        /// <summary>
        /// Brand column
        /// </summary>
        [MaxLength(100)]
        public string? Brand { get; set; }

        /// <summary>
        /// Size column
        /// </summary>
        [MaxLength(50)]
        public string? Size { get; set; }

        /// <summary>
        /// Description column - model name, type, matt, box
        /// </summary>
        [MaxLength(300)]
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Qty column
        /// </summary>
        public int Quantity { get; set; } = 1;

        /// <summary>
        /// Take With tick box
        /// </summary>
        public bool TakeWith { get; set; }

        /// <summary>
        /// Unit Price column
        /// </summary>
        public decimal UnitPrice { get; set; }

        /// <summary>
        /// Discount column expressed as a percentage, e.g. 10 for the common 10% rep discount
        /// </summary>
        public decimal? DiscountPercent { get; set; }

        /// <summary>
        /// Discount column expressed as a flat dollar amount off the unit price
        /// </summary>
        public decimal? DiscountAmount { get; set; }

        /// <summary>
        /// Sale Price column - unit price after the discount
        /// </summary>
        public decimal SalePrice { get; set; }

        /// <summary>
        /// Total column - sale price times quantity
        /// </summary>
        public decimal LineTotal { get; set; }

        /// <summary>
        /// Snapshot of whether the sold configuration included an adjustable base
        /// </summary>
        public bool IncludesAdjustableBase { get; set; }

        /// <summary>
        /// Snapshot of the delivery option's Show on sales sheet setting when the row was added,
        /// so changing the setting later never changes a printed sheet
        /// </summary>
        public bool ShowOnSalesSheet { get; set; } = true;

        /// <summary>
        /// Whether this row feeds the taxable subtotal
        /// </summary>
        public bool IsTaxable { get; set; } = true;

        /// <summary>
        /// Note about this item, e.g. "Floor model - small scuff on the corner". Printed under the
        /// item on the sales sheet, above its shipping rows.
        /// </summary>
        [MaxLength(500)]
        public string? Notes { get; set; }

        /// <summary>
        /// Print order within the grid
        /// </summary>
        public int SortOrder { get; set; }
    }
}
