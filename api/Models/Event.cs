using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A single fundraiser: one organization on one day, run by one cart crew. Every order belongs
    /// to exactly one event. The organization is the event's name - a fundraiser is not always
    /// held at a school.
    /// </summary>
    public class Event
    {
        /// <summary>
        /// Primary Key - ID of event
        /// </summary>
        public int Id { get; set; }

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
        /// Sales tax rate applied to taxable lines, stored as a decimal fraction (0.07 = 7%)
        /// </summary>
        public decimal SalesTaxRate { get; set; } = 0.07m;

        /// <summary>
        /// Credit card processing fee rate, stored as a decimal fraction. 0 disables the fee.
        /// </summary>
        public decimal CcProcessingFeeRate { get; set; } = 0m;

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
