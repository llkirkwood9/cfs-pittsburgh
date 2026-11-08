using System.Diagnostics;
using System.Text.Json;
using api.Utils;

namespace api.Settings
{
    /// <summary>
    /// The four statements a customer initials on the sales sheet - their keys, when each is
    /// asked, the built-in wording - and how a territory's wording is stored. Which ones an order
    /// needs is decided by Orders.Acknowledgements.
    /// </summary>
    public static class SalesTerms
    {
        #region Public Fields

        /// <summary>Ask on every order.</summary>
        public const string Always = "always";

        /// <summary>Ask only when at least one item isn't being taken home today.</summary>
        public const string Shipped = "shipped";

        /// <summary>Ask only when at least one item has a manufacturer warranty.</summary>
        public const string Warranty = "warranty";

        /// <summary>Every value a statement's AskWhen may take.</summary>
        public static readonly IReadOnlyList<string> AskWhenValues = [Always, Shipped, Warranty];

        /// <summary>The statement confirming the customer's details.</summary>
        public const string CustomerInfoKey = "customerInfo";

        /// <summary>The warranty and mattress protector statement.</summary>
        public const string WarrantyKey = "warranty";

        /// <summary>The drop ship delivery statement.</summary>
        public const string DropShipKey = "dropShip";

        /// <summary>The all-sales-are-final statement.</summary>
        public const string AdvisoryKey = "advisory";

        /// <summary>
        /// The four statements a customer initials, in the order they're signed. The keys match
        /// the order's initials fields, so there are always exactly these four.
        /// </summary>
        public static readonly IReadOnlyList<SalesTerm> Defaults =
        [
            new(CustomerInfoKey, "Check your details", "",
                "Customer confirms the name, address, phone, email and delivery details above are correct.",
                Shipped),
            new(WarrantyKey, "Warranty & mattress protectors", "Customer Service & Warranty Information",
                "All products come with a manufacturer warranty. Customer service and warranty issues are the responsibility of the manufacturer. " +
                "All manufacturers require the use of mattress protectors. They reserve the right to refuse service or invalidate the warranty if there are " +
                "any stains or soils present even if the product is defective. Customer has been notified that sleep sets must be clean, free of tears, " +
                "burns, odors, pet hair and stains of any kind for the warranty to be valid. In addition, manufacturer warranties only cover the cost of " +
                "the replacement item, not additional expenses such as delivery or set-up.",
                Warranty),
            new(DropShipKey, "How your bed arrives", "Drop Ship Delivery",
                "**ALL ITEMS WILL BE DROP SHIPPED DIRECTLY TO THE CUSTOMER UNLESS OTHERWISE NOTED.** Items do not require a signature when delivered. " +
                "The mattress will be compressed, vacuum sealed and boxed. The product may be heavy and may require additional persons to move it. " +
                "Once open, the bed will completely recover within 24-48 hours, however, sleeping on it sooner will not damage the bed.",
                Shipped),
            new(AdvisoryKey, "All sales are final", "Advisory",
                "Customer acknowledges and understands that this is a sanctioned fundraising event with a portion of the proceeds allocated " +
                "directly to the above mentioned organization and therefore, **__ALL SALES AND TRANSACTIONS ARE FINAL__**.",
                Always),
        ];

        #endregion

        #region Public Methods

        /// <summary>
        /// Terms written for storing (and for a completed order's copy).
        /// </summary>
        public static string Store(IEnumerable<SalesTerm> terms) => JsonSerializer.Serialize(terms.ToList(), JsonOptions);

        /// <summary>
        /// Reads stored terms. Any of the four that is missing or blank falls back to its
        /// default, and anything else is ignored, so there are always exactly the four.
        /// </summary>
        /// <param name="json">Stored terms, or null</param>
        /// <returns>The four terms, in signing order.</returns>
        public static IReadOnlyList<SalesTerm> Read(string? json)
        {
            List<SalesTerm>? saved = null;
            if (!string.IsNullOrWhiteSpace(json))
            {
                try
                {
                    saved = JsonSerializer.Deserialize<List<SalesTerm>>(json, JsonOptions);
                }
                catch (JsonException e)
                {
                    // Stored wording that can't be read falls back to the defaults below.
                    TraceControl.Trace(TraceControlSource.Api, TraceEventType.Warning, $"Stored sales sheet terms couldn't be read, so the defaults are used: {e.Message}");
                    saved = null;
                }
            }

            return Defaults.Select(d =>
            {
                var s = saved?.FirstOrDefault(t => t.Key == d.Key);
                // Wording kept from before statements had a rule of their own takes the default.
                var askWhen = AskWhenOrDefault(s?.AskWhen, d.AskWhen);
                return s == null || string.IsNullOrWhiteSpace(s.Text)
                    ? d with { AskWhen = askWhen }
                    : new SalesTerm(d.Key, string.IsNullOrWhiteSpace(s.Title) ? d.Title : s.Title.Trim(), s.Heading?.Trim() ?? "", s.Text.Trim(), askWhen);
            }).ToList();
        }

        /// <summary>
        /// A statement's rule for when to ask, or its default when the value isn't one of the rules.
        /// </summary>
        /// <param name="askWhen">The rule as stored or sent</param>
        /// <param name="fallback">The statement's default rule</param>
        /// <returns>always, shipped or warranty.</returns>
        public static string AskWhenOrDefault(string? askWhen, string fallback) =>
            askWhen != null && AskWhenValues.Contains(askWhen) ? askWhen : fallback;

        #endregion

        #region Private Fields

        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        #endregion
    }

    /// <summary>
    /// One statement the customer initials, on the sales sheet and on their initialling screen.
    /// </summary>
    /// <param name="Key">customerInfo, warranty, dropShip or advisory - which initials it takes</param>
    /// <param name="Title">The heading on the customer's initialling screen</param>
    /// <param name="Heading">The underlined heading on the sales sheet; may be empty</param>
    /// <param name="Text">The paragraph, the same in both places. **bold** and __underline__ allowed.</param>
    /// <param name="AskWhen">When the customer is asked to initial it: always, shipped (something on
    /// the order isn't taken home) or warranty (an item has a warranty). Skipped, it prints N/A.</param>
    public record SalesTerm(string Key, string Title, string Heading, string Text, string AskWhen);
}
