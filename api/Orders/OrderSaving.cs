using Microsoft.EntityFrameworkCore;
using api.Data;
using api.Inventory;
using api.Models;
using api.Utils;

namespace api.Orders
{
    /// <summary>
    /// What a change to an order touched, which decides the bookkeeping that follows it.
    /// </summary>
    public enum OrderChange
    {
        /// <summary>
        /// Lines were added or removed: included items follow their bundle's Take With, the lines
        /// go back into sales sheet order, the order gets its number if it has none, and the
        /// totals are worked out again.
        /// </summary>
        Lines = 0,

        /// <summary>Something that changes the money: the totals are worked out again.</summary>
        Amounts = 1,

        /// <summary>Only the status or the order of the lines: the totals stand as they are.</summary>
        Other = 2,
    }

    /// <summary>
    /// The one way a changed order is saved, so no change can skip a step of its bookkeeping.
    /// </summary>
    public static class OrderSaving
    {
        #region Public Methods

        /// <summary>
        /// Does the bookkeeping a change calls for, stamps the order as updated and saves.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">Order with its lines and payments loaded, tracked</param>
        /// <param name="change">What the change touched</param>
        public static async Task SaveAsync(ApplicationDbContext db, Order order, OrderChange change)
        {
            if (change == OrderChange.Lines)
            {
                InventoryRules.SyncIncludedTakeWith(order);
                LineOrder.Normalize(order);
            }

            if (change is OrderChange.Lines or OrderChange.Amounts)
                OrderCalculator.RecalculateOrder(order);

            // A draft gets its number with its first item, so one opened just to look at prices
            // uses up no number.
            if (change == OrderChange.Lines)
                order.OrderNumber ??= await NextOrderNumberAsync(db, order.EventId);

            order.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Takes the event's next order number, in one statement so two reps adding their first
        /// item at the same moment can't both get the same number.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="eventId">The order's event</param>
        /// <returns>The number for the order.</returns>
        private static async Task<int> NextOrderNumberAsync(ApplicationDbContext db, int eventId)
        {
            var taken = await db.Database
                .SqlQuery<int>($@"UPDATE ""Events"" SET ""NextOrderNumber"" = ""NextOrderNumber"" + 1 WHERE ""Id"" = {eventId} RETURNING ""NextOrderNumber"" - 1 AS ""Value""")
                .ToListAsync();
            return taken.Single();
        }

        #endregion
    }
}
