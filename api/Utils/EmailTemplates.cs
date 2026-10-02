using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using api.Models;

namespace api.Utils
{
    /// <summary>
    /// The wording of the emails the app sends. The sheets themselves travel as a PDF attachment;
    /// these are the messages that go with them, as HTML with inline styles (email clients ignore
    /// style sheets) plus a plain-text version. Every value that came from a person is
    /// HTML-encoded.
    /// </summary>
    public static class EmailTemplates
    {
        #region Private Fields

        private static readonly CultureInfo Us = CultureInfo.GetCultureInfo("en-US");

        private const string Wrapper = "font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#18181b;font-size:15px;line-height:1.55;";

        #endregion

        #region Public Methods

        /// <summary>
        /// The receipt email's body when an administrator hasn't written their own. Plain text:
        /// a blank line starts a new paragraph, lines starting with "- " make a bulleted list, and
        /// the {Placeholders} are filled in for each order.
        /// </summary>
        public const string DefaultReceiptBody =
            "Hi {FirstName},\n" +
            "\n" +
            "Thank you for your purchase, and for supporting {Organization}! Every sale at this event helps their fundraiser.\n" +
            "\n" +
            "Your receipt for order #{OrderNumber} is attached as a PDF. Please keep it with your records - it has your order details, payment and warranty information.\n" +
            "\n" +
            "{WhatHappensNext}\n" +
            "\n" +
            "Questions about your order or your warranty? Call our customer service team at {CustomerServicePhone} and mention order #{OrderNumber}.\n" +
            "\n" +
            "Sleep well, and thank you again!\n" +
            "{CompanyName}";

        /// <summary>
        /// The receipt email's subject line when an administrator hasn't written their own.
        /// </summary>
        public const string DefaultReceiptSubject = "Your receipt from {Organization} - order #{OrderNumber}";

        /// <summary>
        /// The longest receipt body an administrator can save.
        /// </summary>
        public const int MaxReceiptBodyLength = 5000;

        /// <summary>
        /// The longest receipt subject line an administrator can save.
        /// </summary>
        public const int MaxReceiptSubjectLength = 150;

        /// <summary>
        /// Every placeholder a receipt body can use, with what it becomes, for the settings screen.
        /// </summary>
        public static readonly IReadOnlyList<(string Name, string Description)> ReceiptPlaceholders =
        [
            ("FirstName", "The customer's first name, or \"there\" when there isn't one"),
            ("CustomerName", "The customer's full name"),
            ("Organization", "The organization the fundraiser is for"),
            ("OrderNumber", "The order number, e.g. 1017"),
            ("SaleDate", "The date of the sale, e.g. September 20, 2026"),
            ("Total", "The order total, e.g. $1,284.00"),
            ("BalanceDue", "What is still owed, e.g. $0.00"),
            ("SalesRep", "The sales rep's name"),
            ("CustomerServicePhone", "The customer service number, from the business details"),
            ("CompanyName", "The company's name, from the business details"),
            ("WhatHappensNext", "A \"What happens next\" list written for this order: take-home items; drop-ship items (shipped to their address, with a tracking email); white glove items (we call to schedule once they reach our Cleveland location, about 3-4 weeks after the event); a boxed mattress; keeping a protector on; and any balance owed. Put it on a line of its own."),
        ];

        /// <summary>
        /// The note to a customer that comes with their receipt.
        /// </summary>
        /// <param name="order">Completed order, with lines loaded</param>
        /// <param name="saleEvent">The event it was sold at</param>
        /// <param name="settings">The business details in force</param>
        /// <param name="body">The administrator's wording, or null for the default</param>
        /// <param name="subjectLine">The administrator's subject line, or null for the default</param>
        /// <returns>Subject, HTML and plain text.</returns>
        public static (string Subject, string Html, string Text) ReceiptMessage(
            Order order, Event? saleEvent, GeneralSettings settings, string? body = null, string? subjectLine = null)
        {
            var org = FirstNonBlank(order.Organization, saleEvent?.Organization) ?? "the fundraiser";

            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["FirstName"] = FirstName(order.BillingName) ?? "there",
                ["CustomerName"] = order.BillingName?.Trim() ?? string.Empty,
                ["Organization"] = org,
                ["OrderNumber"] = order.OrderNumber.ToString(Us),
                ["SaleDate"] = order.SaleDate.ToString("MMMM d, yyyy", Us),
                ["Total"] = Money(order.Total),
                ["BalanceDue"] = Money(order.BalanceDue),
                ["SalesRep"] = order.CfsRepName?.Trim() ?? string.Empty,
                ["CustomerServicePhone"] = settings.CustomerServicePhone,
                ["CompanyName"] = settings.CompanyName,
            };
            var next = WhatHappensNext(order);
            var template = string.IsNullOrWhiteSpace(body) ? DefaultReceiptBody : body;

