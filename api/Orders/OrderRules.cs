using api.Data;
using api.Models;
using api.Utils;

namespace api.Orders
{
    /// <summary>
    /// What an order may do in each status, and the facts about orders that the floor, checkout,
    /// the dashboard and the receipt all have to agree on.
    /// </summary>
    public static class OrderRules
    {
        #region Messages

        /// <summary>Why a completed or voided order's items can't be changed.</summary>
        public const string ClosedMessage = "This order is closed and can no longer be changed.";

        /// <summary>Why a voided order can't be changed at all.</summary>
        public const string VoidedMessage = "This order has been voided.";

        #endregion

        #region Status

        /// <summary>
        /// Whether an order is closed: completed or voided, so its items can no longer change.
        /// </summary>
        /// <param name="order">The order</param>
        /// <returns>True when closed.</returns>
        public static bool IsClosed(Order order) => order.Status is OrderStatus.Completed or OrderStatus.Voided;

        /// <summary>
        /// What an order still lacks before the checkout table can take it: at least one item and
        /// the customer's first and last name.
        /// </summary>
        /// <param name="order">Order with its lines loaded</param>
        /// <returns>What's missing, or None.</returns>
        public static CheckoutGap MissingForCheckout(Order order)
        {
            if (order.Lines.Count == 0)
                return CheckoutGap.NoItems;

            if (string.IsNullOrWhiteSpace(order.BillingFirstName) || string.IsNullOrWhiteSpace(order.BillingLastName))
                return CheckoutGap.NoCustomerName;

            return CheckoutGap.None;
        }

        /// <summary>
        /// Whether clearing an open order (close-out, or discarding a draft) has to keep it as
        /// voided rather than delete it: it reached checkout, or money was taken on it. Only a
        /// draft with nothing paid can be deleted, so a recorded payment is never lost.
        /// </summary>
        /// <param name="order">Order with its payments loaded</param>
        /// <returns>True when it must be voided instead.</returns>
        public static bool KeptWhenCleared(Order order) =>
            order.Status != OrderStatus.Draft || order.Payments.Count > 0;

        #endregion

        #region Blank Drafts

        /// <summary>
        /// Whether an order is a blank draft: opened but with nothing added yet, so it has no number
        /// and isn't an order to anyone but the rep who opened it.
        /// </summary>
        /// <param name="order">The order</param>
        /// <returns>True for a blank draft.</returns>
        public static bool IsBlankDraft(Order order) => order.OrderNumber == null;

        /// <summary>
        /// Leaves out blank drafts (see IsBlankDraft).
        /// </summary>
        /// <param name="query">Orders</param>
        /// <returns>The orders that have a number.</returns>
        public static IQueryable<Order> WithoutBlankDrafts(this IQueryable<Order> query) =>
            query.Where(o => o.OrderNumber != null);

        #endregion

        #region Lines

        /// <summary>
        /// Whether a line counts as an item: anything sold or included in a bundle. Shipping rows
        /// and upcharges are charges on an item, not items.
        /// </summary>
        /// <param name="line">The line</param>
        /// <returns>True for an item.</returns>
        public static bool IsItem(OrderLine line) =>
            line.LineType is not (OrderLineType.Delivery or OrderLineType.Upcharge);

        /// <summary>
        /// Whether a line is an item the customer chose: a catalog or custom item, but not what
        /// comes with a bundle. Narrower than IsItem - this is what the receipt email talks about.
        /// </summary>
        /// <param name="line">The line</param>
        /// <returns>True for a chosen item.</returns>
        public static bool IsChosenItem(OrderLine line) =>
            line.LineType is OrderLineType.Product or OrderLineType.Custom;

        #endregion
    }

    /// <summary>
    /// What an order lacks before checkout can take it.
    /// </summary>
    public enum CheckoutGap
    {
        /// <summary>Nothing: it's ready.</summary>
        None = 0,

        /// <summary>It has no items.</summary>
        NoItems = 1,

        /// <summary>The customer's first or last name is missing.</summary>
        NoCustomerName = 2,
    }
}
