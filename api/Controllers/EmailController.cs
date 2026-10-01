using System.Diagnostics;
using api.Data;
using api.Dtos;
using api.Models;
using api.Services;
using api.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    /// <summary>
    /// Emailing a customer their receipt, and an event's full report. Both need the Email settings
    /// filled in; until they are, the dashboard shows the email buttons as unavailable.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class EmailController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService,
        EmailService email)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        private const string NotConfigured =
            "Email isn't set up on this server yet. Ask whoever runs the app to fill in the Email settings.";

        #endregion

        #region GET Methods

        /// <summary>
        /// Whether email is available, and the address it is sent from.
        /// </summary>
        /// <returns>{ configured, from }</returns>
        [HttpGet("status")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public IActionResult GetStatus()
        {
            return Ok(new { configured = email.IsConfigured, from = email.IsConfigured ? email.FromAddress : null });
        }

        #endregion

        #region POST Methods

        /// <summary>
        /// Emails the receipt for a completed sale.
        /// </summary>
        /// <param name="orderId">Order id</param>
        /// <param name="request">Who to send it to; defaults to the order's billing email</param>
        /// <returns>Where it was sent.</returns>
        [HttpPost("order/{orderId}/receipt")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SendReceipt(int orderId, [FromBody] EmailRequestDto? request)
        {
            try
            {
                if (!email.IsConfigured)
                    return BadRequest(new { error = NotConfigured });

                var order = await DB.Orders.AsNoTracking()
                    .Include(o => o.Event)
                    .Include(o => o.Lines)
                    .Include(o => o.Payments)
                    .FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null)
                    return NotFound(new { error = "Order not found." });
                if (order.Status != OrderStatus.Completed)
                    return BadRequest(new { error = "Only a completed sale has a receipt to send." });

                var to = string.IsNullOrWhiteSpace(request?.To) ? order.BillingEmail : request.To;
                if (!EmailService.TryParseRecipients(to, out var recipients))
                    return BadRequest(new { error = string.IsNullOrWhiteSpace(to)
                        ? "This customer has no email address. Enter one to send the receipt to."
                        : "Check the email address - it doesn't look right." });

                var (subject, html, text) = EmailTemplates.Receipt(order, order.Event);
                var failure = await TrySendAsync(() => email.SendAsync(recipients, subject, html, text));
                if (failure != null)
                    return failure;

                Trace(TraceEventType.Information, $"Receipt for order #{order.OrderNumber} emailed by {GetCurrentUserName()}.");
                return Ok(new { sentTo = recipients.Select(r => r.Address).ToList() });
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = $"The receipt couldn't be sent: {e.Message}", exception = e.Message });
            }
        }

        /// <summary>
        /// Emails an event's full report: totals, every sale, the inventory tally, and the sales
        /// and inventory as spreadsheets.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <param name="request">Recipients and an optional message</param>
        /// <returns>Where it was sent.</returns>
        [HttpPost("event/{eventId}/report")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SendEventReport(int eventId, [FromBody] EmailRequestDto? request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may email an event report." });
                if (!email.IsConfigured)
                    return BadRequest(new { error = NotConfigured });

                var saleEvent = await DB.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId);
                if (saleEvent == null)
                    return NotFound(new { error = "Event not found." });

                if (!EmailService.TryParseRecipients(request?.To, out var recipients))
                    return BadRequest(new { error = string.IsNullOrWhiteSpace(request?.To)
                        ? "Enter at least one email address."
                        : "Check the email addresses - separate them with commas, up to 10." });

                var stats = await DashboardController.BuildStatsAsync(DB, o => o.EventId == eventId);
                var orders = await DB.Orders.AsNoTracking()
                    .Include(o => o.Lines)
                    .Include(o => o.Payments)
                    .Where(o => o.EventId == eventId)
                    .ToListAsync();
                var inventory = await InventoryController.LoadItemsAsync(DB, eventId, null);

                var message = request?.Message?.Trim();
                if (message?.Length > 2000)
                    message = message[..2000];

                var (subject, html, text) = EmailTemplates.EventReport(saleEvent, stats, orders, inventory, message, GetCurrentUserName());
                var stem = $"{Slug(saleEvent.Organization)}-{saleEvent.EventDate:yyyy-MM-dd}";
                var attachments = new List<(string, string, byte[])>
                {
                    ($"{stem}-sales.csv", "text/csv", EmailTemplates.SalesCsv(orders)),
                };
                if (inventory.Count > 0)
                    attachments.Add(($"{stem}-inventory.csv", "text/csv", EmailTemplates.InventoryCsv(inventory)));

                var failure = await TrySendAsync(() => email.SendAsync(recipients, subject, html, text, attachments));
                if (failure != null)
                    return failure;

                Trace(TraceEventType.Information, $"Report for event {eventId} emailed by {GetCurrentUserName()}.");
                return Ok(new { sentTo = recipients.Select(r => r.Address).ToList() });
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = $"The report couldn't be sent: {e.Message}", exception = e.Message });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Sends, turning a mail server problem into a 502 the dashboard shows as a message, rather
        /// than a 500 that takes the user to the error page.
        /// </summary>
        /// <param name="send">The send to attempt</param>
        /// <returns>Null on success, otherwise the response to return.</returns>
        private async Task<IActionResult?> TrySendAsync(Func<Task> send)
        {
            try
            {
                await send();
                return null;
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Error, $"Email failed: {e.Message}");
                return StatusCode(502, new { error = $"The mail server didn't accept the message: {e.Message}" });
            }
        }

        private static string Slug(string value)
        {
            var chars = value.Trim().ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray();
            var slug = string.Join("-", new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
            return slug.Length == 0 ? "event" : slug.Length > 40 ? slug[..40].TrimEnd('-') : slug;
        }

        #endregion
    }
}
