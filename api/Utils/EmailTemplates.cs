using System.Globalization;
using System.Net;
using System.Text;
using api.Dtos;
using api.Models;

namespace api.Utils
{
    /// <summary>
    /// The emails the app sends: a customer's receipt, and an event's full report. Both are plain
    /// HTML with inline styles - email clients ignore style sheets - plus a plain-text version, and
    /// every value that came from a person is HTML-encoded.
    /// </summary>
    public static class EmailTemplates
    {
        #region Private Fields

        private static readonly CultureInfo Us = CultureInfo.GetCultureInfo("en-US");

        private const string CustomerService = "440-381-2888";

        private const string Font = "font-family:Arial,Helvetica,sans-serif;";
        private const string Cell = "padding:6px 8px;border-bottom:1px solid #e4e4e7;";
        private const string Head = "padding:6px 8px;border-bottom:2px solid #18181b;text-align:left;font-size:12px;text-transform:uppercase;color:#52525b;";

        #endregion

        #region Public Methods

        /// <summary>
        /// The customer's receipt for a completed sale.
        /// </summary>
        /// <param name="order">Order with lines and payments loaded</param>
        /// <param name="saleEvent">The event it was sold at</param>
        /// <returns>Subject, HTML and plain text.</returns>
        public static (string Subject, string Html, string Text) Receipt(Order order, Event? saleEvent)
        {
            var org = order.Organization ?? saleEvent?.Organization ?? "the fundraiser";
            var subject = $"Your receipt from {org} - order #{order.OrderNumber}";
            var date = order.SaleDate.ToString("MMMM d, yyyy", Us);

            var html = new StringBuilder();
            html.Append($"<div style=\"{Font}max-width:680px;margin:0 auto;color:#18181b;\">");
            html.Append("<h1 style=\"margin:0;font-size:22px;\">Custom Fundraising Solutions</h1>");
            html.Append($"<p style=\"margin:4px 0 16px;color:#52525b;font-size:13px;\">Customer service: {CustomerService}</p>");
            html.Append($"<p style=\"font-size:15px;\">Thank you for supporting <strong>{E(org)}</strong>! Here is your receipt.</p>");

            html.Append("<table style=\"width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;\">");
            Row(html, "Order", $"#{order.OrderNumber}");
            Row(html, "Date", date);
            if (!string.IsNullOrWhiteSpace(order.CfsRepName))
                Row(html, "Sales rep", E(order.CfsRepName));
            Row(html, "Customer", E(order.BillingName));
            var billing = AddressLines(order.BillingAddress, order.BillingUnit, order.BillingCity, order.BillingState, order.BillingZip);
            if (billing.Count > 0)
                Row(html, "Address", string.Join("<br>", billing.Select(E)));
            if (!order.DeliverySameAsBilling)
            {
                var delivery = AddressLines(order.DeliveryAddress, order.DeliveryUnit, order.DeliveryCity, order.DeliveryState, order.DeliveryZip);
                if (delivery.Count > 0)
                    Row(html, "Deliver to", string.Join("<br>", new[] { order.DeliveryName }.Concat(delivery).Where(l => !string.IsNullOrWhiteSpace(l)).Select(E)));
            }
            html.Append("</table>");

            // Items, each with its note and shipping rows underneath, as on the printed sheet.
            html.Append("<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">");
            html.Append($"<tr><th style=\"{Head}\">Item</th><th style=\"{Head}\">Size</th><th style=\"{Head}text-align:center;\">Qty</th><th style=\"{Head}text-align:right;\">Total</th></tr>");
            foreach (var line in PrintOrder(order.Lines))
            {
                var child = line.ParentLineId != null;
                var name = line.LineType switch
                {
                    OrderLineType.Delivery => $"<span style=\"color:#52525b;\">Shipping: {E(line.Description)}</span>",
                    OrderLineType.Included => $"<span style=\"color:#52525b;\">{E(line.Description)} (included)</span>",
                    _ => $"<strong>{E(Join(" ", line.Brand, line.Description))}</strong>{(line.TakeWith ? " <span style=\"color:#15803d;font-size:12px;\">TAKE WITH</span>" : "")}",
                };
                var price = line.LineType == OrderLineType.Included ? "Incl." : Money(line.LineTotal);
                if (line.DiscountPercent is > 0)
                    name += $" <span style=\"color:#52525b;font-size:12px;\">({line.DiscountPercent:0.##}% off)</span>";

                html.Append($"<tr><td style=\"{Cell}{(child ? "padding-left:22px;" : "")}\">{name}");
                if (!string.IsNullOrWhiteSpace(line.Notes))
                    html.Append($"<div style=\"color:#92400e;font-size:12px;font-style:italic;margin-top:2px;\">Note: {E(line.Notes).Replace("\n", "<br>")}</div>");
                html.Append($"</td><td style=\"{Cell}\">{E(line.LineType == OrderLineType.Delivery ? "" : line.Size)}</td>");
                html.Append($"<td style=\"{Cell}text-align:center;\">{(line.LineType == OrderLineType.Delivery ? "" : line.Quantity.ToString(Us))}</td>");
                html.Append($"<td style=\"{Cell}text-align:right;\">{price}</td></tr>");
            }
            html.Append("</table>");

