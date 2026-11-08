using api.Dtos;
using api.Models;

namespace api.Orders
{
    /// <summary>
    /// Copies what the floor and checkout type onto an order: the header row, the billing and
    /// delivery blocks and the initials and signature. Only fields sent are changed.
    /// </summary>
    public static class OrderFields
    {
        #region Public Methods

        /// <summary>
        /// Copies every block of a request onto an order: header, billing, delivery,
        /// acknowledgements, comments and rates. When the details the customer initialled change and no new initials
        /// came with them, the initials are cleared - they have to look again before the sale can
        /// be completed.
        /// </summary>
        /// <param name="order">Target order</param>
        /// <param name="request">Incoming DTO</param>
        public static void Apply(Order order, OrderDto request)
        {
            var detailsBefore = CustomerDetails(order);

            ApplyHeader(order, request);
            ApplyBilling(order, request);
            ApplyDelivery(order, request);
            ApplyAcknowledgements(order, request);

            if (request.CustomerInfoInitials == null && CustomerDetails(order) != detailsBefore)
                order.CustomerInfoInitials = null;

            if (request.Comments != null)
                order.Comments = string.IsNullOrWhiteSpace(request.Comments) ? null : request.Comments;

            ApplyRates(order, request);
        }

        /// <summary>
        /// Trims typed text, treating text that is only spaces as nothing.
        /// </summary>
        /// <param name="value">What was typed</param>
        /// <returns>The trimmed text, or null.</returns>
        public static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        #endregion

        #region Private Methods

        /// <summary>
        /// Copies the header row fields from a request onto an order.
        /// </summary>
        private static void ApplyHeader(Order order, OrderDto request)
        {
            if (request.DraftLabel != null)
                order.DraftLabel = string.IsNullOrWhiteSpace(request.DraftLabel) ? null : request.DraftLabel;

            if (request.SaleDate != null)
                order.SaleDate = request.SaleDate.Value;

            if (request.Organization != null)
                order.Organization = request.Organization;

            if (request.AdvertisingSource != null)
                order.AdvertisingSource = request.AdvertisingSource;

            if (request.ReferralName != null)
                order.ReferralName = request.ReferralName;

            if (request.CfsRepName != null)
                order.CfsRepName = request.CfsRepName;
        }

        /// <summary>
        /// Copies the billing block from a request onto an order.
        /// </summary>
        private static void ApplyBilling(Order order, OrderDto request)
        {
            if (request.BillingFirstName != null || request.BillingLastName != null)
            {
                if (request.BillingFirstName != null) order.BillingFirstName = Clean(request.BillingFirstName);
                if (request.BillingLastName != null) order.BillingLastName = Clean(request.BillingLastName);
                order.BillingName = Clean($"{order.BillingFirstName} {order.BillingLastName}");
            }
            else if (request.BillingName != null)
            {
                // An app from before the name was split sends the whole name: the first word is the
                // first name and the rest the last.
                var (first, last) = SplitName(request.BillingName);
                order.BillingFirstName = first;
                order.BillingLastName = last;
                order.BillingName = Clean(request.BillingName);
            }

            if (request.BillingAddress != null) order.BillingAddress = request.BillingAddress;
            if (request.BillingUnit != null) order.BillingUnit = request.BillingUnit;
            if (request.BillingFloor != null) order.BillingFloor = request.BillingFloor;
            if (request.BillingSuite != null) order.BillingSuite = request.BillingSuite;
            if (request.BillingCity != null) order.BillingCity = request.BillingCity;
            if (request.BillingState != null) order.BillingState = request.BillingState;
            if (request.BillingZip != null) order.BillingZip = request.BillingZip;
            if (request.BillingCell != null) order.BillingCell = request.BillingCell;
            if (request.BillingAlt != null) order.BillingAlt = request.BillingAlt;
            if (request.BillingEmail != null) order.BillingEmail = request.BillingEmail;
        }

        /// <summary>
        /// Splits a whole name at the first space: "Mary Ann Smith" is "Mary" and "Ann Smith".
        /// (The receipt email's greeting picks a first name its own way - see EmailTemplates.)
        /// </summary>
        /// <param name="name">The whole name</param>
        /// <returns>The first name and the last name, either of which may be null.</returns>
        private static (string? First, string? Last) SplitName(string? name)
        {
            var trimmed = Clean(name);
            if (trimmed == null) return (null, null);
            var space = trimmed.IndexOf(' ');
            return space < 0 ? (trimmed, null) : (trimmed[..space], Clean(trimmed[(space + 1)..]));
        }

