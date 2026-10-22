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
    /// without it inflating the day's numbers. Figures cover the territory being viewed; system admins
    /// and administrators can also view every territory together, or compare them side by side.
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
                if (saleEvent == null || !CanSee(saleEvent))
                    return NotFound(new { error = "Event not found." });

                var stats = await BuildStatsAsync(DB, o => o.EventId == eventId);
                stats.EventId = saleEvent.Id;
                stats.Organization = saleEvent.Organization;
                stats.EventDate = saleEvent.EventDate;

                return Ok(stats);
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting the stats.", e);
            }
        }

        /// <summary>
        /// Stat sheet figures across every event in the territory being viewed, or across every
        /// territory for a system admin or administrator viewing them all, with each event's
        /// headline figures alongside.
        /// </summary>
        /// <returns>The computed stat sheet.</returns>
        [HttpGet("stats/all")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetStatsForAllEvents()
        {
            try
            {
                var visible = Scope.VisibleTerritoryIds;
                var several = visible == null || visible.Count > 1;

                var orders = await DB.Orders
                    .Where(o => visible == null || visible.Contains(o.Event!.TerritoryId))
                    .Include(o => o.Lines)
                    .Include(o => o.Payments)
                    .AsNoTracking()
                    .ToListAsync();
                var events = await DB.Events
                    .Where(e => visible == null || visible.Contains(e.TerritoryId))
                    .Include(e => e.Territory)
                    .AsNoTracking()
                    .ToListAsync();

                static List<Order> Completed(IEnumerable<Order> list) =>
                    list.Where(o => o.Status == OrderStatus.Completed).ToList();

                var stats = Build(Completed(orders), orders);
                stats.Events = events
                    .OrderByDescending(e => e.EventDate)
                    .ThenByDescending(e => e.Id)
                    .Select(e =>
                    {
                        var mine = orders.Where(o => o.EventId == e.Id).ToList();
                        var figures = Build(Completed(mine), mine);
                        return new EventTallyDto
                        {
                            EventId = e.Id,
                            Organization = e.Organization,
                            // Only needed to tell events apart when more than one territory is in view.
                            TerritoryName = several ? e.Territory?.Name : null,
                            EventDate = e.EventDate,
                            IsActive = e.IsActive,
                            CompletedOrderCount = figures.CompletedOrderCount ?? 0,
                            MattressAndBaseCount = figures.MattressAndBaseCount ?? 0,
                            NetSales = figures.NetSales ?? 0,
                            TotalSales = figures.TotalSales ?? 0,
                            AverageSale = figures.AverageSale ?? 0,
                        };
                    })
                    .ToList();
                stats.WorstProducts = await WorstSellersAsync(DB, orders, visible);

                return Ok(stats);
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting the stats.", e);
            }
        }

        /// <summary>
        /// Every territory side by side: the headline figures from each one's completed sales
        /// between two dates. System Admins and administrators only.
        /// </summary>
        /// <param name="from">First day to include; leave out for no lower limit</param>
        /// <param name="to">Last day to include; leave out for no upper limit</param>
        /// <returns>One row per territory, biggest total first.</returns>
        [HttpGet("stats/territories")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetTerritoryComparison([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
        {
            try
            {
                if (!Scope.CanSwitch)
                    return Forbidden("Comparing territories needs more than one territory.");

                var visible = Scope.IsCompanyWide ? null : Scope.MemberTerritoryIds.ToList();

                var start = from?.Date;
                var end = to?.Date.AddDays(1);

                var orders = await DB.Orders
                    .Where(o => o.Status == OrderStatus.Completed
                                && (visible == null || visible.Contains(o.Event!.TerritoryId))
                                && (start == null || o.SaleDate >= start)
                                && (end == null || o.SaleDate < end))
                    .Include(o => o.Event)
                    .Include(o => o.Lines)
                    .AsNoTracking()
                    .ToListAsync();

                var territories = await DB.Territories.AsNoTracking()
                    .Where(t => visible == null || visible.Contains(t.Id))
                    .OrderBy(t => t.Name)
                    .ToListAsync();
                var activeEvents = await DB.Events.AsNoTracking()
                    .Where(e => e.IsActive)
                    .Select(e => new { e.TerritoryId, e.Organization })
                    .ToListAsync();
                var activeByTerritory = activeEvents
                    .GroupBy(e => e.TerritoryId)
                    .ToDictionary(g => g.Key, g => g.First().Organization);

                var rows = territories
                    .Select(t =>
                    {
                        var mine = orders.Where(o => o.Event!.TerritoryId == t.Id).ToList();
                        var stats = Build(mine, []);
                        return new TerritoryStatsDto
                        {
                            TerritoryId = t.Id,
                            TerritoryName = t.Name,
                            IsActive = t.IsActive,
                            ActiveEvent = activeByTerritory.GetValueOrDefault(t.Id),
                            EventCount = mine.Select(o => o.EventId).Distinct().Count(),
                            CompletedOrderCount = stats.CompletedOrderCount,
                            TotalSales = stats.TotalSales,
                            NetSales = stats.NetSales,
                            AverageSale = stats.AverageSale,
                            MattressCount = stats.MattressCount,
                            AdjustableBaseCount = stats.AdjustableBaseCount,
                            OutstandingBalance = stats.OutstandingBalance,
                        };
                    })
                    // A switched-off territory with nothing in the dates is just clutter.
                    .Where(r => r.IsActive == true || r.CompletedOrderCount > 0)
                    .OrderByDescending(r => r.TotalSales)
                    .ThenBy(r => r.TerritoryName)
                    .ToList();

                return Ok(rows);
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while comparing territories.", e);
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
            var orders = await LoadOrdersAsync(db, filter);
            return Build(orders.Where(o => o.Status == OrderStatus.Completed).ToList(), orders);
        }

        /// <summary>
        /// The products in the catalog that have sold the fewest units in completed sales, fewest
        /// first, including any that have never sold. An item that comes in a set counts as sold,
        /// so a base that only ever goes out with a mattress is not listed as unpopular.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="orders">The orders to report on, with their lines</param>
        /// <param name="territories">The territories in view, whose products are listed; null for
        /// every territory's</param>
        /// <returns>Every product, worst sellers first. The dashboard filters by category and
        /// shows the top of the list.</returns>
        private static async Task<List<ProductTallyDto>> WorstSellersAsync(
            ApplicationDbContext db,
            List<Order> orders,
            List<int>? territories)
        {
            var products = await db.Products
                .AsNoTracking()
                .Where(p => p.IsActive)
                .Where(p => p.TerritoryId != null && (territories == null || territories.Contains(p.TerritoryId.Value)))
                .Select(p => new { p.Id, p.Name, p.Brand, p.Category, VariantIds = p.Variants.Select(v => v.Id).ToList() })
                .ToListAsync();

            var sold = orders
                .Where(o => o.Status == OrderStatus.Completed)
                .SelectMany(o => o.Lines)
                .Where(l => l.ProductVariantId != null
                            && l.LineType is not (OrderLineType.Delivery or OrderLineType.Upcharge))
                .GroupBy(l => l.ProductVariantId!.Value)
                .ToDictionary(g => g.Key, g => (Quantity: g.Sum(l => l.Quantity), Revenue: g.Sum(l => l.LineTotal)));

            return products
                .Select(p =>
                {
                    var tallies = p.VariantIds.Where(sold.ContainsKey).Select(id => sold[id]).ToList();
                    return new ProductTallyDto
                    {
                        Description = p.Name,
                        Brand = p.Brand,
                        Category = p.Category.ToString(),
                        Quantity = tallies.Sum(t => t.Quantity),
                        Revenue = Math.Round(tallies.Sum(t => t.Revenue), 2),
                    };
                })
                .OrderBy(p => p.Quantity)
                .ThenBy(p => p.Revenue)
                .ThenBy(p => p.Brand)
                .ThenBy(p => p.Description)
                .ToList();
        }

        /// <summary>
        /// Loads the orders matching a filter, with their lines and payments.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="filter">Which orders to include</param>
        /// <returns>The orders, read-only.</returns>
        private static Task<List<Order>> LoadOrdersAsync(
            ApplicationDbContext db,
            System.Linq.Expressions.Expression<Func<Order, bool>> filter) =>
            db.Orders
                .Where(filter)
                .Include(o => o.Lines)
                .Include(o => o.Payments)
                .AsNoTracking()
                .ToListAsync();

        /// <summary>
        /// Computes the stat sheet from orders already loaded.
        /// </summary>
        /// <param name="completed">Completed orders, with lines (and payments, for the payment totals)</param>
        /// <param name="orders">Every order in range, for the work-in-progress counts</param>
        /// <returns>The computed stat sheet.</returns>
        private static DashboardStatsDto Build(List<Order> completed, List<Order> orders)
        {
            var lines = completed.SelectMany(o => o.Lines).ToList();
            var payments = completed.SelectMany(o => o.Payments).ToList();

            // Shipping rows and upcharges are charges on an item, not items, so they never count.
            var productLines = lines.Where(l => l.LineType is not (OrderLineType.Delivery or OrderLineType.Upcharge)).ToList();

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
                // A blank draft, with no number yet, is a rep checking prices rather than a sale under way.
                DraftOrderCount = orders.Count(o => o.Status == OrderStatus.Draft && o.OrderNumber != null),
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