            html.Append("<table style=\"width:100%;max-width:320px;margin:12px 0 0 auto;border-collapse:collapse;font-size:14px;\">");
            Total(html, "Subtotal", order.Subtotal);
            Total(html, $"Sales tax ({order.SalesTaxRate * 100:0.##}%)", order.TaxAmount);
            if (order.CcProcessingFee > 0)
                Total(html, "Card processing fee", order.CcProcessingFee);
            Total(html, "Total", order.Total, bold: true);
            foreach (var payment in order.Payments.OrderBy(p => p.Id))
                Total(html, $"Paid by {PaymentLabel(payment)}", payment.Amount);
            Total(html, "Balance due", order.BalanceDue, bold: true);
            html.Append("</table>");

            if (!string.IsNullOrWhiteSpace(order.Comments))
                html.Append($"<p style=\"font-size:14px;\"><strong>Comments:</strong> {E(order.Comments)}</p>");

            html.Append("<div style=\"margin-top:20px;padding-top:12px;border-top:1px solid #e4e4e7;font-size:12px;color:#3f3f46;line-height:1.5;\">");
            foreach (var (heading, body) in Terms)
                html.Append($"<p><strong>{heading}</strong> {body}</p>");
            html.Append($"<p>Questions about your order? Call customer service at {CustomerService}.</p>");
            html.Append("</div></div>");

            var text = new StringBuilder();
            text.AppendLine("Custom Fundraising Solutions");
            text.AppendLine($"Thank you for supporting {org}!");
            text.AppendLine();
            text.AppendLine($"Order #{order.OrderNumber} - {date}");
            if (!string.IsNullOrWhiteSpace(order.CfsRepName)) text.AppendLine($"Sales rep: {order.CfsRepName}");
            text.AppendLine($"Customer: {order.BillingName}");
            text.AppendLine();
            foreach (var line in PrintOrder(order.Lines))
            {
                var indent = line.ParentLineId != null ? "    " : "";
                var label = line.LineType == OrderLineType.Delivery ? $"Shipping: {line.Description}" : Join(" ", line.Brand, line.Size, line.Description);
                var price = line.LineType == OrderLineType.Included ? "Incl." : Money(line.LineTotal);
                text.AppendLine($"{indent}{(line.LineType == OrderLineType.Delivery ? "" : $"{line.Quantity} x ")}{label}  {price}");
                if (!string.IsNullOrWhiteSpace(line.Notes)) text.AppendLine($"{indent}  Note: {line.Notes}");
            }
            text.AppendLine();
            text.AppendLine($"Subtotal: {Money(order.Subtotal)}");
            text.AppendLine($"Sales tax: {Money(order.TaxAmount)}");
            if (order.CcProcessingFee > 0) text.AppendLine($"Card processing fee: {Money(order.CcProcessingFee)}");
            text.AppendLine($"Total: {Money(order.Total)}");
            foreach (var payment in order.Payments.OrderBy(p => p.Id))
                text.AppendLine($"Paid by {PaymentLabel(payment)}: {Money(payment.Amount)}");
            text.AppendLine($"Balance due: {Money(order.BalanceDue)}");
            text.AppendLine();
            foreach (var (heading, body) in Terms)
                text.AppendLine($"{heading} {body}").AppendLine();
            text.AppendLine($"Questions? Call customer service at {CustomerService}.");

