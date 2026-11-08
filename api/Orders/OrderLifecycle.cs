using api.Data;
using api.Inventory;
using api.Models;
using api.Settings;
using api.Utils;

namespace api.Orders
{
    /// <summary>
    /// Who is moving an order along: recorded on the order and in the stock history, and the
    /// seniority some steps need.
    /// </summary>
    /// <param name="UserId">Their user id</param>
    /// <param name="Name">Their name</param>
    /// <param name="IsManager">Whether they are a manager or above</param>
    public sealed record OrderActor(int? UserId, string? Name, bool IsManager);

    /// <summary>
    /// Why a step was refused: a message, and whether it's a matter of who is asking (403) rather
    /// than of the order (400).
    /// </summary>
    /// <param name="Message">What to tell the user</param>
    /// <param name="Forbidden">True when the user may not do this at all</param>
    public sealed record OrderProblem(string Message, bool Forbidden = false);

    /// <summary>
    /// The steps that move an order between the sales floor, the checkout table, completed and
    /// voided. Each step checks what it needs, does its bookkeeping in the right order - stock,
    /// the terms the customer signed, the timestamps - and saves.
    /// </summary>
    public static class OrderLifecycle
    {
        #region Public Methods

        /// <summary>
        /// Hands a draft to the checkout table.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">Order with its lines, payments and event loaded, tracked</param>
        /// <returns>Why it can't be sent, or null once it has been.</returns>
        public static async Task<OrderProblem?> SubmitAsync(ApplicationDbContext db, Order order)
        {
            if (order.Status != OrderStatus.Draft)
                return new("Only a draft can be sent to checkout.");

            switch (OrderRules.MissingForCheckout(order))
            {
                case CheckoutGap.NoItems:
                    return new("Add at least one item before sending to checkout.");
                case CheckoutGap.NoCustomerName:
                    return new("Enter the customer's first and last name before sending to checkout.");
            }

            order.Status = OrderStatus.AwaitingCheckout;
            order.SubmittedAt = DateTime.UtcNow;
            await OrderSaving.SaveAsync(db, order, OrderChange.Amounts);
            return null;
        }

        /// <summary>
        /// Closes an order at the checkout table: checks it is paid toward, initialled and signed
        /// and that its Take With items are still in stock, keeps the wording the customer signed,
        /// and draws the Take With items out of stock. A balance may remain, which is how layaway
        /// and financing sales are recorded.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">Order with its lines, payments and event loaded, tracked</param>
        /// <param name="actor">Who is completing it</param>
        /// <returns>Why it can't be completed, or null once it has been.</returns>
        public static async Task<OrderProblem?> CompleteAsync(ApplicationDbContext db, Order order, OrderActor actor)
        {
            if (order.Status == OrderStatus.Voided)
                return new(OrderRules.VoidedMessage);

            if (order.Status == OrderStatus.Completed)
                return new("This order is already complete.");

            if (order.Lines.Count == 0)
                return new("An order needs at least one item before it can be completed.");

            if (order.Payments.Count == 0)
                return new("Record at least one payment before completing the order.");

            // The territory's wording is what the customer initials and signs.
            var terms = (await SettingsStore.LoadAsync(db, order.Event!.TerritoryId)).Terms;
            if (!Acknowledgements.IsComplete(order, terms))
                return new("The customer needs to initial each acknowledgement that applies and sign before the order can be completed.");

            // Another sale may have taken the last one since this order was written up.
            var stockError = await InventoryRules.CheckStockAsync(db, order);
            if (stockError != null)
                return new(stockError);

            order.Status = OrderStatus.Completed;
            order.CompletedAt = DateTime.UtcNow;
            // Keep the wording the customer just initialled with the sale.
            order.TermsJson = SalesTerms.Store(terms);
            order.CompletedByUserId = actor.UserId;
            order.ReceivedBy ??= actor.Name;
            order.ReceivedDate ??= DateTime.UtcNow;
            await InventoryRules.DeductForSaleAsync(db, order, order.Event!.TerritoryId, actor.UserId, actor.Name);
            await OrderSaving.SaveAsync(db, order, OrderChange.Amounts);
            return null;
        }

