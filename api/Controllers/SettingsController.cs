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
    /// Settings an administrator changes from the dashboard. For now that is the wording of the
    /// email that goes with a customer's receipt.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        private const string AdminOnly = "Only an administrator may change the app's settings.";

        #endregion

        #region GET Methods

        /// <summary>
        /// The receipt email's wording, with the default and the placeholders it can use.
        /// </summary>
        /// <returns>The settings.</returns>
        [HttpGet("receipt-email")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetReceiptEmail()
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var saved = await DB.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == AppSettingKeys.ReceiptEmailBody);
                return Ok(ToDto(saved));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the settings.", exception = e.Message });
            }
        }

        #endregion

        #region POST Methods

        /// <summary>
        /// Shows how a receipt body reads for a sample order, without saving it.
        /// </summary>
        /// <param name="request">The wording to try</param>
        /// <returns>The subject and body as they would be sent.</returns>
        [HttpPost("receipt-email/preview")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> PreviewReceiptEmail([FromBody] ReceiptEmailBodyDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var body = request.Body ?? string.Empty;
                if (body.Length > EmailTemplates.MaxReceiptBodyLength)
                    body = body[..EmailTemplates.MaxReceiptBodyLength];

                var saleEvent = await DB.Events.AsNoTracking()
                    .OrderByDescending(e => e.IsActive).ThenByDescending(e => e.EventDate)
                    .FirstOrDefaultAsync();
                var (subject, html, _) = EmailTemplates.ReceiptMessage(SampleOrder(saleEvent), saleEvent, body);

                return Ok(new ReceiptEmailPreviewDto
                {
                    Subject = subject,
                    Html = html,
                    UnknownPlaceholders = EmailTemplates.UnknownPlaceholders(body),
                });
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while previewing the email.", exception = e.Message });
            }
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Saves the receipt email's wording. Saving it empty, or exactly as the default, goes back
        /// to the default, so later improvements to the default reach it.
        /// </summary>
        /// <param name="request">The wording</param>
        /// <returns>The settings as saved.</returns>
        [HttpPut("receipt-email")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SaveReceiptEmail([FromBody] ReceiptEmailBodyDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var body = (request.Body ?? string.Empty).Replace("\r\n", "\n").Trim();
                if (body.Length > EmailTemplates.MaxReceiptBodyLength)
                    return BadRequest(new { error = $"The email can be at most {EmailTemplates.MaxReceiptBodyLength:N0} characters." });

                var saved = await DB.AppSettings.FirstOrDefaultAsync(s => s.Key == AppSettingKeys.ReceiptEmailBody);
                var useDefault = body.Length == 0 || body == EmailTemplates.DefaultReceiptBody;

                if (useDefault)
                {
                    if (saved != null)
                        DB.AppSettings.Remove(saved);
                    saved = null;
                }
                else
                {
                    if (saved == null)
                    {
                        saved = new AppSetting { Key = AppSettingKeys.ReceiptEmailBody };
                        DB.AppSettings.Add(saved);
                    }
                    saved.Value = body;
                    saved.UpdatedAt = DateTime.UtcNow;
                    saved.UpdatedBy = GetCurrentUserName();
                }

                await DB.SaveChangesAsync();
                Trace(TraceEventType.Information, $"Receipt email wording {(useDefault ? "reset to the default" : "changed")} by {GetCurrentUserName()}.");
                return Ok(ToDto(saved));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while saving the settings.", exception = e.Message });
            }
        }

        #endregion

        #region Internal Methods

        /// <summary>
        /// The receipt email's wording as saved, or null for the default.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <returns>The saved body, or null.</returns>
        internal static async Task<string?> LoadReceiptBodyAsync(ApplicationDbContext db)
        {
            return (await db.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == AppSettingKeys.ReceiptEmailBody))?.Value;
        }

        #endregion

        #region Private Methods

        private static ReceiptEmailSettingsDto ToDto(AppSetting? saved)
        {
            return new ReceiptEmailSettingsDto
            {
                Body = saved?.Value ?? EmailTemplates.DefaultReceiptBody,
                IsDefault = saved == null,
                DefaultBody = EmailTemplates.DefaultReceiptBody,
                MaxLength = EmailTemplates.MaxReceiptBodyLength,
                Placeholders = EmailTemplates.ReceiptPlaceholders
                    .Select(p => new PlaceholderDto { Name = p.Name, Description = p.Description })
                    .ToList(),
                UpdatedAt = saved?.UpdatedAt,
                UpdatedBy = saved?.UpdatedBy,
            };
        }

        /// <summary>
        /// A made-up order for the preview: a mattress being shipped and a pillow taken home, so
        /// every part of "What happens next" shows.
        /// </summary>
        private static Order SampleOrder(Event? saleEvent)
        {
            return new Order
            {
                OrderNumber = saleEvent?.NextOrderNumber ?? 1001,
                Organization = saleEvent?.Organization ?? "Sample School Band",
                SaleDate = saleEvent?.EventDate ?? DateTime.Today,
                BillingName = "Jamie Smith",
                BillingAddress = "123 Main Street",
                BillingCity = "Pittsburgh",
                BillingState = "PA",
                BillingZip = "15222",
                CfsRepName = "Alex Rivera",
                Total = 1284.00m,
                AmountPaid = 1284.00m,
                BalanceDue = 0m,
                Lines =
                [
                    new OrderLine { LineType = OrderLineType.Product, Category = ProductCategory.Mattress, Description = "Queen mattress" },
                    new OrderLine { LineType = OrderLineType.Product, Category = ProductCategory.Pillow, Description = "Pillow", TakeWith = true },
                ],
            };
        }

        #endregion
    }
}
