using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// One change to a variant's on-hand count: a manual count or correction, a Take With sale, or
    /// stock returned when a completed sale was reopened or voided.
    /// </summary>
    public class InventoryAdjustment
    {
        /// <summary>
        /// Primary Key - ID of adjustment
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// FK to the variant whose count changed
        /// </summary>
        public int ProductVariantId { get; set; }

        /// <summary>
        /// Which combination of counted choices changed, e.g. "5:12"; empty for stock kept per size
        /// </summary>
        [MaxLength(200)]
        public string StockKey { get; set; } = string.Empty;

        /// <summary>
        /// Navigation property
        /// </summary>
        public ProductVariant? ProductVariant { get; set; }

        /// <summary>
        /// Why the count changed
        /// </summary>
        public InventoryChangeKind Kind { get; set; }

        /// <summary>
        /// Units added (positive) or removed (negative)
        /// </summary>
        public int Change { get; set; }

        /// <summary>
        /// The on-hand count after this change
        /// </summary>
        public int QuantityAfter { get; set; }

        /// <summary>
        /// FK to the sale, for Sale and Return rows
        /// </summary>
        public int? OrderId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public Order? Order { get; set; }

        /// <summary>
        /// Event the sale belonged to, so the inventory sheet can total what each event sold
        /// </summary>
        public int? EventId { get; set; }

        /// <summary>
        /// FK to the crew member who made the change
        /// </summary>
        public int? UserId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public User? User { get; set; }

        /// <summary>
        /// Name snapshot of the crew member, shown in the history
        /// </summary>
        [MaxLength(150)]
        public string? UserName { get; set; }

        /// <summary>
        /// Optional note, e.g. "Delivery from warehouse" or "Floor sample"
        /// </summary>
        [MaxLength(300)]
        public string? Note { get; set; }

        /// <summary>
        /// When the change was made
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
