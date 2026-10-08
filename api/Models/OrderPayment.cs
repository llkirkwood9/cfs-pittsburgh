using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// One row of the Payment Options box. An order may be split across several methods,
    /// which is why this is a collection rather than a set of columns on the order.
    /// </summary>
    public class OrderPayment
    {
        /// <summary>
        /// Primary Key - ID of payment
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
        /// Which box on the sheet this amount belongs in
        /// </summary>
        public PaymentMethod Method { get; set; }

        /// <summary>
        /// Amount tendered under this method
        /// </summary>
        public decimal Amount { get; set; }

        /// <summary>
        /// Check number, written beside the Check # box
        /// </summary>
        [MaxLength(50)]
        public string? CheckNumber { get; set; }

        /// <summary>
        /// Free-text reference. For a financing payment, the financing (account or approval) number.
        /// </summary>
        [MaxLength(100)]
        public string? Reference { get; set; }

        /// <summary>
        /// For a financing payment, which financing the customer chose, e.g. "12 months no
        /// interest". One of the finance options set under Settings when it was recorded.
        /// </summary>
        [MaxLength(100)]
        public string? FinanceType { get; set; }

        /// <summary>
        /// When the payment row was recorded
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
