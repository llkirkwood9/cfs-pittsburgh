using api.Models;

namespace api.Utils
{
    /// <summary>
    /// Which of the statements a customer initials an order actually needs. Each statement says
    /// when to ask (Settings > Sales sheet terms): always, only when something on the order is
    /// shipped, or only when an item on it has a warranty. A pillow taken home today skips the
    /// warranty, drop ship and details steps; a mattress set being shipped asks all four.
    /// </summary>
    public static class Acknowledgements
    {
        /// <summary>Ask on every order.</summary>
        public const string Always = "always";

        /// <summary>Ask only when at least one item isn't being taken home today.</summary>
        public const string Shipped = "shipped";

        /// <summary>Ask only when at least one item has a manufacturer warranty.</summary>
        public const string Warranty = "warranty";

        /// <summary>Every value a statement's AskWhen may take.</summary>
        public static readonly IReadOnlyList<string> AskWhenValues = [Always, Shipped, Warranty];

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
            order.Lines.Any(l => IsItem(l) && !l.TakeWith);

        /// <summary>
        /// Whether any item on the order comes with a manufacturer warranty.
        /// </summary>
        /// <param name="order">Order entity with lines loaded</param>
        /// <returns>True when at least one item has one.</returns>
        public static bool HasWarranty(Order order) =>
            order.Lines.Any(l => IsItem(l) && l.HasWarranty);

        private static bool Applies(string? askWhen, Order order) => askWhen switch
        {
            Shipped => SomethingShips(order),
            Warranty => HasWarranty(order),
            _ => true,
        };

        // Shipping rows and upcharges are charges on an item, not items.
        private static bool IsItem(OrderLine line) =>
            line.LineType is not (OrderLineType.Delivery or OrderLineType.Upcharge);

        private static string? InitialsFor(Order order, string key) => key switch
        {
            "customerInfo" => order.CustomerInfoInitials,
            "warranty" => order.WarrantyInitials,
            "dropShip" => order.DropShipInitials,
            "advisory" => order.AdvisoryInitials,
            _ => null,
        };
    }
}