        /// <summary>
        /// Copies the sales tax and card fee rates, and whether the card fee applies, onto an
        /// order. The rates are checked before (Rates.Problem). Waiving the fee is checkout's
        /// decision and isn't done here.
        /// </summary>
        private static void ApplyRates(Order order, OrderDto request)
        {
            if (request.SalesTaxRate != null)
                order.SalesTaxRate = request.SalesTaxRate.Value;

            if (request.CcProcessingFeeRate != null)
                order.CcProcessingFeeRate = request.CcProcessingFeeRate.Value;

            if (request.ApplyCcProcessingFee != null)
                order.ApplyCcProcessingFee = request.ApplyCcProcessingFee.Value;
        }

        /// <summary>
        /// Copies the delivery block from a request onto an order.
        /// </summary>
        private static void ApplyDelivery(Order order, OrderDto request)
        {
            if (request.DeliverySameAsBilling != null) order.DeliverySameAsBilling = request.DeliverySameAsBilling.Value;
            if (request.DeliveryName != null) order.DeliveryName = request.DeliveryName;
            if (request.DeliveryAddress != null) order.DeliveryAddress = request.DeliveryAddress;
            if (request.DeliveryUnit != null) order.DeliveryUnit = request.DeliveryUnit;
            if (request.DeliveryFloor != null) order.DeliveryFloor = request.DeliveryFloor;
            if (request.DeliverySuite != null) order.DeliverySuite = request.DeliverySuite;
            if (request.DeliveryCity != null) order.DeliveryCity = request.DeliveryCity;
            if (request.DeliveryState != null) order.DeliveryState = request.DeliveryState;
            if (request.DeliveryZip != null) order.DeliveryZip = request.DeliveryZip;
            if (request.DeliveryCell != null) order.DeliveryCell = request.DeliveryCell;
            if (request.DeliveryAlt != null) order.DeliveryAlt = request.DeliveryAlt;
            if (request.DeliveryEmail != null) order.DeliveryEmail = request.DeliveryEmail;
        }

        /// <summary>
        /// Copies the initials and signature block from a request onto an order.
        /// </summary>
        private static void ApplyAcknowledgements(Order order, OrderDto request)
        {
            if (request.CustomerInfoInitials != null) order.CustomerInfoInitials = request.CustomerInfoInitials;
            if (request.WarrantyInitials != null) order.WarrantyInitials = request.WarrantyInitials;
            if (request.DropShipInitials != null) order.DropShipInitials = request.DropShipInitials;
            if (request.AdvisoryInitials != null) order.AdvisoryInitials = request.AdvisoryInitials;
            if (request.CustomerSignatureName != null) order.CustomerSignatureName = request.CustomerSignatureName;
            if (request.CustomerSignature != null)
                order.CustomerSignature = string.IsNullOrWhiteSpace(request.CustomerSignature)
                    ? null
                    : request.CustomerSignature;
            if (request.SignedDate != null) order.SignedDate = request.SignedDate;
            if (request.ReceivedBy != null) order.ReceivedBy = request.ReceivedBy;
            if (request.ReceivedDate != null) order.ReceivedDate = request.ReceivedDate;
        }

        /// <summary>
        /// Everything the customer confirms on the details screen, as one string for comparison.
        /// </summary>
        private static string CustomerDetails(Order order)
        {
            return string.Join("|",
                order.BillingName, order.BillingAddress, order.BillingUnit, order.BillingFloor,
                order.BillingSuite, order.BillingCity, order.BillingState, order.BillingZip,
                order.BillingCell, order.BillingAlt, order.BillingEmail, order.DeliverySameAsBilling,
                order.DeliveryName, order.DeliveryAddress, order.DeliveryUnit, order.DeliveryFloor,
                order.DeliverySuite, order.DeliveryCity, order.DeliveryState, order.DeliveryZip,
                order.DeliveryCell, order.DeliveryAlt, order.DeliveryEmail);
        }

        #endregion
    }
}
