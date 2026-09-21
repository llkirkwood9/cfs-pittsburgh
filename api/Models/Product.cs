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
