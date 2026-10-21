using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A single fundraiser: one organization on one day, run by one cart crew. Every order belongs
    /// to exactly one event
    /// </summary>
    public class Event
    {
        /// <summary>
        /// Primary Key - ID of event
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// The territory running the event. Only that territory's crew sees it.
        /// </summary>
        public int TerritoryId { get; set; }

        /// <summary>
        /// Navigation to the territory
        /// </summary>
        public Territory? Territory { get; set; }

        /// <summary>
        /// Organization running the fundraiser, e.g. "Hampton Band". Printed at the top of the
        /// stat sheet and copied onto each order's Organization cell.
        /// </summary>
        [MaxLength(150)]
        public string Organization { get; set; } = string.Empty;

        /// <summary>
        /// Date the sale is held
        /// </summary>
        public DateTime EventDate { get; set; }

        /// <summary>
        /// Cart / crew running the event, e.g. "Pittsburgh"
        /// </summary>
        [MaxLength(100)]
        public string? CartName { get; set; }

        /// <summary>
        /// Free-text notes printed in the Notes box of the event's Accessory Inventory Sheet, e.g.
        /// "One lavender pillow kept as a floor sample"
        /// </summary>
        [MaxLength(2000)]
        public string? InventoryNotes { get; set; }

        /// <summary>
        /// Sales tax rate applied to taxable lines, stored as a decimal fraction (0.07 = 7%)
        /// </summary>
        public decimal SalesTaxRate { get; set; } = 0.07m;

        /// <summary>
        /// Credit card processing fee rate, stored as a decimal fraction. 0 disables the fee. (0.02 = 2%)
        /// </summary>
        public decimal CcProcessingFeeRate { get; set; } = 0.02m;

        /// <summary>
        /// Next order number to hand out. Mirrors the pre-printed number on the paper sheets.
        /// </summary>
        public int NextOrderNumber { get; set; } = 1001;

        /// <summary>
        /// Only one event is active at a time; the floor app defaults to it
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// When the event record was created
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Orders taken at this event
        /// </summary>
        public List<Order> Orders { get; set; } = new();
    }
}
