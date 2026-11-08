using System.Diagnostics;
using api.Data;
using api.Dtos;
using api.Models;
using api.Orders;
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
        ILogger<BasicController> logger)
        : BasicController(db, logger)
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
            var saleEvent = (await DB.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId)).IfVisibleTo(Scope);
            if (saleEvent == null)
                return NotFound(new { error = "Event not found." });

            var orders = await LoadOrdersAsync(DB, o => o.EventId == eventId);
            var stats = Build(orders.Where(o => o.Status == OrderStatus.Completed).ToList(), orders);
            await AddRankingsAsync(DB, stats, orders, [saleEvent.TerritoryId], withWorst: false);
            stats.EventId = saleEvent.Id;
            stats.Organization = saleEvent.Organization;
            stats.EventDate = saleEvent.EventDate;

            return Ok(stats);
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
            var visible = Scope.VisibleTerritoryIds;
            var several = visible == null || visible.Count > 1;

            var orders = await DB.Orders
                .InTerritories(visible)
                .Include(o => o.Lines)
                .Include(o => o.Payments)
                .AsNoTracking()
                .ToListAsync();
            var events = await DB.Events
                .InTerritories(visible)
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
            await AddRankingsAsync(DB, stats, orders, visible, withWorst: true);

            return Ok(stats);
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
            if (!Scope.CanSwitch)
                return Forbidden("Comparing territories needs more than one territory.");

            var visible = Scope.OwnTerritoryIds;

            var start = from?.Date;
            var end = to?.Date.AddDays(1);

            var orders = await DB.Orders
                .InTerritories(visible)
                .Where(o => o.Status == OrderStatus.Completed
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

        #endregion

        #region Private Methods

        /// <summary>
        /// Adds the best sellers - and, when asked, the worst - with each product under the
        /// catalog category it is listed in now, and the categories in view to filter them by.
        /// An item no longer in the catalog, or one typed in, is listed under no category.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="stats">The stat sheet to add to</param>
        /// <param name="orders">The orders reported on, with their lines</param>
        /// <param name="territories">The territories in view; null for every territory</param>
        /// <param name="withWorst">Whether to list the worst sellers too</param>
        private static async Task AddRankingsAsync(
            ApplicationDbContext db, DashboardStatsDto stats, List<Order> orders, List<int>? territories, bool withWorst)
        {
            // Bundled items (a set's adjustable base, a free pillow) still count in their own
            // stat-sheet columns, but the set itself is what was sold, so only it is listed here.
            var lines = orders
                .Where(o => o.Status == OrderStatus.Completed)
                .SelectMany(o => o.Lines)
                .Where(l => OrderRules.IsItem(l) && l.LineType != OrderLineType.Included)
                .ToList();
            var variantIds = lines.Where(l => l.ProductVariantId != null).Select(l => l.ProductVariantId!.Value).Distinct().ToList();
            var categoryOf = await db.ProductVariants
                .AsNoTracking()
                .Where(v => variantIds.Contains(v.Id))
                .Select(v => new { v.Id, v.Product!.Category!.Name })
                .ToDictionaryAsync(v => v.Id, v => v.Name);

            // Same product from different territories' catalogs counts as one, even if typed with
            // different capitals or spacing.
            stats.TopProducts = lines
                .GroupBy(l => (
                    Description: TallyKey(l.Description),
                    Brand: TallyKey(l.Brand),
                    Category: l.ProductVariantId is { } id ? categoryOf.GetValueOrDefault(id) : null))
                .Select(g => new ProductTallyDto
                {
                    Description = g.First().Description,
                    Brand = g.First().Brand,
                    Category = g.Key.Category,
                    Quantity = g.Sum(l => l.Quantity),
                    Revenue = Math.Round(g.Sum(l => l.LineTotal), 2),
                })
                .OrderByDescending(p => p.Quantity)
                .ThenByDescending(p => p.Revenue)
                .ToList();

            if (withWorst)
                stats.WorstProducts = await WorstSellersAsync(db, orders, territories);

            // Each name once, in tab order, when several territories are in view.
            var categories = await db.Categories
                .AsNoTracking()
                .InTerritories(territories)
                .OrderBy(c => c.SortOrder)
                .ThenBy(c => c.Name)
                .Select(c => c.Name)
                .ToListAsync();
            stats.RankingCategories = categories.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
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
                .InTerritories(territories)
                .Select(p => new { p.Id, p.Name, p.Brand, Category = p.Category!.Name, VariantIds = p.Variants.Select(v => v.Id).ToList() })
                .ToListAsync();

            var sold = orders
                .Where(o => o.Status == OrderStatus.Completed)
                .SelectMany(o => o.Lines)
                .Where(l => l.ProductVariantId != null && OrderRules.IsItem(l))
                .GroupBy(l => l.ProductVariantId!.Value)
                .ToDictionary(g => g.Key, g => (Quantity: g.Sum(l => l.Quantity), Revenue: g.Sum(l => l.LineTotal)));

            // Every territory keeps its own copy of a product, so with several territories in view
            // the copies are counted together as one product.
            return products
                .GroupBy(p => (Name: TallyKey(p.Name), Brand: TallyKey(p.Brand), Category: TallyKey(p.Category)))
                .Select(g =>
                {
                    var tallies = g.SelectMany(p => p.VariantIds).Where(sold.ContainsKey).Select(id => sold[id]).ToList();
                    return new ProductTallyDto
                    {
                        Description = g.First().Name,
                        Brand = g.First().Brand,
                        Category = g.First().Category,
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
        /// A product name or brand reduced to what identifies it in a sales tally, so the same
        /// product in two territories' catalogs - or typed twice on custom lines - lands in one:
        /// trimmed, single-spaced and lower case. Looser than CatalogRules.NameKey, which matches
        /// catalog items up on import and copy and keeps inner spacing; a tally only groups
        /// numbers, so a near-duplicate merging is harmless there.
        /// </summary>
        /// <param name="text">Name or brand</param>
        /// <returns>The key to group on.</returns>
        private static string TallyKey(string? text) =>
            string.Join(' ', (text ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();

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
            var productLines = lines.Where(OrderRules.IsItem).ToList();

            int UnitsIn(StatColumn category) =>
                productLines.Where(l => l.Category == category).Sum(l => l.Quantity);

            int UnitsWithBrand(string brand) =>
                productLines
                    .Where(l => l.Category == StatColumn.Mattress
                                && l.Brand != null
                                && l.Brand.Contains(brand, StringComparison.OrdinalIgnoreCase))
                    .Sum(l => l.Quantity);

            var mattressCount = UnitsIn(StatColumn.Mattress);

            // A mattress sold on an adjustable-base variant counts in both columns, exactly as the
            // crew tallies it on the paper stat sheet.
            // Sets now carry their base as a separate Included row, which UnitsIn already counts.
            // Older orders taken before that row existed only have the flag on the mattress line,
            // so those are still counted from the flag.
            var setsWithBaseRow = lines
                .Where(l => l.LineType == OrderLineType.Included && l.ParentLineId != null)
                .Select(l => l.ParentLineId!.Value)
                .ToHashSet();

            var baseCount = UnitsIn(StatColumn.AdjustableBase)
                            + productLines.Where(l => l.IncludesAdjustableBase
                                                      && l.Category != StatColumn.AdjustableBase
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
                MattressProtectorCount = UnitsIn(StatColumn.MattressProtector),
                PillowCount = UnitsIn(StatColumn.Pillow),
                SheetCount = UnitsIn(StatColumn.Sheets),
                FrameCount = UnitsIn(StatColumn.Frame),
                BeanBagChairCount = UnitsIn(StatColumn.BeanBagChair),
                MiscCount = UnitsIn(StatColumn.Misc),
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
                DraftOrderCount = orders.Count(o => o.Status == OrderStatus.Draft && !OrderRules.IsBlankDraft(o)),
                AwaitingCheckoutCount = orders.Count(o => o.Status == OrderStatus.AwaitingCheckout),
                VoidedOrderCount = orders.Count(o => o.Status == OrderStatus.Voided),

                Sales = completed
                    .OrderBy(o => o.CompletedAt ?? o.UpdatedAt)
                    .Select(o => new SaleMomentDto { At = o.CompletedAt ?? o.UpdatedAt, Total = o.Total })
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
