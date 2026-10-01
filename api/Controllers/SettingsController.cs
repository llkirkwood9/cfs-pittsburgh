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
    /// Settings an administrator changes from the dashboard: the business details printed on
    /// sheets and emails, the dashboard's levels, and the wording of the receipt email.
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
        /// The general settings in force, with their defaults. Open to anyone - the sign-in
        /// screen shows the app name - and nothing in it is private.
        /// </summary>
        /// <returns>The settings.</returns>
        [HttpGet("general")]
        [AllowAnonymous]
        public async Task<IActionResult> GetGeneral()
        {
            try
            {
                return Ok(ToDto(await SettingsStore.LoadAsync(DB), includeDefaults: true));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the settings.", exception = e.Message });
            }
        }

        /// <summary>
        /// The receipt email's subject and wording, with the defaults and the placeholders they
        /// can use.
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

                return Ok(await ReceiptEmailDtoAsync());
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
        /// Shows how a receipt email reads for a sample order, without saving it.
        /// </summary>
        /// <param name="request">The subject and wording to try</param>
        /// <returns>The subject and body as they would be sent.</returns>
        [HttpPost("receipt-email/preview")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> PreviewReceiptEmail([FromBody] ReceiptEmailBodyDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var body = Clip(request.Body, EmailTemplates.MaxReceiptBodyLength);
                var subject = Clip(request.Subject, EmailTemplates.MaxReceiptSubjectLength);

                var saleEvent = await DB.Events.AsNoTracking()
                    .OrderByDescending(e => e.IsActive).ThenByDescending(e => e.EventDate)
                    .FirstOrDefaultAsync();
                var settings = await SettingsStore.LoadAsync(DB);
                var sample = SampleOrder(saleEvent);
                var (sentSubject, html, _) = EmailTemplates.ReceiptMessage(sample, saleEvent, settings, body, subject);

                return Ok(new ReceiptEmailPreviewDto
                {
                    Subject = sentSubject,
                    Html = html,
                    AttachmentName = $"CFS-Receipt-{sample.OrderNumber}.pdf",
                    UnknownPlaceholders = EmailTemplates.UnknownPlaceholders(subject + "\n" + body),
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
        /// Saves the general settings. A field left out keeps its value; one set back to its
        /// default (or emptied) goes back to following the default.
        /// </summary>
        /// <param name="request">The settings to change</param>
        /// <returns>The settings in force afterwards.</returns>
        [HttpPut("general")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SaveGeneral([FromBody] GeneralSettingsDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var current = await SettingsStore.LoadAsync(DB);
                var appName = request.AppName?.Trim();
                var company = request.CompanyName?.Trim();
                var phone = request.CustomerServicePhone?.Trim();
                var firstAt = request.StarsFirstAt ?? current.StarsFirstAt;
                var every = request.StarsEvery ?? current.StarsEvery;
                var lowAt = request.LowStockAt ?? current.LowStockAt;

                if (appName?.Length > SettingsStore.MaxAppNameLength)
                    return BadRequest(new { error = $"The app name can be at most {SettingsStore.MaxAppNameLength} characters, so it fits in the menu bar." });
                if (company?.Length > SettingsStore.MaxCompanyNameLength)
                    return BadRequest(new { error = $"The company name can be at most {SettingsStore.MaxCompanyNameLength} characters, so it fits across a sales sheet." });
                if (phone?.Length > SettingsStore.MaxPhoneLength)
                    return BadRequest(new { error = $"The phone number can be at most {SettingsStore.MaxPhoneLength} characters." });
                if (firstAt <= 0 || firstAt > SettingsStore.MaxStarAmount || every <= 0 || every > SettingsStore.MaxStarAmount)
                    return BadRequest(new { error = $"Star amounts must be more than $0 and at most {SettingsStore.MaxStarAmount:C0}." });
                if (lowAt < 0 || lowAt > SettingsStore.MaxLowStockAt)
                    return BadRequest(new { error = $"The running-low level must be between 0 and {SettingsStore.MaxLowStockAt}." });

                var by = GetCurrentUserName();
                var defaults = SettingsStore.Defaults;
                if (request.AppName != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.AppName, appName, defaults.AppName, by);
                if (request.CompanyName != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.CompanyName, company, defaults.CompanyName, by);
                if (request.CustomerServicePhone != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.CustomerServicePhone, phone, defaults.CustomerServicePhone, by);
                if (request.StarsFirstAt != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.StarsFirstAt, SettingsStore.Store(firstAt), SettingsStore.Store(defaults.StarsFirstAt), by);
                if (request.StarsEvery != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.StarsEvery, SettingsStore.Store(every), SettingsStore.Store(defaults.StarsEvery), by);
                if (request.LowStockAt != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.LowStockAt, SettingsStore.Store(lowAt), SettingsStore.Store(defaults.LowStockAt), by);

                await DB.SaveChangesAsync();
                Trace(TraceEventType.Information, $"General settings changed by {by}.");
                return Ok(ToDto(await SettingsStore.LoadAsync(DB), includeDefaults: true));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while saving the settings.", exception = e.Message });
            }
        }

        /// <summary>
        /// Saves the receipt email's subject and wording. Either one saved empty, or exactly as
        /// its default, goes back to the default, so later improvements to it reach everyone.
        /// </summary>
        /// <param name="request">The subject and wording</param>
        /// <returns>The settings as saved.</returns>
        [HttpPut("receipt-email")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SaveReceiptEmail([FromBody] ReceiptEmailBodyDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var body = request.Body?.Replace("\r\n", "\n").Trim();
                var subject = request.Subject?.Replace("\r", " ").Replace("\n", " ").Trim();
                if (body?.Length > EmailTemplates.MaxReceiptBodyLength)
                    return BadRequest(new { error = $"The email can be at most {EmailTemplates.MaxReceiptBodyLength:N0} characters." });
                if (subject?.Length > EmailTemplates.MaxReceiptSubjectLength)
                    return BadRequest(new { error = $"The subject line can be at most {EmailTemplates.MaxReceiptSubjectLength} characters." });

                var by = GetCurrentUserName();
                if (request.Body != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.ReceiptEmailBody, body, EmailTemplates.DefaultReceiptBody, by);
                if (request.Subject != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.ReceiptEmailSubject, subject, EmailTemplates.DefaultReceiptSubject, by);
                await DB.SaveChangesAsync();

                var saved = await ReceiptEmailDtoAsync();
                Trace(TraceEventType.Information, $"Receipt email wording {(saved.IsDefault == true ? "reset to the default" : "changed")} by {by}.");
                return Ok(saved);
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
        /// The receipt email's saved subject and wording; null for either means its default.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <returns>The saved subject and body.</returns>
        internal static async Task<(string? Subject, string? Body)> LoadReceiptEmailAsync(ApplicationDbContext db)
        {
            var rows = await db.AppSettings.AsNoTracking()
                .Where(s => s.Key == AppSettingKeys.ReceiptEmailBody || s.Key == AppSettingKeys.ReceiptEmailSubject)
                .ToDictionaryAsync(s => s.Key, s => s.Value);
            return (rows.GetValueOrDefault(AppSettingKeys.ReceiptEmailSubject), rows.GetValueOrDefault(AppSettingKeys.ReceiptEmailBody));
        }

        #endregion

        #region Private Methods

        private static string? Clip(string? value, int max) =>
            value != null && value.Length > max ? value[..max] : value;

        private static GeneralSettingsDto ToDto(GeneralSettings settings, bool includeDefaults)
        {
            return new GeneralSettingsDto
            {
                AppName = settings.AppName,
                CompanyName = settings.CompanyName,
                CustomerServicePhone = settings.CustomerServicePhone,
                StarsFirstAt = settings.StarsFirstAt,
                StarsEvery = settings.StarsEvery,
                LowStockAt = settings.LowStockAt,
                Defaults = includeDefaults ? ToDto(SettingsStore.Defaults, includeDefaults: false) : null,
            };
        }

        private async Task<ReceiptEmailSettingsDto> ReceiptEmailDtoAsync()
        {
            var rows = await DB.AppSettings.AsNoTracking()
                .Where(s => s.Key == AppSettingKeys.ReceiptEmailBody || s.Key == AppSettingKeys.ReceiptEmailSubject)
                .ToListAsync();
            var body = rows.FirstOrDefault(r => r.Key == AppSettingKeys.ReceiptEmailBody);
            var subject = rows.FirstOrDefault(r => r.Key == AppSettingKeys.ReceiptEmailSubject);
            var latest = rows.OrderByDescending(r => r.UpdatedAt).FirstOrDefault();

            return new ReceiptEmailSettingsDto
            {
                Subject = subject?.Value ?? EmailTemplates.DefaultReceiptSubject,
                Body = body?.Value ?? EmailTemplates.DefaultReceiptBody,
                IsDefault = rows.Count == 0,
                DefaultSubject = EmailTemplates.DefaultReceiptSubject,
                DefaultBody = EmailTemplates.DefaultReceiptBody,
                MaxSubjectLength = EmailTemplates.MaxReceiptSubjectLength,
                MaxLength = EmailTemplates.MaxReceiptBodyLength,
                Placeholders = EmailTemplates.ReceiptPlaceholders
                    .Select(p => new PlaceholderDto { Name = p.Name, Description = p.Description })
                    .ToList(),
                UpdatedAt = latest?.UpdatedAt,
                UpdatedBy = latest?.UpdatedBy,
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
