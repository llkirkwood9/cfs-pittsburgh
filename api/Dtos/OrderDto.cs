namespace api.Dtos
{
    /// <summary>
    /// Full request and response shape for an order, mirroring every field on the sales sheet.
    /// </summary>
    public class OrderDto
    {
        #region Identity

        /// <summary>
        /// Primary Key - ID of order
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// FK to the event this sale belongs to
        /// </summary>
        public int? EventId { get; set; }

        /// <summary>
        /// Sequential number printed in the top right corner
        /// </summary>
        public int? OrderNumber { get; set; }

        /// <summary>
        /// Draft, AwaitingCheckout, Completed or Voided
        /// </summary>
        public string? Status { get; set; }

        /// <summary>
        /// Free-text label used to tell concurrent drafts apart
        /// </summary>
        public string? DraftLabel { get; set; }

        #endregion

        #region Header Row

        /// <summary>
        /// Sale Date cell
        /// </summary>
        public DateTime? SaleDate { get; set; }

        /// <summary>
        /// Organization cell
        /// </summary>
        public string? Organization { get; set; }

        /// <summary>
        /// Advertising Source cell
        /// </summary>
        public string? AdvertisingSource { get; set; }

        /// <summary>
        /// Referral Name cell
        /// </summary>
        public string? ReferralName { get; set; }

        /// <summary>
        /// CFS Rep Name cell
        /// </summary>
        public string? CfsRepName { get; set; }

        #endregion

        #region Customer Billing Name and Address

        /// <summary>
        /// Billing block - Name
        /// </summary>
        public string? BillingName { get; set; }

        /// <summary>
        /// Billing block - Address
        /// </summary>
        public string? BillingAddress { get; set; }

        /// <summary>
        /// Billing block - Unit #
        /// </summary>
        public string? BillingUnit { get; set; }

        /// <summary>
        /// Billing block - Floor
        /// </summary>
        public string? BillingFloor { get; set; }

        /// <summary>
        /// Billing block - Suite #
        /// </summary>
        public string? BillingSuite { get; set; }

        /// <summary>
        /// Billing block - City
        /// </summary>
        public string? BillingCity { get; set; }

        /// <summary>
        /// Billing block - State
        /// </summary>
        public string? BillingState { get; set; }

        /// <summary>
        /// Billing block - Zip
        /// </summary>
        public string? BillingZip { get; set; }

        /// <summary>
        /// Billing block - Cell #
        /// </summary>
        public string? BillingCell { get; set; }

        /// <summary>
        /// Billing block - Alt. #
        /// </summary>
        public string? BillingAlt { get; set; }

        /// <summary>
        /// Billing block - Email
        /// </summary>
        public string? BillingEmail { get; set; }

        #endregion

        #region Delivery Address

        /// <summary>
        /// Whether the delivery block matches billing
        /// </summary>
        public bool? DeliverySameAsBilling { get; set; }

        /// <summary>
        /// Delivery block - Name
        /// </summary>
        public string? DeliveryName { get; set; }

        /// <summary>
        /// Delivery block - Address
        /// </summary>
        public string? DeliveryAddress { get; set; }

        /// <summary>
        /// Delivery block - Unit #
        /// </summary>
        public string? DeliveryUnit { get; set; }

        /// <summary>
        /// Delivery block - Floor
        /// </summary>
        public string? DeliveryFloor { get; set; }

        /// <summary>
        /// Delivery block - Suite #
        /// </summary>
        public string? DeliverySuite { get; set; }

        /// <summary>
        /// Delivery block - City
        /// </summary>
        public string? DeliveryCity { get; set; }

        /// <summary>
        /// Delivery block - State
        /// </summary>
        public string? DeliveryState { get; set; }

        /// <summary>
        /// Delivery block - Zip
        /// </summary>
        public string? DeliveryZip { get; set; }

        /// <summary>
        /// Delivery block - Cell #
        /// </summary>
        public string? DeliveryCell { get; set; }

        /// <summary>
        /// Delivery block - Alt. #
        /// </summary>
        public string? DeliveryAlt { get; set; }

        /// <summary>
        /// Delivery block - Email
        /// </summary>
        public string? DeliveryEmail { get; set; }

        #endregion

        #region Totals

        /// <summary>
        /// Comments box
        /// </summary>
        public string? Comments { get; set; }

        /// <summary>
        /// Tax rate applied to this order
        /// </summary>
        public decimal? SalesTaxRate { get; set; }

        /// <summary>
        /// Card processing fee rate applied to this order
        /// </summary>
        public decimal? CcProcessingFeeRate { get; set; }

        /// <summary>
        /// Whether the card processing fee is being applied because Visa/MC was chosen
        /// </summary>
        public bool? ApplyCcProcessingFee { get; set; }

        /// <summary>
        /// Subtotal cell, computed by the server
        /// </summary>
        public decimal? Subtotal { get; set; }

        /// <summary>
        /// Sales Tax cell, computed by the server
        /// </summary>
        public decimal? TaxAmount { get; set; }

        /// <summary>
        /// CC Processing Fee cell, computed by the server
        /// </summary>
        public decimal? CcProcessingFee { get; set; }

        /// <summary>
        /// Total cell, computed by the server
        /// </summary>
        public decimal? Total { get; set; }

        /// <summary>
        /// Sum of the payment rows
        /// </summary>
        public decimal? AmountPaid { get; set; }

        /// <summary>
        /// Balance Due cell, computed by the server
        /// </summary>
        public decimal? BalanceDue { get; set; }

        #endregion

        #region Acknowledgements

        /// <summary>
        /// Initials confirming the customer checked their details
        /// </summary>
        public string? CustomerInfoInitials { get; set; }

        /// <summary>
        /// Initials against the warranty paragraph
        /// </summary>
        public string? WarrantyInitials { get; set; }

        /// <summary>
        /// Initials against the drop ship paragraph
        /// </summary>
        public string? DropShipInitials { get; set; }

        /// <summary>
        /// Initials against the advisory paragraph
        /// </summary>
        public string? AdvisoryInitials { get; set; }

        /// <summary>
        /// The wording the customer initialled, kept when the sale was completed; null for an
        /// order not yet completed (or completed before wording was kept), which shows the
        /// wording in force now
        /// </summary>
        public List<SalesTermDto>? Terms { get; set; }

        /// <summary>
        /// Customer Name printed beside the signature line
        /// </summary>
        public string? CustomerSignatureName { get; set; }

        /// <summary>
        /// The customer's drawn signature as a data URL
        /// </summary>
        public string? CustomerSignature { get; set; }

        /// <summary>
        /// Date beside the customer signature
        /// </summary>
        public DateTime? SignedDate { get; set; }

        /// <summary>
        /// Received by line
        /// </summary>
        public string? ReceivedBy { get; set; }

        /// <summary>
        /// Date beside the Received by line
        /// </summary>
        public DateTime? ReceivedDate { get; set; }

        #endregion

        #region Audit

        /// <summary>
        /// Display name of the rep who opened the order
        /// </summary>
        public string? CreatedByName { get; set; }

        /// <summary>
        /// Display name of the checkout user who closed the order
        /// </summary>
        public string? CompletedByName { get; set; }

        /// <summary>
        /// When the draft was opened
        /// </summary>
        public DateTime? CreatedAt { get; set; }

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
        public DateTime? UpdatedAt { get; set; }

        #endregion

        #region Children

        /// <summary>
        /// Line items printed in the product grid
        /// </summary>
        public List<OrderLineDto>? Lines { get; set; }

        /// <summary>
        /// Rows of the Payment Options box
        /// </summary>
        public List<OrderPaymentDto>? Payments { get; set; }

        #endregion

        #region Event Snapshot

        /// <summary>
        /// Organization of the owning event
        /// </summary>
        public string? EventOrganization { get; set; }

        #endregion
    }
}
