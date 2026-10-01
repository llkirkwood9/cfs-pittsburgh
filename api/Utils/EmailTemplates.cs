using System.Globalization;
using System.Net;
using System.Text;
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

        private const string CustomerService = "440-381-2888";

        private const string Wrapper = "font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#18181b;font-size:15px;line-height:1.55;";

        #endregion

        #region Public Methods

        /// <summary>
        /// The note to a customer that comes with their receipt.
        /// </summary>
        /// <param name="order">Completed order, with lines loaded</param>
        /// <param name="saleEvent">The event it was sold at</param>
        /// <returns>Subject, HTML and plain text.</returns>
        public static (string Subject, string Html, string Text) ReceiptMessage(Order order, Event? saleEvent)
        {
            var org = FirstNonBlank(order.Organization, saleEvent?.Organization) ?? "the fundraiser";
            var firstName = FirstName(order.BillingName);
            var greeting = firstName == null ? "Hello," : $"Hi {firstName},";
            var subject = $"Your receipt from {org} - order #{order.OrderNumber}";

            var products = order.Lines.Where(l => l.LineType is OrderLineType.Product or OrderLineType.Custom).ToList();
            var takenHome = products.Any(l => l.TakeWith);
            var shipping = products.Any(l => !l.TakeWith);
            var mattress = products.Any(l => l.Category == ProductCategory.Mattress);
            var mattressShipped = products.Any(l => l.Category == ProductCategory.Mattress && !l.TakeWith);
            var deliverTo = DeliveryAddress(order);

            // What happens next, in the order the customer will meet it.
            var next = new List<string>();
            if (takenHome)
                next.Add(shipping
                    ? "The items you took home today are all yours - enjoy!"
                    : "Everything you bought went home with you today - enjoy!");
            if (shipping)
                next.Add($"{(takenHome ? "The rest" : "Your order")} will be shipped straight to your door{(deliverTo == null ? "" : $" at {deliverTo}")}. Nobody needs to be home to sign for it.");
            if (mattressShipped)
                next.Add("Your mattress arrives compressed and boxed. Once you open it, give it 24 to 48 hours to fully expand - it's fine to sleep on it sooner.");
            if (mattress)
                next.Add("Keep a mattress protector on your bed. The manufacturers require one for the warranty to stay valid.");
            if (order.BalanceDue > 0)
                next.Add($"A balance of {Money(order.BalanceDue)} remains on this order, as shown on your receipt.");

            var html = new StringBuilder();
            html.Append($"<div style=\"{Wrapper}\">");
            html.Append($"<p style=\"margin:0 0 14px;\">{E(greeting)}</p>");
            html.Append($"<p style=\"margin:0 0 14px;\">Thank you for your purchase, and for supporting <strong>{E(org)}</strong>! Every sale at this event helps their fundraiser.</p>");
            html.Append($"<p style=\"margin:0 0 14px;\">Your receipt for order <strong>#{order.OrderNumber}</strong> is attached as a PDF. Please keep it with your records - it has your order details, payment and warranty information.</p>");
            if (next.Count > 0)
            {
                html.Append("<p style=\"margin:20px 0 6px;font-weight:bold;\">What happens next</p><ul style=\"margin:0 0 14px;padding-left:20px;\">");
                foreach (var item in next)
                    html.Append($"<li style=\"margin-bottom:6px;\">{E(item)}</li>");
                html.Append("</ul>");
            }
            html.Append($"<p style=\"margin:0 0 14px;\">Questions about your order or your warranty? Call our customer service team at <a href=\"tel:+14403812888\" style=\"color:#0369a1;\">{CustomerService}</a> and mention order #{order.OrderNumber}.</p>");
            html.Append("<p style=\"margin:20px 0 0;\">Sleep well, and thank you again!</p>");
            html.Append("<p style=\"margin:4px 0 0;\"><strong>Custom Fundraising Solutions</strong></p>");
            html.Append("</div>");

            var text = new StringBuilder();
            text.AppendLine(greeting).AppendLine();
            text.AppendLine($"Thank you for your purchase, and for supporting {org}! Every sale at this event helps their fundraiser.").AppendLine();
            text.AppendLine($"Your receipt for order #{order.OrderNumber} is attached as a PDF. Please keep it with your records - it has your order details, payment and warranty information.").AppendLine();
            if (next.Count > 0)
            {
                text.AppendLine("What happens next");
                foreach (var item in next)
                    text.AppendLine($"- {item}");
                text.AppendLine();
            }
            text.AppendLine($"Questions about your order or your warranty? Call our customer service team at {CustomerService} and mention order #{order.OrderNumber}.").AppendLine();
            text.AppendLine("Sleep well, and thank you again!");
            text.AppendLine("Custom Fundraising Solutions");

            return (subject, html.ToString(), text.ToString());
        }

        /// <summary>
        /// The note that comes with an event's sheets.
        /// </summary>
        /// <param name="saleEvent">The event</param>
        /// <param name="salesSheets">How many completed sales sheets the PDF holds</param>
        /// <param name="hasInventory">Whether the PDF ends with the inventory sheet</param>
        /// <param name="message">Optional note from the sender, shown first</param>
        /// <param name="sentBy">Who sent it</param>
        /// <returns>Subject, HTML and plain text.</returns>
        public static (string Subject, string Html, string Text) ReportMessage(
            Event saleEvent, int salesSheets, bool hasInventory, string? message, string? sentBy)
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
            html.Append($"<p style=\"margin:0;font-size:12px;color:#71717a;\">From the CFS sales app.{E(by)}</p>");
            html.Append("</div>");

            var text = new StringBuilder();
            text.AppendLine($"{saleEvent.Organization} - {date}").AppendLine();
            if (!string.IsNullOrWhiteSpace(message))
                text.AppendLine(message).AppendLine();
            text.AppendLine($"The event's sheets are attached as a single PDF: {contents}.").AppendLine();
            text.AppendLine($"From the CFS sales app.{by}");

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
