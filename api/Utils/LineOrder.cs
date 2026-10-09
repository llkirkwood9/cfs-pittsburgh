using api.Models;

namespace api.Utils
{
    /// <summary>
    /// Keeps an order's lines in sales sheet order: each item, then the rows that belong to it -
    /// what a bundle includes, then upcharges, then shipping and services. Items keep the order
    /// the rep gave them; the rows under an item always follow that pattern, oldest first within
    /// each kind, so a row added later still lands in its place.
    /// </summary>
    public static class LineOrder
    {
        #region Public Methods

        /// <summary>
        /// Renumbers every line's SortOrder into sales sheet order.
        /// </summary>
        /// <param name="order">Order with its lines loaded</param>
        /// <param name="itemIds">The items in a new order; leave out to keep their current order</param>
        public static void Normalize(Order order, IReadOnlyList<int>? itemIds = null)
        {
            var items = Items(order);
            var position = itemIds == null
                ? null
                : itemIds.Select((id, index) => (id, index)).ToDictionary(p => p.id, p => p.index);

            var orderedItems = (position == null
                    ? items.OrderBy(l => l.SortOrder).ThenBy(Age)
                    : items.OrderBy(l => position.TryGetValue(l.Id, out var p) ? p : int.MaxValue).ThenBy(l => l.SortOrder).ThenBy(Age))
                .ToList();

            var next = 1;
            foreach (var item in orderedItems)
            {
                item.SortOrder = next++;
                foreach (var row in order.Lines
                             .Where(l => l != item && l.ParentLineId == item.Id && !items.Contains(l))
                             .OrderBy(l => Rank(l.LineType))
                             .ThenBy(l => l.SortOrder)
                             .ThenBy(Age))
                    row.SortOrder = next++;
            }
        }

        /// <summary>
        /// The lines that stand on their own: everything not attached to another line on the
        /// order. A row whose item has gone counts as an item, so it still prints.
        /// </summary>
        /// <param name="order">Order with its lines loaded</param>
        /// <returns>The item lines.</returns>
        public static List<OrderLine> Items(Order order)
        {
            return order.Lines
                .Where(l => l.ParentLineId == null || !order.Lines.Any(p => p != l && p.Id == l.ParentLineId))
                .ToList();
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Where a row sits under its item: included items, then upcharges, then shipping.
        /// </summary>
        private static int Rank(OrderLineType type) => type switch
        {
            OrderLineType.Included => 0,
            OrderLineType.Upcharge => 1,
            OrderLineType.Delivery => 2,
            _ => 3,
        };

        /// <summary>
        /// Oldest first: a line not saved yet has no id and is the newest.
        /// </summary>
        private static int Age(OrderLine line) => line.Id == 0 ? int.MaxValue : line.Id;

        #endregion
    }
}
