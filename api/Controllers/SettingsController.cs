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
    /// Settings: the business details printed on sheets and emails, the sales sheet terms, the
    /// receipt email's wording, new-event rates and the dashboard's levels. System Admins and
    /// administrators set the company-wide values; each territory can override any of them (bar
    /// the app name) - its manager edits its own. A setting a territory hasn't changed follows the
    /// company-wide value, which in turn falls back to the built-in default.
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
        #region GET Methods

        /// <summary>
        /// What the sign-in screen needs before anyone has signed in: the app name. Nothing else
        /// is shared with an unauthenticated caller.
        /// </summary>
        /// <returns>{ appName }</returns>
        [HttpGet("public")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublic()
        {
            try
            {
                var settings = await SettingsStore.LoadAsync(DB);
                return Ok(new { appName = settings.AppName });
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting the settings.", e);
            }
        }

        /// <summary>
        /// The general settings in force for a territory, or company-wide. Any signed-in user can
        /// read their own territory's - the sales sheet prints them.
        /// </summary>
        /// <param name="territoryId">The territory; leave out for the company-wide settings (crew get their own territory's)</param>
        /// <returns>The settings, what they'd be without this scope's own values, and which are overridden.</returns>
        [HttpGet("general")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetGeneral([FromQuery] int? territoryId = null)
        {
            try
            {
                var (scopeId, problem) = await ResolveAsync(territoryId, editing: false);
                if (problem != null)
                    return problem;

                return Ok(await GeneralDtoAsync(scopeId));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting the settings.", e);
            }
        }

        /// <summary>
        /// The receipt email's subject and wording for a territory or company-wide, with what it'd
        /// be otherwise and the placeholders it can use.
        /// </summary>
        /// <param name="territoryId">The territory; leave out for company-wide</param>
        /// <returns>The settings.</returns>
        [HttpGet("receipt-email")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetReceiptEmail([FromQuery] int? territoryId = null)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden("Only a manager, administrator or system admin may see the email settings.");

                var (scopeId, problem) = await ResolveAsync(territoryId, editing: false);
                if (problem != null)
                    return problem;

                return Ok(await ReceiptEmailDtoAsync(scopeId));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting the settings.", e);
            }
        }

        #endregion

        #region POST Methods

        /// <summary>
        /// Shows how a receipt email reads for a sample order, without saving it, using the
        /// territory's business details.
        /// </summary>
        /// <param name="request">The subject and wording to try</param>
        /// <param name="territoryId">The territory being edited; leave out for company-wide</param>
        /// <returns>The subject and body as they would be sent.</returns>
        [HttpPost("receipt-email/preview")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> PreviewReceiptEmail([FromBody] ReceiptEmailBodyDto request, [FromQuery] int? territoryId = null)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden("Only a manager, administrator or system admin may preview the email.");

                var (scopeId, problem) = await ResolveAsync(territoryId, editing: false);
                if (problem != null)
                    return problem;

                var body = Clip(request.Body, EmailTemplates.MaxReceiptBodyLength);
                var subject = Clip(request.Subject, EmailTemplates.MaxReceiptSubjectLength);

                var saleEvent = await DB.Events.AsNoTracking()
                    .Where(e => scopeId == null || e.TerritoryId == scopeId)
                    .OrderByDescending(e => e.IsActive).ThenByDescending(e => e.EventDate)
                    .FirstOrDefaultAsync();
                var settings = await SettingsStore.LoadAsync(DB, scopeId);
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
                return ServerError("Internal error occurred while previewing the email.", e);
            }
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Saves general settings company-wide or for one territory. A field left out keeps its
        /// value; one set back to what it would otherwise be (or emptied) goes back to following
        /// that - the default company-wide, the company-wide value in a territory. The app name is
        /// company-wide only.
        /// </summary>
        /// <param name="request">The settings to change</param>
        /// <param name="territoryId">The territory; leave out for company-wide</param>
        /// <returns>The settings in force afterwards.</returns>
        [HttpPut("general")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SaveGeneral([FromBody] GeneralSettingsDto request, [FromQuery] int? territoryId = null)
        {
            try
            {
                var (scopeId, problem) = await ResolveAsync(territoryId, editing: true);
                if (problem != null)
                    return problem;

                if (scopeId != null && request.AppName != null)
                    return BadRequest(new { error = "The app name is the same for every territory - change it in the company-wide settings." });

                var current = await SettingsStore.LoadAsync(DB, scopeId);
                var fallback = scopeId == null ? SettingsStore.Defaults : await SettingsStore.LoadAsync(DB);

                var appName = request.AppName?.Trim();
                var company = request.CompanyName?.Trim();
                var phone = request.CustomerServicePhone?.Trim();
                var firstAt = request.StarsFirstAt ?? current.StarsFirstAt;
                var every = request.StarsEvery ?? current.StarsEvery;
                var lowAt = request.LowStockAt ?? current.LowStockAt;
                var taxRate = request.DefaultSalesTaxRate ?? current.DefaultSalesTaxRate;
                var feeRate = request.DefaultCcProcessingFeeRate ?? current.DefaultCcProcessingFeeRate;

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
                if (taxRate < 0 || taxRate > SettingsStore.MaxDefaultRate || feeRate < 0 || feeRate > SettingsStore.MaxDefaultRate)
                    return BadRequest(new { error = $"Rates must be between 0% and {SettingsStore.MaxDefaultRate:P0}." });

                List<SalesTerm>? terms = null;
                if (request.Terms != null)
                {
                    (terms, var termsProblem) = CheckTerms(request.Terms);
                    if (termsProblem != null)
                        return BadRequest(new { error = termsProblem });
                }

                var by = GetCurrentUserName();
                async Task Set(string key, string? value, string otherwise) =>
                    await SettingsStore.SetAsync(DB, key, value, otherwise, by, scopeId);

                if (request.AppName != null)
                    await Set(AppSettingKeys.AppName, appName, fallback.AppName);
                if (request.CompanyName != null)
                    await Set(AppSettingKeys.CompanyName, company, fallback.CompanyName);
                if (request.CustomerServicePhone != null)
                    await Set(AppSettingKeys.CustomerServicePhone, phone, fallback.CustomerServicePhone);
                if (request.StarsFirstAt != null)
                    await Set(AppSettingKeys.StarsFirstAt, SettingsStore.Store(firstAt), SettingsStore.Store(fallback.StarsFirstAt));
                if (request.StarsEvery != null)
                    await Set(AppSettingKeys.StarsEvery, SettingsStore.Store(every), SettingsStore.Store(fallback.StarsEvery));
                if (request.LowStockAt != null)
                    await Set(AppSettingKeys.LowStockAt, SettingsStore.Store(lowAt), SettingsStore.Store(fallback.LowStockAt));
                if (request.DefaultSalesTaxRate != null)
                    await Set(AppSettingKeys.DefaultSalesTaxRate, SettingsStore.Store(taxRate), SettingsStore.Store(fallback.DefaultSalesTaxRate));
                if (request.DefaultCcProcessingFeeRate != null)
                    await Set(AppSettingKeys.DefaultCcProcessingFeeRate, SettingsStore.Store(feeRate), SettingsStore.Store(fallback.DefaultCcProcessingFeeRate));
                if (terms != null)
                    await Set(AppSettingKeys.SalesSheetTerms, SettingsStore.Store(terms), SettingsStore.Store(fallback.Terms));
                if (request.AllowOtherFinanceType != null)
                    await Set(AppSettingKeys.AllowOtherFinanceType, SettingsStore.Store(request.AllowOtherFinanceType.Value), SettingsStore.Store(fallback.AllowOtherFinanceType));

                await DB.SaveChangesAsync();
                Trace(TraceEventType.Information, $"{(scopeId == null ? "Company-wide" : $"Territory {scopeId}")} settings changed by {by}.");
                return Ok(await GeneralDtoAsync(scopeId));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while saving the settings.", e);
            }
        }

        /// <summary>
        /// Saves the receipt email's subject and wording company-wide or for one territory. Either
        /// one saved empty, or exactly as it would otherwise be, goes back to following that.
        /// </summary>
        /// <param name="request">The subject and wording</param>
        /// <param name="territoryId">The territory; leave out for company-wide</param>
        /// <returns>The settings as saved.</returns>
        [HttpPut("receipt-email")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SaveReceiptEmail([FromBody] ReceiptEmailBodyDto request, [FromQuery] int? territoryId = null)
        {
            try
            {
                var (scopeId, problem) = await ResolveAsync(territoryId, editing: true);
                if (problem != null)
                    return problem;

                var body = request.Body?.Replace("\r\n", "\n").Trim();
                var subject = request.Subject?.Replace("\r", " ").Replace("\n", " ").Trim();
                if (body?.Length > EmailTemplates.MaxReceiptBodyLength)
                    return BadRequest(new { error = $"The email can be at most {EmailTemplates.MaxReceiptBodyLength:N0} characters." });
                if (subject?.Length > EmailTemplates.MaxReceiptSubjectLength)
                    return BadRequest(new { error = $"The subject line can be at most {EmailTemplates.MaxReceiptSubjectLength} characters." });

                var (otherSubject, otherBody) = scopeId == null
                    ? (EmailTemplates.DefaultReceiptSubject, EmailTemplates.DefaultReceiptBody)
                    : await CompanyReceiptEmailAsync();

                var by = GetCurrentUserName();
                if (request.Body != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.ReceiptEmailBody, body, otherBody, by, scopeId);
                if (request.Subject != null)
                    await SettingsStore.SetAsync(DB, AppSettingKeys.ReceiptEmailSubject, subject, otherSubject, by, scopeId);
                await DB.SaveChangesAsync();

                var saved = await ReceiptEmailDtoAsync(scopeId);
                Trace(TraceEventType.Information, $"Receipt email wording ({(scopeId == null ? "company-wide" : $"territory {scopeId}")}) changed by {by}.");
                return Ok(saved);
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while saving the settings.", e);
            }
        }

        #endregion

        #region Internal Methods

        /// <summary>
        /// The receipt email's subject and wording in force for a territory (or company-wide); null
        /// for either means the built-in wording.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory, or null for company-wide</param>
        /// <returns>The subject and body.</returns>
        internal static async Task<(string? Subject, string? Body)> LoadReceiptEmailAsync(ApplicationDbContext db, int? territoryId)
        {
            var rows = await SettingsStore.RowsAsync(db, territoryId, [AppSettingKeys.ReceiptEmailBody, AppSettingKeys.ReceiptEmailSubject]);
            return (rows.GetValueOrDefault(AppSettingKeys.ReceiptEmailSubject), rows.GetValueOrDefault(AppSettingKeys.ReceiptEmailBody));
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Works out which settings a request is about, and checks the user may see (or change) them:
        /// anyone signed in reads their own territory's; managers change their own territory's;
        /// system admins and administrators read and change any territory's and the company-wide ones.
        /// </summary>
        /// <param name="territoryId">The territory asked for, or null</param>
        /// <param name="editing">Whether the request changes them</param>
        /// <returns>The territory (null for company-wide), or the response to return instead.</returns>
        private async Task<(int? TerritoryId, IActionResult? Problem)> ResolveAsync(int? territoryId, bool editing)
        {
            var scope = Scope;

            // Crew always work in their own territory's settings.
            var resolved = scope.IsCompanyWide ? territoryId : territoryId ?? scope.HomeTerritoryId;

            if (resolved == null)
            {
                if (editing && !scope.IsCompanyWide)
                    return (null, Forbidden("Only a system admin or administrator can change the company-wide settings."));
                return (null, null);
            }

            if (!scope.CanSee(resolved))
                return (null, Forbidden("Those are another territory's settings."));

            if (!await DB.Territories.AnyAsync(t => t.Id == resolved))
                return (null, NotFound(new { error = "Territory not found." }));

            if (editing && !IsAtLeast(UserRole.Manager))
                return (null, Forbidden("Only a manager, administrator or system admin may change settings."));

            return (resolved, null);
        }

        private bool CanEdit(int? territoryId) =>
            territoryId == null ? Scope.IsCompanyWide : IsAtLeast(UserRole.Manager) && Scope.CanSee(territoryId);

        private async Task<GeneralSettingsDto> GeneralDtoAsync(int? territoryId)
        {
            var settings = await SettingsStore.LoadAsync(DB, territoryId);
            var otherwise = territoryId == null ? SettingsStore.Defaults : await SettingsStore.LoadAsync(DB);

            var dto = ToDto(settings);
            dto.TerritoryId = territoryId;
            dto.CanEdit = CanEdit(territoryId);
            dto.Defaults = ToDto(otherwise);
            dto.Overridden = territoryId == null ? null : await SettingsStore.OverriddenKeysAsync(DB, territoryId.Value);
            return dto;
        }

        /// <summary>
        /// Checks edited terms: each of the four must be there, with a paragraph, and short
        /// enough to keep the sales sheet on one page. A blank title falls back to the default.
        /// </summary>
        private static (List<SalesTerm>? Terms, string? Problem) CheckTerms(List<SalesTermDto> edited)
        {
            var result = new List<SalesTerm>();
            foreach (var d in SettingsStore.DefaultTerms)
            {
                var e = edited.FirstOrDefault(t => t.Key == d.Key);
                var text = e?.Text?.Replace("\r\n", "\n").Trim() ?? "";
                var title = e?.Title?.Trim();
                var heading = e?.Heading?.Trim() ?? "";
                if (text.Length == 0)
                    return (null, $"\"{d.Title}\" needs its paragraph - customers initial it.");
                if (text.Length > SettingsStore.MaxTermTextLength)
                    return (null, $"\"{title ?? d.Title}\" can be at most {SettingsStore.MaxTermTextLength:N0} characters, so the sales sheet still fits on one page.");
                if (title?.Length > SettingsStore.MaxTermHeadingLength || heading.Length > SettingsStore.MaxTermHeadingLength)
                    return (null, $"Titles and headings can be at most {SettingsStore.MaxTermHeadingLength} characters.");
                result.Add(new SalesTerm(d.Key, string.IsNullOrWhiteSpace(title) ? d.Title : title, heading, text));
            }
            return (result, null);
        }

        private static string? Clip(string? value, int max) =>
            value != null && value.Length > max ? value[..max] : value;

        private static GeneralSettingsDto ToDto(GeneralSettings settings)
        {
            return new GeneralSettingsDto
            {
                AppName = settings.AppName,
                CompanyName = settings.CompanyName,
                CustomerServicePhone = settings.CustomerServicePhone,
                StarsFirstAt = settings.StarsFirstAt,
                StarsEvery = settings.StarsEvery,
                LowStockAt = settings.LowStockAt,
                DefaultSalesTaxRate = settings.DefaultSalesTaxRate,
                DefaultCcProcessingFeeRate = settings.DefaultCcProcessingFeeRate,
                Terms = settings.Terms
                    .Select(t => new SalesTermDto { Key = t.Key, Title = t.Title, Heading = t.Heading, Text = t.Text })
                    .ToList(),
                AllowOtherFinanceType = settings.AllowOtherFinanceType,
            };
        }

        /// <summary>The company-wide subject and body in force (saved wording or the built-in).</summary>
        private async Task<(string Subject, string Body)> CompanyReceiptEmailAsync()
        {
            var (subject, body) = await LoadReceiptEmailAsync(DB, null);
            return (subject ?? EmailTemplates.DefaultReceiptSubject, body ?? EmailTemplates.DefaultReceiptBody);
        }

        private async Task<ReceiptEmailSettingsDto> ReceiptEmailDtoAsync(int? territoryId)
        {
            // This scope's own rows: the company-wide ones, or the territory's.
            List<(string Key, string Value, DateTime UpdatedAt, string? UpdatedBy)> own = territoryId == null
                ? (await DB.AppSettings.AsNoTracking()
                    .Where(s => s.Key == AppSettingKeys.ReceiptEmailBody || s.Key == AppSettingKeys.ReceiptEmailSubject)
                    .ToListAsync())
                    .Select(s => (s.Key, s.Value, s.UpdatedAt, s.UpdatedBy)).ToList()
                : (await DB.TerritorySettings.AsNoTracking()
                    .Where(s => s.TerritoryId == territoryId && (s.Key == AppSettingKeys.ReceiptEmailBody || s.Key == AppSettingKeys.ReceiptEmailSubject))
                    .ToListAsync())
                    .Select(s => (s.Key, s.Value, s.UpdatedAt, s.UpdatedBy)).ToList();

            var (otherSubject, otherBody) = territoryId == null
                ? (EmailTemplates.DefaultReceiptSubject, EmailTemplates.DefaultReceiptBody)
                : await CompanyReceiptEmailAsync();

            var body = own.FirstOrDefault(r => r.Key == AppSettingKeys.ReceiptEmailBody);
            var subject = own.FirstOrDefault(r => r.Key == AppSettingKeys.ReceiptEmailSubject);
            var latest = own.OrderByDescending(r => r.UpdatedAt).FirstOrDefault();

            return new ReceiptEmailSettingsDto
            {
                TerritoryId = territoryId,
                CanEdit = CanEdit(territoryId),
                Subject = subject.Value ?? otherSubject,
                Body = body.Value ?? otherBody,
                IsDefault = own.Count == 0,
                DefaultSubject = otherSubject,
                DefaultBody = otherBody,
                MaxSubjectLength = EmailTemplates.MaxReceiptSubjectLength,
                MaxLength = EmailTemplates.MaxReceiptBodyLength,
                Placeholders = EmailTemplates.ReceiptPlaceholders
                    .Select(p => new PlaceholderDto { Name = p.Name, Description = p.Description })
                    .ToList(),
                UpdatedAt = latest.Key == null ? null : latest.UpdatedAt,
                UpdatedBy = latest.UpdatedBy,
            };
        }

        /// <summary>
        /// A made-up order for the preview: a mattress by white glove, a protector by drop ship
        /// and a pillow taken home, so most of "What happens next" shows.
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
                    new OrderLine { Id = 1, LineType = OrderLineType.Product, Category = ProductCategory.Mattress, Description = "Queen mattress" },
                    new OrderLine { Id = 2, LineType = OrderLineType.Delivery, ParentLineId = 1, Description = "White Glove" },
                    new OrderLine { Id = 3, LineType = OrderLineType.Product, Category = ProductCategory.MattressProtector, Description = "Mattress protector" },
                    new OrderLine { Id = 4, LineType = OrderLineType.Delivery, ParentLineId = 3, Description = "Drop Ship" },
                    new OrderLine { Id = 5, LineType = OrderLineType.Product, Category = ProductCategory.Pillow, Description = "Pillow", TakeWith = true },
                ],
            };
        }

        #endregion
    }
}
