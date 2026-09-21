using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A delivery method or in-home service that can be attached to a product line,
    /// e.g. Drop Ship, White Glove, Haul Away, Take With.
    /// </summary>
    public class DeliveryOption
    {
        /// <summary>
        /// Primary Key - ID of delivery option
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Name written on the sales sheet line, e.g. "White Glove"
        /// </summary>
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Default charge. Individual products may override this.
        /// </summary>
        public decimal Price { get; set; }

        /// <summary>
        /// Whether the charge is included in the taxable subtotal
        /// </summary>
        public bool IsTaxable { get; set; } = true;

        /// <summary>
        /// Marks the option that means the customer carries the item out; ticks the Take With box
        /// </summary>
        public bool IsTakeWith { get; set; }

        /// <summary>
        /// Ordering on the delivery picker
        /// </summary>
        public int SortOrder { get; set; }

        /// <summary>
        /// Inactive options are hidden from the floor but retained on past orders
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Products that offer this option
        /// </summary>
        public List<ProductDeliveryOption> Products { get; set; } = new();
    }
}
