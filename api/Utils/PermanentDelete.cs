using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Utils
{
    /// <summary>
    /// Owner-only permanent deletes. Each one clears every reference to the record first, then
    /// removes it, inside one transaction, so nothing is left pointing at a row that no longer
    /// exists. The references are cleared here rather than by database cascades because SQL Server
    /// refuses more than one cascading path between two tables (Orders has two links to Users), and
    /// doing it in code behaves the same on SQL Server and PostgreSQL.
    ///
    /// What is kept: text already printed on a sale (item descriptions, brands, sizes, shipping
    /// names) stays on the order, because those are snapshots. What goes: the link to the deleted
    /// record, and any name that only identified the deleted person.
    /// </summary>
    public static class PermanentDelete
    {
        #region Public Methods

        /// <summary>
        /// Deletes orders with their lines and payments. Inventory history keeps its rows but loses
        /// the link to the order. Stock is not put back - an item that went home stays gone; void
        /// or reopen the sale first to return it.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="orderIds">Orders to delete</param>
        public static async Task OrdersAsync(ApplicationDbContext db, IReadOnlyCollection<int> orderIds)
        {
            if (orderIds.Count == 0)
                return;

            await db.InventoryAdjustments
                .Where(a => a.OrderId != null && orderIds.Contains(a.OrderId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.OrderId, (int?)null));

            await db.OrderPayments.Where(p => orderIds.Contains(p.OrderId)).ExecuteDeleteAsync();
            await db.OrderLines.Where(l => orderIds.Contains(l.OrderId)).ExecuteDeleteAsync();
            await db.Orders.Where(o => orderIds.Contains(o.Id)).ExecuteDeleteAsync();
        }

        /// <summary>
        /// Deletes an event and every order taken at it. Inventory history from the event keeps its
        /// rows but no longer belongs to an event.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="eventId">Event to delete</param>
        public static async Task EventAsync(ApplicationDbContext db, int eventId)
        {
            await using var transaction = await db.Database.BeginTransactionAsync();

            var orderIds = await db.Orders.Where(o => o.EventId == eventId).Select(o => o.Id).ToListAsync();
            await OrdersAsync(db, orderIds);

            await db.InventoryAdjustments
                .Where(a => a.EventId == eventId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.EventId, (int?)null));

            await db.Events.Where(e => e.Id == eventId).ExecuteDeleteAsync();
            await transaction.CommitAsync();
        }

        /// <summary>
        /// Deletes a crew account. Their sales stay, but everything that named them is cleared: who
        /// created and completed each order, the CFS rep name on the sales sheet, the received-by
        /// name, and who made each inventory change.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="user">The account to delete</param>
        public static async Task UserAsync(ApplicationDbContext db, User user)
        {
            await using var transaction = await db.Database.BeginTransactionAsync();

            var id = user.Id;
            var name = user.Name;

            // The rep name is text, so a sale they wrote up - or that names them as the rep - has
            // it blanked rather than left naming someone who is no longer on the crew.
            await db.Orders
                .Where(o => o.CreatedByUserId == id || o.CfsRepName == name)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.CfsRepName, (string?)null)
                    .SetProperty(o => o.CreatedByUserId, o => o.CreatedByUserId == id ? (int?)null : o.CreatedByUserId));

            await db.Orders
                .Where(o => o.CompletedByUserId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.CompletedByUserId, (int?)null));

            await db.Orders
                .Where(o => o.ReceivedBy == name)
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.ReceivedBy, (string?)null));

            await db.InventoryAdjustments
                .Where(a => a.UserId == id || a.UserName == name)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.UserId, (int?)null)
                    .SetProperty(a => a.UserName, (string?)null));

            await db.Users.Where(u => u.Id == id).ExecuteDeleteAsync();
            await transaction.CommitAsync();
        }

        /// <summary>
        /// Deletes a product and all its sizes. Past sales keep the item exactly as it was printed
        /// but lose the link to the catalog; bundles that included it lose that item; its inventory
        /// history goes with it.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="productId">Product to delete</param>
        public static async Task ProductAsync(ApplicationDbContext db, int productId)
        {
            await using var transaction = await db.Database.BeginTransactionAsync();

            var variantIds = await db.ProductVariants
                .Where(v => v.ProductId == productId)
                .Select(v => v.Id)
                .ToListAsync();

            await db.OrderLines
                .Where(l => l.ProductVariantId != null && variantIds.Contains(l.ProductVariantId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.ProductVariantId, (int?)null));

            await db.ProductVariantComponents
                .Where(c => variantIds.Contains(c.ComponentVariantId) || variantIds.Contains(c.BundleVariantId))
                .ExecuteDeleteAsync();

            await db.InventoryAdjustments.Where(a => variantIds.Contains(a.ProductVariantId)).ExecuteDeleteAsync();
            await db.ProductDeliveryOptions.Where(d => d.ProductId == productId).ExecuteDeleteAsync();
            await db.ProductVariants.Where(v => v.ProductId == productId).ExecuteDeleteAsync();
            await db.Products.Where(p => p.Id == productId).ExecuteDeleteAsync();

            await transaction.CommitAsync();
        }

        /// <summary>
        /// Deletes a delivery option. Past sales keep the shipping row as printed but lose the link
        /// to the option; products stop offering it.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="optionId">Delivery option to delete</param>
        public static async Task DeliveryOptionAsync(ApplicationDbContext db, int optionId)
        {
            await using var transaction = await db.Database.BeginTransactionAsync();

            await db.OrderLines
                .Where(l => l.DeliveryOptionId == optionId)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.DeliveryOptionId, (int?)null));

            await db.ProductDeliveryOptions.Where(d => d.DeliveryOptionId == optionId).ExecuteDeleteAsync();
            await db.DeliveryOptions.Where(d => d.Id == optionId).ExecuteDeleteAsync();

            await transaction.CommitAsync();
        }

        /// <summary>
        /// Clears the whole catalog: every product and delivery option, sold or not, with their
        /// sizes, selections, bundles, stock counts and inventory history. Past sales keep every
        /// line as printed but lose the links. Joins the caller's transaction when there is one,
        /// so a restore can clear and refill the catalog in one go.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <returns>How many products and delivery options were deleted.</returns>
        public static async Task<(int Products, int DeliveryOptions)> CatalogAsync(ApplicationDbContext db)
        {
            await using var transaction = db.Database.CurrentTransaction == null
                ? await db.Database.BeginTransactionAsync()
                : null;

            await db.OrderLines
                .Where(l => l.ProductVariantId != null)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.ProductVariantId, (int?)null));
            await db.OrderLines
                .Where(l => l.DeliveryOptionId != null)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.DeliveryOptionId, (int?)null));

            await db.ProductVariantComponents.ExecuteDeleteAsync();
            await db.InventoryAdjustments.ExecuteDeleteAsync();
            await db.ChoiceStocks.ExecuteDeleteAsync();
            await db.ProductDeliveryOptions.ExecuteDeleteAsync();
            await db.ProductOptionChoices.ExecuteDeleteAsync();
            await db.ProductOptions.ExecuteDeleteAsync();
            await db.ProductVariants.ExecuteDeleteAsync();
            var products = await db.Products.ExecuteDeleteAsync();
            var deliveryOptions = await db.DeliveryOptions.ExecuteDeleteAsync();

            if (transaction != null)
                await transaction.CommitAsync();

            return (products, deliveryOptions);
        }

        #endregion
    }
}
