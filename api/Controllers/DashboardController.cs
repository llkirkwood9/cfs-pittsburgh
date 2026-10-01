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
    /// The School Stat Sheet, computed live. Only completed orders feed the money figures;
    /// drafts and voided orders are reported separately so the floor can see work in progress
    /// without it inflating the day's numbers.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region GET Methods

        /// <summary>
        /// Stat sheet figures for one event.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <returns>The computed stat sheet.</returns>
        [HttpGet("stats/event/{eventId}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetStatsForEvent(int eventId)
        {
            try
            {
                var saleEvent = await DB.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId);
                if (saleEvent == null)
                    return NotFound(new { error = "Event not found." });

                var stats = await BuildStatsAsync(DB, o => o.EventId == eventId);
                stats.EventId = saleEvent.Id;
                stats.Organization = saleEvent.Organization;
                stats.EventDate = saleEvent.EventDate;

                return Ok(stats);
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the stats.", exception = e.Message });
            }
        }

        /// <summary>
        /// Stat sheet figures for a single calendar day across every event.
        /// </summary>
        /// <param name="date">Day to report on; defaults to today</param>
        /// <returns>The computed stat sheet.</returns>
        [HttpGet("stats/day")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetStatsForDay([FromQuery] DateTime? date = null)
        {
            try
            {
                var day = (date ?? DateTime.Today).Date;
                var next = day.AddDays(1);

                var stats = await BuildStatsAsync(DB, o => o.SaleDate >= day && o.SaleDate < next);
                stats.EventDate = day;

                return Ok(stats);
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the stats.", exception = e.Message });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Computes the stat sheet over whichever orders match the supplied filter.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="filter">Which orders to include</param>
        /// <returns>The computed stat sheet.</returns>
        private static async Task<DashboardStatsDto> BuildStatsAsync(
            ApplicationDbContext db,
            System.Linq.Expressions.Expression<Func<Order, bool>> filter)
        {
            var orders = await db.Orders
                .Where(filter)
                .Include(o => o.Lines)
                .Include(o => o.Payments)
                .AsNoTracking()
                .ToListAsync();

            var completed = orders.Where(o => o.Status == OrderStatus.Completed).ToList();
            var lines = completed.SelectMany(o => o.Lines).ToList();
            var payments = completed.SelectMany(o => o.Payments).ToList();

            var productLines = lines.Where(l => l.LineType != OrderLineType.Delivery).ToList();

            int UnitsIn(ProductCategory category) =>
                productLines.Where(l => l.Category == category).Sum(l => l.Quantity);

            int UnitsWithBrand(string brand) =>
                productLines
                    .Where(l => l.Category == ProductCategory.Mattress
                                && l.Brand != null
                                && l.Brand.Contains(brand, StringComparison.OrdinalIgnoreCase))
                    .Sum(l => l.Quantity);

            var mattressCount = UnitsIn(ProductCategory.Mattress);

            // A mattress sold on an adjustable-base variant counts in both columns, exactly as the
            // crew tallies it on the paper stat sheet.
            // Sets now carry their base as a separate Included row, which UnitsIn already counts.
            // Older orders taken before that row existed only have the flag on the mattress line,
            // so those are still counted from the flag.
            var setsWithBaseRow = lines
                .Where(l => l.LineType == OrderLineType.Included && l.ParentLineId != null)
                .Select(l => l.ParentLineId!.Value)
                .ToHashSet();

            var baseCount = UnitsIn(ProductCategory.AdjustableBase)
                            + productLines.Where(l => l.IncludesAdjustableBase
                                                      && l.Category != ProductCategory.AdjustableBase
                                                      && !setsWithBaseRow.Contains(l.Id))
                                .Sum(l => l.Quantity);

            decimal PaidBy(PaymentMethod method) =>
                Math.Round(payments.Where(p => p.Method == method).Sum(p => p.Amount), 2);

            var totalSales = Math.Round(completed.Sum(o => o.Total), 2);
            var netSales = Math.Round(completed.Sum(o => o.Subtotal), 2);

            return new DashboardStatsDto
            {
                MattressCount = mattressCount,
                PurpleCount = UnitsWithBrand("Purple"),
                HelixCount = UnitsWithBrand("Helix"),
                AdjustableBaseCount = baseCount,
                MattressProtectorCount = UnitsIn(ProductCategory.MattressProtector),
                PillowCount = UnitsIn(ProductCategory.Pillow),
                SheetCount = UnitsIn(ProductCategory.Sheets),
                FrameCount = UnitsIn(ProductCategory.Frame),
                BeanBagChairCount = UnitsIn(ProductCategory.BeanBagChair),
                MiscCount = UnitsIn(ProductCategory.Misc),
                MattressAndBaseCount = mattressCount + baseCount,

                TotalSales = totalSales,
                NetSales = netSales,
                TaxCollected = Math.Round(completed.Sum(o => o.TaxAmount), 2),
                CcProcessingFees = Math.Round(completed.Sum(o => o.CcProcessingFee), 2),
                AverageSale = completed.Count == 0 ? 0m : Math.Round(totalSales / completed.Count, 2),
                OutstandingBalance = Math.Round(completed.Sum(o => o.BalanceDue), 2),

                CreditCardTotal = PaidBy(PaymentMethod.VisaMc),
                CashTotal = PaidBy(PaymentMethod.Cash),
                CheckTotal = PaidBy(PaymentMethod.Check),
                FinancingTotal = PaidBy(PaymentMethod.Financing),
                LayawayTotal = PaidBy(PaymentMethod.Layaway),

                CompletedOrderCount = completed.Count,
                DraftOrderCount = orders.Count(o => o.Status == OrderStatus.Draft),
                AwaitingCheckoutCount = orders.Count(o => o.Status == OrderStatus.AwaitingCheckout),
                VoidedOrderCount = orders.Count(o => o.Status == OrderStatus.Voided),

                Sales = completed
                    .OrderBy(o => o.CompletedAt ?? o.UpdatedAt)
                    .Select(o => new SaleMomentDto { At = o.CompletedAt ?? o.UpdatedAt, Total = o.Total })
                    .ToList(),

                // Bundled items (a set's adjustable base, a free pillow) still count in their own
                // columns above, but the set itself is what was sold, so only it is listed here.
                TopProducts = productLines
                    .Where(l => l.LineType != OrderLineType.Included)
                    .GroupBy(l => new { l.Description, l.Brand, l.Category })
                    .Select(g => new ProductTallyDto
                    {
                        Description = g.Key.Description,
                        Brand = g.Key.Brand,
                        Category = g.Key.Category.ToString(),
                        Quantity = g.Sum(l => l.Quantity),
                        Revenue = Math.Round(g.Sum(l => l.LineTotal), 2),
                    })
                    .OrderByDescending(p => p.Quantity)
                    .ThenByDescending(p => p.Revenue)
                    .Take(15)
                    .ToList(),

                RepTotals = completed
                    .GroupBy(o => o.CfsRepName ?? "Unassigned")
                    .Select(g => new RepTallyDto
                    {
                        RepName = g.Key,
                        OrderCount = g.Count(),
                        Total = Math.Round(g.Sum(o => o.Total), 2),
                        AverageSale = Math.Round(g.Sum(o => o.Total) / g.Count(), 2),
                    })
                    .OrderByDescending(r => r.Total)
                    .ToList(),
            };
        }

        #endregion
    }
}
