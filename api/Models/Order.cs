using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// One customer sale. Carries every field printed on the CFS sales sheet, from the header
    /// row through the billing and delivery blocks, the line items, the payment box and the
    /// three acknowledgement initials at the bottom.
    /// </summary>
    public class Order
    {
        #region Identity

        /// <summary>
        /// Primary Key - ID of order
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// FK to the event this sale belongs to
        /// </summary>
        public int EventId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public Event? Event { get; set; }

        /// <summary>
        /// Sequential number printed in the top right corner of the sheet
        /// </summary>
        public int OrderNumber { get; set; }

        /// <summary>
        /// Where the order sits between the sales floor and the checkout table
        /// </summary>
        public OrderStatus Status { get; set; } = OrderStatus.Draft;

        /// <summary>
        /// Free-text label the rep uses to tell concurrent drafts apart on the floor
        /// </summary>
        [MaxLength(100)]
        public string? DraftLabel { get; set; }

        #endregion

        #region Header Row

        /// <summary>
        /// Sale Date cell
        /// </summary>
        public DateTime SaleDate { get; set; }

        /// <summary>
        /// Organization cell, defaulted from the event
        /// </summary>
        [MaxLength(150)]
        public string? Organization { get; set; }

        /// <summary>
        /// Advertising Source cell
        /// </summary>
        [MaxLength(150)]
        public string? AdvertisingSource { get; set; }

        /// <summary>
        /// Referral Name cell
        /// </summary>
        [MaxLength(150)]
        public string? ReferralName { get; set; }

        /// <summary>
        /// CFS Rep Name cell
        /// </summary>
        [MaxLength(150)]
        public string? CfsRepName { get; set; }

        #endregion

        #region Customer Billing Name and Address

        /// <summary>
        /// Billing block - Name
        /// </summary>
        [MaxLength(150)]
        public string? BillingName { get; set; }

        /// <summary>
        /// Billing block - Address
        /// </summary>
        [MaxLength(250)]
        public string? BillingAddress { get; set; }

        /// <summary>
        /// Billing block - Unit #
        /// </summary>
        [MaxLength(50)]
        public string? BillingUnit { get; set; }

        /// <summary>
        /// Billing block - Floor
        /// </summary>
        [MaxLength(50)]
        public string? BillingFloor { get; set; }

        /// <summary>
        /// Billing block - Suite #
        /// </summary>
        [MaxLength(50)]
        public string? BillingSuite { get; set; }

        /// <summary>
        /// Billing block - City
        /// </summary>
        [MaxLength(100)]
        public string? BillingCity { get; set; }

        /// <summary>
        /// Billing block - State
        /// </summary>
        [MaxLength(50)]
        public string? BillingState { get; set; }

        /// <summary>
        /// Billing block - Zip
        /// </summary>
        [MaxLength(20)]
        public string? BillingZip { get; set; }

        /// <summary>
        /// Billing block - Cell #
        /// </summary>
        [MaxLength(50)]
        public string? BillingCell { get; set; }

        /// <summary>
        /// Billing block - Alt. #
        /// </summary>
        [MaxLength(50)]
        public string? BillingAlt { get; set; }

        /// <summary>
        /// Billing block - Email
        /// </summary>
        [MaxLength(200)]
        public string? BillingEmail { get; set; }

        #endregion

        #region Delivery Address

        /// <summary>
        /// When true the delivery block is left blank because it matches billing
        /// </summary>
        public bool DeliverySameAsBilling { get; set; } = true;

        /// <summary>
        /// Delivery block - Name
        /// </summary>
        [MaxLength(150)]
        public string? DeliveryName { get; set; }

        /// <summary>
        /// Delivery block - Address
        /// </summary>
        [MaxLength(250)]
        public string? DeliveryAddress { get; set; }

        /// <summary>
        /// Delivery block - Unit #
        /// </summary>
        [MaxLength(50)]
        public string? DeliveryUnit { get; set; }

        /// <summary>
        /// Delivery block - Floor
        /// </summary>
        [MaxLength(50)]
        public string? DeliveryFloor { get; set; }

        /// <summary>
        /// Delivery block - Suite #
        /// </summary>
        [MaxLength(50)]
        public string? DeliverySuite { get; set; }

        /// <summary>
        /// Delivery block - City
        /// </summary>
        [MaxLength(100)]
        public string? DeliveryCity { get; set; }

        /// <summary>
        /// Delivery block - State
        /// </summary>
        [MaxLength(50)]
        public string? DeliveryState { get; set; }

        /// <summary>
        /// Delivery block - Zip
        /// </summary>
        [MaxLength(20)]
        public string? DeliveryZip { get; set; }

        /// <summary>
        /// Delivery block - Cell #
        /// </summary>
        [MaxLength(50)]
        public string? DeliveryCell { get; set; }

        /// <summary>
        /// Delivery block - Alt. #
        /// </summary>
        [MaxLength(50)]
        public string? DeliveryAlt { get; set; }

        /// <summary>
        /// Delivery block - Email
        /// </summary>
        [MaxLength(200)]
        public string? DeliveryEmail { get; set; }

        #endregion

        #region Totals

        /// <summary>
        /// Comments box under the line items
        /// </summary>
        [MaxLength(1000)]
        public string? Comments { get; set; }

        /// <summary>
        /// Tax rate captured when the order was taken, so later rate changes do not rewrite history
        /// </summary>
        public decimal SalesTaxRate { get; set; }

        /// <summary>
        /// Card processing fee rate captured when the order was taken
        /// </summary>
        public decimal CcProcessingFeeRate { get; set; }

        /// <summary>
        /// Set when the checkout table picks Visa/MC, so the fee lands on the total as soon as the
        /// card is chosen rather than only once the payment has been keyed in. Clearing it, or
        /// picking another method, takes the fee back off.
        /// </summary>
        public bool ApplyCcProcessingFee { get; set; }

        /// <summary>
        /// Set at the checkout table to take the card fee off this order, even when it is paid by
        /// card.
        /// </summary>
        public bool WaiveCcProcessingFee { get; set; }

        /// <summary>
        /// Subtotal cell - sum of all line totals
        /// </summary>
        public decimal Subtotal { get; set; }

        /// <summary>
        /// Sales Tax cell
        /// </summary>
        public decimal TaxAmount { get; set; }

        /// <summary>
        /// CC Processing Fee cell
        /// </summary>
        public decimal CcProcessingFee { get; set; }

        /// <summary>
        /// Total cell - subtotal plus tax plus card fee
        /// </summary>
        public decimal Total { get; set; }

        /// <summary>
        /// Sum of the payment rows
        /// </summary>
        public decimal AmountPaid { get; set; }

        /// <summary>
        /// Balance Due cell
        /// </summary>
        public decimal BalanceDue { get; set; }

        #endregion

        #region Acknowledgements

        /// <summary>
        /// Initials confirming the customer checked their name, address, phone, email and
        /// delivery details. Cleared whenever those details change afterwards.
        /// </summary>
        [MaxLength(10)]
        public string? CustomerInfoInitials { get; set; }

        /// <summary>
        /// Initials against the Customer Service and Warranty Information paragraph
        /// </summary>
        [MaxLength(10)]
        public string? WarrantyInitials { get; set; }

        /// <summary>
        /// Initials against the Drop Ship Delivery paragraph
        /// </summary>
        [MaxLength(10)]
        public string? DropShipInitials { get; set; }

        /// <summary>
        /// Initials against the Advisory paragraph
        /// </summary>
        [MaxLength(10)]
        public string? AdvisoryInitials { get; set; }

        /// <summary>
        /// The wording of the initialled statements as it was when the sale was completed, as
        /// JSON, so a reprint years later still shows what the customer agreed to
        /// </summary>
        public string? TermsJson { get; set; }

        /// <summary>
        /// Customer Name printed beside the signature line
        /// </summary>
        [MaxLength(150)]
        public string? CustomerSignatureName { get; set; }

        /// <summary>
        /// The customer's drawn signature as a data URL, captured on the tablet at checkout and
        /// printed on the receipt.
        /// </summary>
        public string? CustomerSignature { get; set; }

        /// <summary>
        /// Date beside the customer signature
        /// </summary>
        public DateTime? SignedDate { get; set; }

        /// <summary>
        /// Received by line at the very bottom of the sheet
        /// </summary>
        [MaxLength(150)]
        public string? ReceivedBy { get; set; }

        /// <summary>
        /// Date beside the Received by line
        /// </summary>
        public DateTime? ReceivedDate { get; set; }

        #endregion

        #region Audit

        /// <summary>
        /// FK to the sales rep who opened the order
        /// </summary>
        public int? CreatedByUserId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public User? CreatedByUser { get; set; }

        /// <summary>
        /// FK to the checkout user who closed the order
        /// </summary>
        public int? CompletedByUserId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public User? CompletedByUser { get; set; }

        /// <summary>
        /// When the draft was opened
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// When the rep handed the order to checkout
        /// </summary>
        public DateTime? SubmittedAt { get; set; }

        /// <summary>
        /// When checkout finished the sale
        /// </summary>
        public DateTime? CompletedAt { get; set; }

        /// <summary>
        /// Last time any field changed
        /// </summary>
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        #endregion

        #region Children

        /// <summary>
        /// Line items printed in the product grid
        /// </summary>
        public List<OrderLine> Lines { get; set; } = new();

        /// <summary>
        /// Rows of the Payment Options box
        /// </summary>
        public List<OrderPayment> Payments { get; set; } = new();

        #endregion
    }
}
