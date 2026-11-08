using api.Models;
using api.Settings;

namespace api.Orders
{
    /// <summary>
    /// Which of the statements a customer initials an order actually needs. Each statement says
    /// when to ask (Settings > Sales sheet terms): always, only when something on the order is
    /// shipped, or only when an item on it has a warranty. A pillow taken home today skips the
    /// warranty, drop ship and details steps; a mattress set being shipped asks all four.
    /// </summary>
    public static class Acknowledgements
    {
        /// <summary>
        /// The keys of the statements this order needs initialled, in signing order.
        /// </summary>
        /// <param name="order">Order entity with lines loaded</param>
        /// <param name="terms">The statements in force for the order</param>
        /// <returns>The keys that apply.</returns>
        public static List<string> RequiredTerms(Order order, IEnumerable<SalesTerm> terms) =>
            terms.Where(t => Applies(t.AskWhen, order)).Select(t => t.Key).ToList();

        /// <summary>
        /// Whether the customer has initialled every statement the order needs and signed -
        /// everything the sales sheet needs before the sale is final.
        /// </summary>
        /// <param name="order">Order entity with lines loaded</param>
        /// <param name="terms">The statements in force for the order</param>
        /// <returns>True when nothing is left to initial or sign.</returns>
        public static bool IsComplete(Order order, IEnumerable<SalesTerm> terms) =>
            !string.IsNullOrWhiteSpace(order.CustomerSignature)
            && RequiredTerms(order, terms).All(key => !string.IsNullOrWhiteSpace(InitialsFor(order, key)));

        /// <summary>
        /// Whether anything on the order is being shipped or delivered rather than taken home.
        /// </summary>
        /// <param name="order">Order entity with lines loaded</param>
        /// <returns>True when at least one item leaves some other way than with the customer.</returns>
        public static bool SomethingShips(Order order) =>
            order.Lines.Any(l => OrderRules.IsItem(l) && !l.TakeWith);

        /// <summary>
        /// Whether any item on the order comes with a manufacturer warranty.
        /// </summary>
        /// <param name="order">Order entity with lines loaded</param>
        /// <returns>True when at least one item has one.</returns>
        public static bool HasWarranty(Order order) =>
            order.Lines.Any(l => OrderRules.IsItem(l) && l.HasWarranty);

        private static bool Applies(string? askWhen, Order order) => askWhen switch
        {
            SalesTerms.Shipped => SomethingShips(order),
            SalesTerms.Warranty => HasWarranty(order),
            _ => true,
        };

        private static string? InitialsFor(Order order, string key) => key switch
        {
            SalesTerms.CustomerInfoKey => order.CustomerInfoInitials,
            SalesTerms.WarrantyKey => order.WarrantyInitials,
            SalesTerms.DropShipKey => order.DropShipInitials,
            SalesTerms.AdvisoryKey => order.AdvisoryInitials,
            _ => null,
        };
    }
}