            // One line of plain text: anything that would make it a second line is dropped.
            var subjectTemplate = string.IsNullOrWhiteSpace(subjectLine) ? DefaultReceiptSubject : subjectLine;
            var subject = Regex.Replace(Fill(subjectTemplate, values, next, false), @"\s+", " ").Trim();
            if (subject.Length == 0)
                subject = Fill(DefaultReceiptSubject, values, next, false);

            return (subject, RenderHtml(template, values, next), RenderText(template, values, next));
        }

        /// <summary>
        /// Placeholders in a receipt body that aren't recognised - most likely a typo - so the
        /// settings screen can point them out. They are sent as typed.
        /// </summary>
        /// <param name="body">Receipt body</param>
        /// <returns>The unrecognised names, without braces.</returns>
        public static List<string> UnknownPlaceholders(string? body)
        {
            var known = ReceiptPlaceholders.Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            return Placeholder.Matches(body ?? string.Empty)
                .Select(m => m.Groups[1].Value)
                .Where(name => !known.Contains(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        /// <summary>
        /// The note that comes with an event's sheets.
        /// </summary>
        /// <param name="saleEvent">The event</param>
        /// <param name="salesSheets">How many completed sales sheets the PDF holds</param>
        /// <param name="hasInventory">Whether the PDF ends with the inventory sheet</param>
        /// <param name="message">Optional note from the sender, shown first</param>
        /// <param name="sentBy">Who sent it</param>
        /// <param name="appName">The app's name, for the sign-off</param>
        /// <returns>Subject, HTML and plain text.</returns>
        public static (string Subject, string Html, string Text) ReportMessage(
            Event saleEvent, int salesSheets, bool hasInventory, string? message, string? sentBy, string appName)
        {
            var date = saleEvent.EventDate.ToString("MMMM d, yyyy", Us);
            var subject = $"{saleEvent.Organization} - event sheets ({saleEvent.EventDate:M/d/yy})";

            var parts = new List<string>();
            if (salesSheets > 0)
                parts.Add("the stat sheet");
            parts.Add($"{salesSheets} completed sales sheet{(salesSheets == 1 ? "" : "s")}");
            if (hasInventory)
                parts.Add("the accessory inventory sheet");
            var contents = parts.Count == 1 ? parts[0] : $"{string.Join(", ", parts.Take(parts.Count - 1))} and {parts[^1]}";
            var by = string.IsNullOrWhiteSpace(sentBy) ? "" : $" Sent by {sentBy}.";

            var html = new StringBuilder();
            html.Append($"<div style=\"{Wrapper}\">");
            html.Append($"<p style=\"margin:0 0 14px;\"><strong>{E(saleEvent.Organization)}</strong> &middot; {date}</p>");
            if (!string.IsNullOrWhiteSpace(message))
                html.Append($"<p style=\"margin:0 0 14px;padding:10px 12px;background:#f4f4f5;border-radius:8px;\">{E(message).Replace("\n", "<br>")}</p>");
            html.Append($"<p style=\"margin:0 0 14px;\">The event's sheets are attached as a single PDF: {E(contents)}.</p>");
            html.Append($"<p style=\"margin:0;font-size:12px;color:#71717a;\">From the {E(appName)} sales app.{E(by)}</p>");
            html.Append("</div>");

            var text = new StringBuilder();
            text.AppendLine($"{saleEvent.Organization} - {date}").AppendLine();
            if (!string.IsNullOrWhiteSpace(message))
                text.AppendLine(message).AppendLine();
            text.AppendLine($"The event's sheets are attached as a single PDF: {contents}.").AppendLine();
            text.AppendLine($"From the {appName} sales app.{by}");

            return (subject, html.ToString(), text.ToString());
        }

        /// <summary>
        /// A file-name-safe version of a name, such as "sample-school-band".
        /// </summary>
        /// <param name="value">Any text</param>
        /// <param name="fallback">Used when nothing usable is left</param>
        /// <returns>Lower case letters, digits and dashes, at most 40 characters.</returns>
        public static string Slug(string? value, string fallback)
        {
            var chars = (value ?? string.Empty).Trim().ToLowerInvariant().Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-').ToArray();
            var slug = string.Join("-", new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
            return slug.Length == 0 ? fallback : slug.Length > 40 ? slug[..40].TrimEnd('-') : slug;
        }

        #endregion

        #region Private Methods

        private static readonly Regex Placeholder = new(@"\{([A-Za-z]+)\}", RegexOptions.Compiled);

        /// <summary>
        /// What happens next for this particular order, in the order the customer will meet it.
        /// </summary>
        private static List<string> WhatHappensNext(Order order)
        {
            var products = order.Lines.Where(l => l.LineType is OrderLineType.Product or OrderLineType.Custom).ToList();
            var leaving = products.Where(l => !l.TakeWith).ToList();
            var takenHome = products.Any(l => l.TakeWith);
            var mattress = products.Any(l => l.Category == ProductCategory.Mattress);
            var deliverTo = DeliveryAddress(order);
            var at = deliverTo == null ? "" : $" at {deliverTo}";

            // How each item that isn't going home today reaches the customer. An item with no
            // service row is drop shipped, as the sales sheet's terms say.
            var byMethod = leaving.ToLookup(l => DeliveryFor(order, l));
            var dropShip = byMethod[Delivery.DropShip].ToList();
            var whiteGlove = byMethod[Delivery.WhiteGlove].ToList();
            var other = byMethod[Delivery.Other].ToList();
            var methods = new[] { dropShip, whiteGlove, other }.Count(g => g.Count > 0);
            var mixed = takenHome || methods > 1;

            var next = new List<string>();
            if (takenHome)
                next.Add(leaving.Count > 0
                    ? "The items you took home today are all yours - enjoy!"
                    : "Everything you bought went home with you today - enjoy!");

            // "Your order" when everything goes one way; otherwise named by how it travels.
            if (dropShip.Count > 0)
            {
                var plural = mixed && Units(dropShip) > 1;
                var what = mixed ? (plural ? "Your drop-ship items" : "Your drop-ship item") : "Your order";
                next.Add($"{what} will be shipped straight to your door{at}. You'll receive an email with tracking information " +
                         $"once {(plural ? "they ship" : "it ships")} - we won't be calling to confirm. Nobody needs to be home to sign for " +
                         $"{(plural ? "them" : "it")}.");
            }

            if (whiteGlove.Count > 0)
            {
                var plural = mixed && Units(whiteGlove) > 1;
                var what = mixed ? (plural ? "Your white glove items" : "Your white glove item") : "Your order";
                next.Add($"{what} will be delivered by our white glove team{at}. We'll contact you to schedule your delivery once " +
                         $"{(plural ? "they arrive" : "it arrives")} at our Cleveland location, typically about 3-4 weeks after the event. " +
                         "There's no confirmation call right after the event.");
            }

            if (other.Count > 0)
            {
                var names = string.Join(" and ", other
                    .Select(l => DeliveryLines(order, l).Select(d => d.Description.Trim()).FirstOrDefault(d => d.Length > 0))
                    .Where(n => n != null)
                    .Distinct(StringComparer.OrdinalIgnoreCase));
                next.Add(names.Length > 0
                    ? $"We'll be in touch about your {names}."
                    : "We'll be in touch about delivering the rest of your order.");
            }

            // Only a drop-shipped mattress comes compressed in a box.
            if (dropShip.Any(l => l.Category == ProductCategory.Mattress))
                next.Add("Your mattress arrives compressed and boxed. Once you open it, give it 24 to 48 hours to fully expand - it's fine to sleep on it sooner.");
            if (mattress)
                next.Add("Keep a mattress protector on your bed. The manufacturers require one for the warranty to stay valid.");
            if (order.BalanceDue > 0)
                next.Add($"A balance of {Money(order.BalanceDue)} remains on this order, as shown on your receipt.");
            return next;
        }

        private enum Delivery { DropShip, WhiteGlove, Other }

        /// <summary>The service rows (Drop Ship, White Glove and so on) under an item.</summary>
        private static IEnumerable<OrderLine> DeliveryLines(Order order, OrderLine item) =>
            order.Lines.Where(l => l.LineType == OrderLineType.Delivery && l.ParentLineId == item.Id && !l.TakeWith);

        /// <summary>
        /// How an item reaches the customer, from its service rows. White glove wins over drop
        /// ship, and an item with neither - no service row at all - is drop shipped. Add-ons
        /// such as Haul Away don't change how the item itself arrives.
        /// </summary>
        private static Delivery DeliveryFor(Order order, OrderLine item)
        {
            var names = DeliveryLines(order, item)
                .Select(d => new string(d.Description.ToLowerInvariant().Where(char.IsLetter).ToArray()))
                .ToList();
            if (names.Any(n => n.Contains("whiteglove")))
                return Delivery.WhiteGlove;
            if (names.Count == 0 || names.Any(n => n.Contains("dropship")))
                return Delivery.DropShip;
            if (names.All(n => n.Contains("haulaway")))
                return Delivery.DropShip;
            return Delivery.Other;
        }

        /// <summary>How many units a set of item rows adds up to.</summary>
        private static int Units(IEnumerable<OrderLine> items) => items.Sum(l => Math.Max(1, l.Quantity));

        /// <summary>Splits a plain-text body into blocks at blank lines.</summary>
        private static IEnumerable<string[]> Blocks(string template) =>
            Regex.Split(template.Replace("\r\n", "\n"), @"\n[ \t]*\n")
                .Select(b => b.Split('\n').Select(l => l.TrimEnd()).Where(l => l.Trim().Length > 0).ToArray())
                .Where(b => b.Length > 0);

        private static bool IsBullet(string line) => line.TrimStart().StartsWith("- ") || line.TrimStart().StartsWith("* ");

        private static string BulletText(string line) => line.TrimStart()[2..].Trim();

        private static bool IsNextBlock(string[] block) =>
            block.Length == 1 && block[0].Trim().Equals("{WhatHappensNext}", StringComparison.OrdinalIgnoreCase);

        /// <summary>Fills in the placeholders; the text is HTML-encoded first when html is set.</summary>
        private static string Fill(string text, Dictionary<string, string> values, List<string> next, bool html)
        {
            var source = html ? E(text) : text;
            return Placeholder.Replace(source, m =>
            {
                var name = m.Groups[1].Value;
                // Used mid-sentence rather than on its own line: the list reads as sentences.
                if (name.Equals("WhatHappensNext", StringComparison.OrdinalIgnoreCase))
                    return html ? E(string.Join(" ", next)) : string.Join(" ", next);
                if (!values.TryGetValue(name, out var value))
                    return m.Value;
                return html ? E(value) : value;
            });
        }

        /// <summary>The body as an email-ready HTML fragment with inline styles.</summary>
        private static string RenderHtml(string template, Dictionary<string, string> values, List<string> next)
        {
            var html = new StringBuilder($"<div style=\"{Wrapper}\">");
            foreach (var block in Blocks(template))
            {
                // {WhatHappensNext} on its own line becomes a heading and a list, or nothing at all.
                if (IsNextBlock(block))
                {
                    if (next.Count == 0)
                        continue;
                    html.Append("<p style=\"margin:20px 0 6px;font-weight:bold;\">What happens next</p><ul style=\"margin:0 0 14px;padding-left:20px;\">");
                    foreach (var item in next)
                        html.Append($"<li style=\"margin-bottom:6px;\">{E(item)}</li>");
                    html.Append("</ul>");
                    continue;
                }

                if (block.All(IsBullet))
                {
                    html.Append("<ul style=\"margin:0 0 14px;padding-left:20px;\">");
                    foreach (var line in block)
                        html.Append($"<li style=\"margin-bottom:6px;\">{Fill(BulletText(line), values, next, true)}</li>");
                    html.Append("</ul>");
                    continue;
                }

                var lines = block.Select(l => Fill(l.Trim(), values, next, true));
                html.Append($"<p style=\"margin:0 0 14px;\">{string.Join("<br>", lines)}</p>");
            }
            return html.Append("</div>").ToString();
        }

        /// <summary>The body as plain text, for mail apps that don't show HTML.</summary>
        private static string RenderText(string template, Dictionary<string, string> values, List<string> next)
        {
            var text = new StringBuilder();
            foreach (var block in Blocks(template))
            {
                if (IsNextBlock(block))
                {
                    if (next.Count == 0)
                        continue;
                    text.AppendLine("What happens next");
                    foreach (var item in next)
                        text.AppendLine($"- {item}");
                    text.AppendLine();
                    continue;
                }

                foreach (var line in block)
                    text.AppendLine(IsBullet(line) ? $"- {Fill(BulletText(line), values, next, false)}" : Fill(line.Trim(), values, next, false));
                text.AppendLine();
            }
            return text.ToString().TrimEnd() + Environment.NewLine;
        }

        private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

        private static string Money(decimal value) => value.ToString("C", Us);

        private static string? FirstNonBlank(params string?[] values) =>
            values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

        /// <summary>The first word of the billing name, when it looks like a name.</summary>
        private static string? FirstName(string? fullName)
        {
            var first = fullName?.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
            return first != null && first.Any(char.IsLetter) ? first : null;
        }

        /// <summary>Where shipped items go, as one line, or null when no address was taken.</summary>
        private static string? DeliveryAddress(Order order)
        {
            var (street, city, state, zip) = order.DeliverySameAsBilling
                ? (order.BillingAddress, order.BillingCity, order.BillingState, order.BillingZip)
                : (order.DeliveryAddress, order.DeliveryCity, order.DeliveryState, order.DeliveryZip);
            if (string.IsNullOrWhiteSpace(street))
                return null;
            var town = string.Join(" ", new[] { state, zip }.Where(s => !string.IsNullOrWhiteSpace(s)));
            return string.Join(", ", new[] { street, city, town }.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s!.Trim()));
        }

        #endregion
    }
}