            return (subject, html.ToString(), text.ToString());
        }

        /// <summary>
        /// The full report for an event: the stat sheet figures, every sale and the inventory tally.
        /// </summary>
        /// <param name="saleEvent">The event</param>
        /// <param name="stats">Stat sheet figures for it</param>
        /// <param name="orders">Its orders, with lines and payments loaded</param>
        /// <param name="inventory">Its inventory rows</param>
        /// <param name="message">Optional note from the sender, shown first</param>
        /// <param name="sentBy">Who sent it</param>
        /// <returns>Subject, HTML and plain text.</returns>
        public static (string Subject, string Html, string Text) EventReport(
            Event saleEvent, DashboardStatsDto stats, List<Order> orders, List<InventoryItemDto> inventory,
            string? message, string? sentBy)
        {
            var date = saleEvent.EventDate.ToString("MMMM d, yyyy", Us);
            var subject = $"{saleEvent.Organization} - event report ({saleEvent.EventDate:M/d/yy})";
            var completed = orders.Where(o => o.Status == OrderStatus.Completed).OrderBy(o => o.OrderNumber).ToList();

            var html = new StringBuilder();
            html.Append($"<div style=\"{Font}max-width:760px;margin:0 auto;color:#18181b;\">");
            html.Append($"<h1 style=\"margin:0;font-size:22px;\">{E(saleEvent.Organization)}</h1>");
            html.Append($"<p style=\"margin:4px 0 16px;color:#52525b;\">Event report &middot; {date}{(string.IsNullOrWhiteSpace(saleEvent.CartName) ? "" : $" &middot; Cart: {E(saleEvent.CartName)}")}</p>");
            if (!string.IsNullOrWhiteSpace(message))
                html.Append($"<p style=\"padding:10px 12px;background:#f4f4f5;border-radius:8px;font-size:14px;\">{E(message).Replace("\n", "<br>")}</p>");

            Section(html, "Totals");
            html.Append("<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">");
            Row(html, "Total sales", Money(stats.TotalSales));
            Row(html, "Net sales (before tax)", Money(stats.NetSales));
            Row(html, "Sales tax collected", Money(stats.TaxCollected));
            Row(html, "Card processing fees", Money(stats.CcProcessingFees));
            Row(html, "Completed sales", (stats.CompletedOrderCount ?? 0).ToString(Us));
            Row(html, "Average sale", Money(stats.AverageSale));
            Row(html, "Balances still owed", Money(stats.OutstandingBalance));
            html.Append("</table>");

            Section(html, "Taken by");
            html.Append("<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">");
            Row(html, "Credit/Debit Card", Money(stats.CreditCardTotal));
            Row(html, "Cash", Money(stats.CashTotal));
            Row(html, "Checks", Money(stats.CheckTotal));
            Row(html, "Financing", Money(stats.FinancingTotal));
            Row(html, "Layaway", Money(stats.LayawayTotal));
            html.Append("</table>");

            Section(html, "Units sold");
            html.Append("<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">");
            foreach (var (name, count) in new (string, int?)[]
                     {
                         ("Mattresses", stats.MattressCount), ("Adjustable bases", stats.AdjustableBaseCount),
                         ("Pillows", stats.PillowCount), ("Mattress protectors", stats.MattressProtectorCount),
                         ("Sheets", stats.SheetCount), ("Frames", stats.FrameCount),
                         ("Bean bag chairs", stats.BeanBagChairCount), ("Other", stats.MiscCount),
                     })
                Row(html, name, (count ?? 0).ToString(Us));
            html.Append("</table>");

            Section(html, $"Sales ({completed.Count})");
            html.Append("<table style=\"width:100%;border-collapse:collapse;font-size:13px;\">");
            html.Append($"<tr><th style=\"{Head}\">#</th><th style=\"{Head}\">Customer</th><th style=\"{Head}\">Rep</th><th style=\"{Head}text-align:right;\">Total</th><th style=\"{Head}text-align:right;\">Owed</th></tr>");
            foreach (var o in completed)
                html.Append($"<tr><td style=\"{Cell}\">{o.OrderNumber}</td><td style=\"{Cell}\">{E(o.BillingName)}</td><td style=\"{Cell}\">{E(o.CfsRepName)}</td><td style=\"{Cell}text-align:right;\">{Money(o.Total)}</td><td style=\"{Cell}text-align:right;\">{(o.BalanceDue > 0 ? Money(o.BalanceDue) : "")}</td></tr>");
            html.Append("</table>");

            var open = orders.Count(o => o.Status is OrderStatus.Draft or OrderStatus.AwaitingCheckout);
            if (open > 0)
                html.Append($"<p style=\"font-size:13px;color:#92400e;\">{open} order{(open == 1 ? " was" : "s were")} still open when this report was sent and {(open == 1 ? "is" : "are")} not included above.</p>");

            if (inventory.Count > 0)
            {
                Section(html, "Accessory inventory");
                html.Append("<table style=\"width:100%;border-collapse:collapse;font-size:13px;\">");
                html.Append($"<tr><th style=\"{Head}\">Item</th><th style=\"{Head}\">Size</th><th style=\"{Head}text-align:center;\">Start</th><th style=\"{Head}text-align:center;\">Take With sold</th><th style=\"{Head}text-align:center;\">Expected</th><th style=\"{Head}text-align:center;\">Counted</th><th style=\"{Head}text-align:center;\">Diff.</th></tr>");
                foreach (var i in inventory)
                {
                    var (expected, counted, diff) = InventoryFigures(i);
                    html.Append($"<tr><td style=\"{Cell}\">{E(i.ProductName)}</td><td style=\"{Cell}\">{E(Join(" - ", i.Size, i.Configuration))}</td>");
                    html.Append($"<td style=\"{Cell}text-align:center;\">{i.OpeningCountAtEvent?.ToString(Us)}</td><td style=\"{Cell}text-align:center;\">{i.SoldAtEvent ?? 0}</td>");
                    html.Append($"<td style=\"{Cell}text-align:center;\">{expected}</td><td style=\"{Cell}text-align:center;\">{counted}</td><td style=\"{Cell}text-align:center;\">{diff}</td></tr>");
                }
                html.Append("</table>");
                if (!string.IsNullOrWhiteSpace(saleEvent.InventoryNotes))
                    html.Append($"<p style=\"font-size:13px;\"><strong>Inventory notes:</strong> {E(saleEvent.InventoryNotes).Replace("\n", "<br>")}</p>");
            }

            html.Append($"<p style=\"margin-top:20px;font-size:12px;color:#71717a;\">The sales and inventory are attached as spreadsheets (CSV). Sent{(string.IsNullOrWhiteSpace(sentBy) ? "" : $" by {E(sentBy)}")} from the CFS sales app.</p>");
            html.Append("</div>");

            var text = new StringBuilder();
            text.AppendLine($"{saleEvent.Organization} - event report ({date})");
            if (!string.IsNullOrWhiteSpace(message)) text.AppendLine().AppendLine(message);
            text.AppendLine();
            text.AppendLine($"Total sales: {Money(stats.TotalSales)}");
            text.AppendLine($"Net sales: {Money(stats.NetSales)}");
            text.AppendLine($"Sales tax: {Money(stats.TaxCollected)}");
            text.AppendLine($"Completed sales: {stats.CompletedOrderCount ?? 0}");
            text.AppendLine($"Balances still owed: {Money(stats.OutstandingBalance)}");
            text.AppendLine();
            foreach (var o in completed)
                text.AppendLine($"#{o.OrderNumber}  {o.BillingName}  {Money(o.Total)}");
            text.AppendLine();
            text.AppendLine("The sales and inventory are attached as CSV files.");

            return (subject, html.ToString(), text.ToString());
        }

        /// <summary>
        /// The event's sales as a spreadsheet, one row per completed order.
        /// </summary>
        /// <param name="orders">Orders with lines and payments loaded</param>
        /// <returns>CSV bytes (UTF-8 with a BOM, so Excel reads it correctly).</returns>
        public static byte[] SalesCsv(List<Order> orders)
        {
            var csv = new StringBuilder();
            csv.AppendLine(string.Join(",", "Order #", "Sale date", "Customer", "Address", "City", "State", "Zip", "Cell",
                "Email", "Rep", "Items", "Subtotal", "Sales tax", "Card fee", "Total", "Paid", "Balance due", "Payments"));
            foreach (var o in orders.Where(o => o.Status == OrderStatus.Completed).OrderBy(o => o.OrderNumber))
            {
                var items = string.Join("; ", PrintOrder(o.Lines)
                    .Where(l => l.LineType is OrderLineType.Product or OrderLineType.Custom)
                    .Select(l => $"{l.Quantity} x {Join(" ", l.Size, l.Description)}{(string.IsNullOrWhiteSpace(l.Notes) ? "" : $" (Note: {l.Notes})")}"));
                var payments = string.Join("; ", o.Payments.OrderBy(p => p.Id).Select(p => $"{PaymentLabel(p)} {Money(p.Amount)}"));
                csv.AppendLine(string.Join(",", new[]
                {
                    o.OrderNumber.ToString(Us), o.SaleDate.ToString("yyyy-MM-dd", Us), o.BillingName, o.BillingAddress,
                    o.BillingCity, o.BillingState, o.BillingZip, o.BillingCell, o.BillingEmail, o.CfsRepName, items,
                    Plain(o.Subtotal), Plain(o.TaxAmount), Plain(o.CcProcessingFee), Plain(o.Total), Plain(o.AmountPaid),
                    Plain(o.BalanceDue), payments,
                }.Select(Csv)));
            }
            return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        }

        /// <summary>
        /// The event's inventory tally as a spreadsheet.
        /// </summary>
        /// <param name="inventory">Inventory rows</param>
        /// <returns>CSV bytes.</returns>
        public static byte[] InventoryCsv(List<InventoryItemDto> inventory)
        {
            var csv = new StringBuilder();
            csv.AppendLine("Item,Brand,Size,Start,Take With sold,Expected,Counted,Difference,On hand now");
            foreach (var i in inventory)
            {
                var (expected, counted, diff) = InventoryFigures(i);
                csv.AppendLine(string.Join(",", new[]
                {
                    i.ProductName, i.Brand, Join(" - ", i.Size, i.Configuration), i.OpeningCountAtEvent?.ToString(Us),
                    (i.SoldAtEvent ?? 0).ToString(Us), expected, counted, diff, (i.QuantityOnHand ?? 0).ToString(Us),
                }.Select(Csv)));
            }
            return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        }

        #endregion

        #region Private Methods

        /// <summary>The three paragraphs from the bottom of the sales sheet.</summary>
        private static readonly (string Heading, string Body)[] Terms =
        [
            ("Customer Service &amp; Warranty Information:",
                "All products come with a manufacturer warranty. Customer service and warranty issues are the responsibility of the manufacturer. " +
                "All manufacturers require the use of mattress protectors. They reserve the right to refuse service or invalidate the warranty if there are any stains or soils present even if the product is defective. " +
                "Sleep sets must be clean, free of tears, burns, odors, pet hair and stains of any kind for the warranty to be valid. Manufacturer warranties only cover the cost of the replacement item, not additional expenses such as delivery or set-up."),
            ("Drop Ship Delivery:",
                "All items will be drop shipped directly to the customer unless otherwise noted. Items do not require a signature when delivered. " +
                "The mattress will be compressed, vacuum sealed and boxed. Once open, the bed will completely recover within 24-48 hours; sleeping on it sooner will not damage the bed."),
            ("Advisory:",
                "This is a sanctioned fundraising event with a portion of the proceeds allocated directly to the organization, and therefore all sales and transactions are final."),
        ];

        private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

        private static string Money(decimal? value) => (value ?? 0m).ToString("C", Us);

        private static string Plain(decimal value) => value.ToString("0.00", Us);

        private static string Join(string separator, params string?[] parts) =>
            string.Join(separator, parts.Where(p => !string.IsNullOrWhiteSpace(p)));

        private static string Csv(string? value)
        {
            var v = value ?? string.Empty;
            // A leading =, +, - or @ would be run as a formula when the file is opened.
            if (v.Length > 0 && "=+-@".Contains(v[0]) && !decimal.TryParse(v, NumberStyles.Number, Us, out _))
                v = "'" + v;
            return v.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? $"\"{v.Replace("\"", "\"\"")}\"" : v;
        }

        private static string PaymentLabel(OrderPayment payment) => payment.Method switch
        {
            PaymentMethod.VisaMc => "Credit/Debit Card",
            PaymentMethod.Check => string.IsNullOrWhiteSpace(payment.CheckNumber) ? "Check" : $"Check #{payment.CheckNumber}",
            _ => payment.Method.ToString(),
        };

        private static void Row(StringBuilder html, string label, string valueHtml) =>
            html.Append($"<tr><td style=\"{Cell}color:#52525b;width:40%;\">{label}</td><td style=\"{Cell}\">{valueHtml}</td></tr>");

        private static void Total(StringBuilder html, string label, decimal value, bool bold = false) =>
            html.Append($"<tr><td style=\"padding:3px 8px;{(bold ? "font-weight:bold;border-top:1px solid #d4d4d8;" : "color:#52525b;")}\">{E(label)}</td>" +
                        $"<td style=\"padding:3px 8px;text-align:right;{(bold ? "font-weight:bold;border-top:1px solid #d4d4d8;" : "")}\">{Money(value)}</td></tr>");

        private static void Section(StringBuilder html, string title) =>
            html.Append($"<h2 style=\"margin:22px 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#52525b;\">{E(title)}</h2>");

        private static List<string> AddressLines(string? address, string? unit, string? city, string? state, string? zip)
        {
            var street = Join(", ", address, string.IsNullOrWhiteSpace(unit) ? null : $"Unit {unit}");
            var town = Join(", ", city, Join(" ", state, zip));
            return new[] { street, town }.Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
        }

        private static (string Expected, string Counted, string Difference) InventoryFigures(InventoryItemDto i)
        {
            if (i.CountedAtEvent == null)
                return ((i.QuantityOnHand ?? 0).ToString(Us), "", "");
            var expected = i.ExpectedAtCount ?? 0;
            var diff = i.CountedAtEvent.Value - expected;
            return (expected.ToString(Us), i.CountedAtEvent.Value.ToString(Us), diff > 0 ? $"+{diff}" : diff.ToString(Us));
        }

        /// <summary>
        /// The lines in sales-sheet order: each item, then what came in its bundle, then its
        /// shipping rows. Shipping rows set not to print, with no charge, are left out.
        /// </summary>
        private static List<OrderLine> PrintOrder(IEnumerable<OrderLine> lines)
        {
            var all = lines.Where(l => !(l.LineType == OrderLineType.Delivery && !l.ShowOnSalesSheet && l.LineTotal == 0))
                .OrderBy(l => l.SortOrder).ThenBy(l => l.Id).ToList();
            var result = new List<OrderLine>();
            foreach (var parent in all.Where(l => l.ParentLineId == null || all.All(p => p.Id != l.ParentLineId)))
            {
                result.Add(parent);
                result.AddRange(all.Where(l => l.ParentLineId == parent.Id && l.LineType == OrderLineType.Included));
                result.AddRange(all.Where(l => l.ParentLineId == parent.Id && l.LineType != OrderLineType.Included));
            }
            return result;
        }

        #endregion
    }
}
