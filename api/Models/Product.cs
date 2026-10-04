using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A catalog product: one mattress model, pillow, sheet set, protector, frame or misc item.
    /// Pricing lives on the child ProductVariant rows, one per size/configuration.
    /// </summary>
    public class Product
    {
        /// <summary>
        /// Primary Key - ID of product
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Model name as written in the Description column, e.g. "Agility 3000"
        /// </summary>
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Manufacturer printed in the Brand column, e.g. "Therapedic"
        /// </summary>
        [MaxLength(100)]
        public string Brand { get; set; } = string.Empty;

        /// <summary>
        /// Category used for stat-sheet tallies
        /// </summary>
        public ProductCategory Category { get; set; }

        /// <summary>
        /// Optional sales notes shown to the rep, e.g. "25% off sale"
        /// </summary>
        [MaxLength(500)]
        public string? Notes { get; set; }

        /// <summary>
        /// Ordering within its category on the product picker
        /// </summary>
        public int SortOrder { get; set; }

        /// <summary>
        /// Inactive products are hidden from the floor but retained on past orders
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// The territory this product belongs to, or null for a global product offered in every
        /// territory. Only owners and administrators change global ones.
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// Navigation to the territory
        /// </summary>
        public Territory? Territory { get; set; }

        /// <summary>
        /// Whether on-hand stock is counted for this product. Accessories kept at the cart, such
        /// as pillows and protectors, are tracked; mattresses are always shipped and are not.
        /// </summary>
        public bool TrackInventory { get; set; }

        /// <summary>
        /// A sale on every size, as a percent off (e.g. 20 for 20%). A size can set its own sale
        /// instead. Applied when the item goes on an order.
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// A sale on every size, as a fixed amount off each item (e.g. 300 for $300 off). Used
        /// only when there is no percent.
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }

        /// <summary>
        /// Choices the rep makes beyond size, such as Color
        /// </summary>
        public List<ProductOption> Options { get; set; } = new();

        /// <summary>
        /// When the product was created
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Size / configuration rows carrying the prices
        /// </summary>
        public List<ProductVariant> Variants { get; set; } = new();

        /// <summary>
        /// Delivery and in-home service options offered for this product
        /// </summary>
        public List<ProductDeliveryOption> DeliveryOptions { get; set; } = new();
    }
}
