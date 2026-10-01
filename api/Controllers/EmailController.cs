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
    /// Emailing a customer their receipt, and an event's sheets. The dashboard builds the PDF from
    /// the sheets on screen - so it matches the printed copy exactly - and uploads it here with
    /// the recipients; this controller writes the message and sends it. Both need the Email
    /// settings filled in; until they are, the dashboard says email isn't set up.
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

        /// <summary>
        /// Most mail services refuse a message over about 25 MB, and an attachment grows by a
        /// third when it is encoded, so the PDF itself has to stay under this.
        /// </summary>
        private const long MaxPdfBytes = 18 * 1024 * 1024;

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
        /// Emails a completed sale's receipt to the customer as a PDF, with a thank-you note.
        /// </summary>
        /// <param name="orderId">Order id</param>
        /// <param name="request">Who to send it to (defaults to the order's billing email) and the PDF</param>
        /// <returns>Where it was sent.</returns>
        [HttpPost("order/{orderId}/receipt")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxPdfBytes + 1024 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxPdfBytes + 1024 * 1024)]
        public async Task<IActionResult> SendReceipt(int orderId, [FromForm] EmailRequestDto request)
        {
            try
            {
                if (!email.IsConfigured)
                    return BadRequest(new { error = NotConfigured });

                var order = await DB.Orders.AsNoTracking()
                    .Include(o => o.Event)
                    .Include(o => o.Lines)
                    .FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null)
                    return NotFound(new { error = "Order not found." });
                if (order.Status != OrderStatus.Completed)
                    return BadRequest(new { error = "Only a completed sale has a receipt to send." });

                var to = string.IsNullOrWhiteSpace(request.To) ? order.BillingEmail : request.To;
                if (!EmailService.TryParseRecipients(to, out var recipients))
                    return BadRequest(new { error = string.IsNullOrWhiteSpace(to)
                        ? "This customer has no email address. Enter one to send the receipt to."
                        : "Check the email address - it doesn't look right." });

                var (pdf, problem) = await ReadPdfAsync(request.Pdf);
                if (problem != null)
                    return problem;

                var (subject, html, text) = EmailTemplates.ReceiptMessage(order, order.Event);
                var attachment = ($"CFS-Receipt-{order.OrderNumber}.pdf", "application/pdf", pdf!);
                var failure = await TrySendAsync(() => email.SendAsync(recipients, subject, html, text, [attachment]));
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
        /// Emails an event's sheets - the stat sheet, every completed sales sheet and the
        /// accessory inventory sheet - as a single PDF.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <param name="request">Recipients, an optional message and the PDF</param>
        /// <returns>Where it was sent.</returns>
        [HttpPost("event/{eventId}/report")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxPdfBytes + 1024 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxPdfBytes + 1024 * 1024)]
        public async Task<IActionResult> SendEventReport(int eventId, [FromForm] EmailRequestDto request)
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

                if (!EmailService.TryParseRecipients(request.To, out var recipients))
                    return BadRequest(new { error = string.IsNullOrWhiteSpace(request.To)
                        ? "Enter at least one email address."
                        : "Check the email addresses - separate them with commas, up to 10." });

                var (pdf, problem) = await ReadPdfAsync(request.Pdf);
                if (problem != null)
                    return problem;

                var message = request.Message?.Trim();
                if (message?.Length > 2000)
                    message = message[..2000];

                // Described from the database, matching what the sheets page puts in the PDF.
                var salesSheets = await DB.Orders.CountAsync(o => o.EventId == eventId && o.Status == OrderStatus.Completed);
                var hasInventory = (await InventoryController.LoadItemsAsync(DB, eventId, null)).Count > 0;

                var (subject, html, text) = EmailTemplates.ReportMessage(saleEvent, salesSheets, hasInventory, message, GetCurrentUserName());
                var name = $"{EmailTemplates.Slug(saleEvent.Organization, "event")}-{saleEvent.EventDate:yyyy-MM-dd}-sheets.pdf";
                var failure = await TrySendAsync(() => email.SendAsync(recipients, subject, html, text, [(name, "application/pdf", pdf!)]));
                if (failure != null)
                    return failure;

                Trace(TraceEventType.Information, $"Sheets for event {eventId} emailed by {GetCurrentUserName()}.");
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
        /// Reads the uploaded PDF, checking it is there, small enough to email, and really a PDF.
        /// </summary>
        /// <param name="file">The upload</param>
        /// <returns>The bytes, or the response to return instead.</returns>
        private async Task<(byte[]? Pdf, IActionResult? Problem)> ReadPdfAsync(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return (null, BadRequest(new { error = "The PDF didn't come through. Please try again." }));
            if (file.Length > MaxPdfBytes)
                return (null, BadRequest(new { error = "The PDF is too large to email. Print it, or save it as a PDF and share it another way." }));

            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            var bytes = stream.ToArray();

            if (bytes.Length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-')
                return (null, BadRequest(new { error = "That file isn't a PDF." }));

            return (bytes, null);
        }

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

        #endregion
    }
}