        /// <summary>
        /// Sends an order back to the checkout table or the sales floor. A completed sale drops out
        /// of the day's totals and puts back what it took from stock until it is completed again;
        /// a voided order comes back. Payments already recorded stay on the order.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">Order with its lines, payments and event loaded, tracked</param>
        /// <param name="target">Draft (the sales floor) or AwaitingCheckout</param>
        /// <param name="actor">Who is reopening it</param>
        /// <returns>Why it can't be reopened, or null once it has been.</returns>
        public static async Task<OrderProblem?> ReopenAsync(ApplicationDbContext db, Order order, OrderStatus target, OrderActor actor)
        {
            if (order.Status == OrderStatus.Completed && !actor.IsManager)
                return new("Only a manager, administrator or system admin may reopen a completed sale.", Forbidden: true);

            if (order.Status == OrderStatus.Voided && !actor.IsManager)
                return new("Only a manager, administrator or system admin may reopen a voided order.", Forbidden: true);

            // The checkout table needs the same as when a rep sends it over.
            if (order.Status == OrderStatus.Voided && target == OrderStatus.AwaitingCheckout)
            {
                switch (OrderRules.MissingForCheckout(order))
                {
                    case CheckoutGap.NoItems:
                        return new("This order has no items. Send it to the sales floor instead.");
                    case CheckoutGap.NoCustomerName:
                        return new("This order has no customer name. Send it to the sales floor instead.");
                }
            }

            if (order.Status == target)
                return new(target == OrderStatus.Draft
                    ? "This order is already on the sales floor."
                    : "This order is already at checkout.");

            // Anything the sale took home goes back on the shelf until it is completed again.
            await LeavingCompletedAsync(db, order, actor, "reopened");

            order.Status = target;
            order.SubmittedAt = target == OrderStatus.AwaitingCheckout
                ? DateTime.UtcNow
                : null;
            order.CompletedAt = null;
            order.CompletedByUserId = null;
            // Completing it again keeps the wording in force then.
            order.TermsJson = null;
            await OrderSaving.SaveAsync(db, order, OrderChange.Other);
            return null;
        }

        /// <summary>
        /// Voids an order. The row is kept for the audit trail but drops out of every total. The
        /// checkout table may void an order waiting there; anything on the sales floor or already
        /// completed takes a manager or above.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">Order with its lines, payments and event loaded, tracked</param>
        /// <param name="actor">Who is voiding it</param>
        /// <returns>Why it can't be voided, or null once it has been.</returns>
        public static async Task<OrderProblem?> VoidAsync(ApplicationDbContext db, Order order, OrderActor actor)
        {
            if (order.Status == OrderStatus.Voided)
                return new("This order has already been voided.");

            if (order.Status != OrderStatus.AwaitingCheckout && !actor.IsManager)
                return new("Only a manager, administrator or system admin may void this order.", Forbidden: true);

            await LeavingCompletedAsync(db, order, actor, "voided");

            order.Status = OrderStatus.Voided;
            await OrderSaving.SaveAsync(db, order, OrderChange.Other);
            return null;
        }

        /// <summary>
        /// Clears an open order at close-out: voids it when it has to be kept (see
        /// OrderRules.KeptWhenCleared), otherwise deletes it.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">Order with its lines, payments and event loaded, tracked</param>
        /// <param name="actor">Who is clearing it</param>
        /// <returns>Whether it was voided (rather than deleted), or why it can't be cleared.</returns>
        public static async Task<(bool Voided, OrderProblem? Problem)> ClearAsync(ApplicationDbContext db, Order order, OrderActor actor)
        {
            if (OrderRules.KeptWhenCleared(order))
                return (true, await VoidAsync(db, order, actor));

            db.Orders.Remove(order);
            await db.SaveChangesAsync();
            return (false, null);
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Puts back on the shelf anything a completed sale took home, when it stops being
        /// completed. Does nothing for an order in any other status. Runs before the status changes.
        /// </summary>
        private static async Task LeavingCompletedAsync(ApplicationDbContext db, Order order, OrderActor actor, string reason)
        {
            if (order.Status == OrderStatus.Completed)
                await InventoryRules.RestoreForOrderAsync(db, order, order.Event!.TerritoryId, actor.UserId, actor.Name, reason);
        }

        #endregion
    }
}
