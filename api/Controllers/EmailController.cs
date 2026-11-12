using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using api.Data;
using api.Dtos;
using api.Email;
using api.Inventory;
using api.Models;
using api.Services;
using api.Settings;
using api.Utils;

namespace api.Controllers
{
    /// <summary>
    /// Emailing a customer their receipt, and an event's sheets. The dashboard or app takes a
    /// picture of each sheet on screen - so the email matches the printed copy exactly - and
    /// uploads the pictures one page at a time while it makes the rest (see PageUploads); the send
    /// then makes them into a PDF, writes the message and sends it. A whole PDF uploaded with the
    /// send, as app builds from before page uploads do, is still taken. Both need the Email
    /// settings filled in; until they are, the dashboard says email isn't set up.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class EmailController(
        ApplicationDbContext db,
        ILogger<BasicController> logger,
        EmailService email,
        PageUploads pageUploads)
        : BasicController(db, logger)
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
        /// Starts uploading a stack of sheets, one page at a time, to email afterwards.
        /// </summary>
        /// <param name="request">How many pages there will be</param>
        /// <returns>{ uploadId }</returns>
        [HttpPost("pages")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public IActionResult StartPages([FromBody] PageUploadStartDto request)
        {
            if (!email.IsConfigured)
                return BadRequest(new { error = NotConfigured });
            if (request.PageCount is < 1 or > PageUploads.MaxPages)
                return BadRequest(new { error = $"A PDF can have 1 to {PageUploads.MaxPages} pages." });

            return Ok(new { uploadId = pageUploads.Start(GetCurrentUserId()!.Value, request.PageCount) });
        }

        /// <summary>
        /// Takes one page's picture. Sending a page again replaces it.
        /// </summary>
        /// <param name="uploadId">From StartPages</param>
        /// <param name="index">The page, from 0</param>
        /// <param name="page">The page as a JPEG</param>
        /// <returns>204 when kept.</returns>
        [HttpPut("pages/{uploadId:guid}/{index:int}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(PageUploads.MaxPageBytes + 64 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = PageUploads.MaxPageBytes + 64 * 1024)]
        public async Task<IActionResult> PutPage(Guid uploadId, int index, IFormFile? page)
        {
            if (page == null || page.Length == 0)
                return BadRequest(new { error = "The page didn't come through." });
            if (page.Length > PageUploads.MaxPageBytes)
                return BadRequest(new { error = "One page's picture is too large." });

            using var stream = new MemoryStream();
            await page.CopyToAsync(stream);
            var bytes = stream.ToArray();
            if (!ImagePdf.IsJpeg(bytes))
                return BadRequest(new { error = "That page isn't a JPEG picture." });

            var problem = pageUploads.Put(uploadId, GetCurrentUserId()!.Value, index, bytes, MaxPdfBytes);
            return problem == null ? NoContent() : BadRequest(new { error = problem });
        }

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
            if (!email.IsConfigured)
                return BadRequest(new { error = NotConfigured });

            var order = await DB.Orders.AsNoTracking()
                .Include(o => o.Event)
                .Include(o => o.Lines)
                .FirstOrDefaultAsync(o => o.Id == orderId);
            order = order.IfVisibleTo(Scope);
            if (order == null)
                return NotFound(new { error = "Order not found." });
            if (order.Status != OrderStatus.Completed)
                return BadRequest(new { error = "Only a completed sale has a receipt to send." });

            var to = string.IsNullOrWhiteSpace(request.To) ? order.BillingEmail : request.To;
            if (!EmailService.TryParseRecipients(to, out var recipients))
                return BadRequest(new { error = string.IsNullOrWhiteSpace(to)
                    ? "This customer has no email address. Enter one to send the receipt to."
                    : "Check the email address - it doesn't look right." });

            var (pdf, problem) = await ReadSheetsAsync(request, $"Sales sheet {order.OrderNumber}");
            if (problem != null)
                return problem;

            // The wording and business details are the order's territory's; the sender is the app.
            var territoryId = order.Event!.TerritoryId;
            var settings = await SettingsStore.LoadAsync(DB, territoryId);
            var (savedSubject, savedBody) = await SettingsStore.LoadReceiptEmailAsync(DB, territoryId);
            var (subject, html, text) = EmailTemplates.ReceiptMessage(order, order.Event, settings, savedBody, savedSubject);
            var attachment = (EmailTemplates.ReceiptAttachmentName(order), "application/pdf", pdf!);
            var failure = await TrySendAsync(request, () => email.SendAsync(recipients, subject, html, text, [attachment], fromName: settings.AppName));
            if (failure != null)
                return failure;

            Trace(TraceEventType.Information, $"Receipt for order #{order.OrderNumber} emailed by {GetCurrentUserName()}.");
            return Ok(new { sentTo = recipients.Select(r => r.Address).ToList() });
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
            if (!IsAtLeast(UserRole.Manager))
                return Forbidden("Only a manager, administrator or system admin may email an event report.");
            if (!email.IsConfigured)
                return BadRequest(new { error = NotConfigured });

            var saleEvent = (await DB.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId)).IfVisibleTo(Scope);
            if (saleEvent == null)
                return NotFound(new { error = "Event not found." });

            if (!EmailService.TryParseRecipients(request.To, out var recipients))
                return BadRequest(new { error = string.IsNullOrWhiteSpace(request.To)
                    ? "Enter at least one email address."
                    : "Check the email addresses - separate them with commas, up to 10." });

            var (pdf, problem) = await ReadSheetsAsync(request, $"{saleEvent.Organization} sheets");
            if (problem != null)
                return problem;

            var message = request.Message?.Trim();
            if (message?.Length > 2000)
                message = message[..2000];

            // Described from the database, matching what the sheets page puts in the PDF.
            var salesSheets = await DB.Orders.CountAsync(o => o.EventId == eventId && o.Status == OrderStatus.Completed);
            var hasInventory = (await InventorySheet.LoadItemsAsync(DB, saleEvent.TerritoryId, eventId, null)).Count > 0;

            var settings = await SettingsStore.LoadAsync(DB, saleEvent.TerritoryId);
            var (subject, html, text) = EmailTemplates.ReportMessage(saleEvent, salesSheets, hasInventory, message, GetCurrentUserName(), settings.AppName);
            var name = $"{EmailTemplates.Slug(saleEvent.Organization, "event")}-{saleEvent.EventDate:yyyy-MM-dd}-sheets.pdf";
            var failure = await TrySendAsync(request, () => email.SendAsync(recipients, subject, html, text, [(name, "application/pdf", pdf!)], fromName: settings.AppName));
            if (failure != null)
                return failure;

            Trace(TraceEventType.Information, $"Sheets for event {eventId} emailed by {GetCurrentUserName()}.");
            return Ok(new { sentTo = recipients.Select(r => r.Address).ToList() });
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// The sheets to attach: made from the pages uploaded for request.UploadId, or the whole
        /// PDF sent with the request.
        /// </summary>
        /// <param name="request">The send</param>
        /// <param name="title">The PDF's title</param>
        /// <returns>The PDF, or the response to return instead.</returns>
        private async Task<(byte[]? Pdf, IActionResult? Problem)> ReadSheetsAsync(EmailRequestDto request, string title)
        {
            if (request.UploadId is not { } uploadId)
                return await ReadPdfAsync(request.Pdf);

            var problem = pageUploads.Get(uploadId, GetCurrentUserId()!.Value, out var pages);
            return problem == null
                ? (ImagePdf.Build(pages, title), null)
                : (null, BadRequest(new { error = problem }));
        }

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
        /// than a 500 that takes the user to the error page. Uploaded pages are let go once sent,
        /// and kept when the send fails, so trying again doesn't upload them again.
        /// </summary>
        /// <param name="request">The send</param>
        /// <param name="send">The send to attempt</param>
        /// <returns>Null on success, otherwise the response to return.</returns>
        private async Task<IActionResult?> TrySendAsync(EmailRequestDto request, Func<Task> send)
        {
            try
            {
                await send();
                if (request.UploadId is { } uploadId)
                    pageUploads.Finish(uploadId);
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
