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
    /// Orders, from the sales floor through the checkout table. A rep may hold several drafts at
    /// once; pressing Complete moves a draft into the checkout queue, where payment is taken and
    /// the receipt printed.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class OrderController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region POST Methods

        /// <summary>
        /// Opens a new draft order against an event and reserves the next order number.
        /// </summary>
        /// <param name="request">Event id, and optionally a draft label and rep name</param>
        /// <returns>The created order.</returns>
        [HttpPost("order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddOrder([FromBody] OrderDto request)
        {
            try
            {
                if (request.EventId == null)
                    return BadRequest(new { error = "Missing parameter." });

                var saleEvent = await DB.Events.FindAsync(request.EventId.Value);
                if (saleEvent == null)
                    return NotFound(new { error = "Event not found." });

                // New sales are only written against the active event, so nothing is taken under an
                // event that has finished or not been set up yet.
                if (!saleEvent.IsActive)
                    return BadRequest(new { error = "There is no active event. An administrator needs to activate one before new orders can be taken." });

                var order = new Order
                {
                    EventId = saleEvent.Id,
                    OrderNumber = saleEvent.NextOrderNumber,
                    Status = OrderStatus.Draft,
                    DraftLabel = request.DraftLabel,
                    SaleDate = request.SaleDate ?? saleEvent.EventDate,
                    Organization = request.Organization ?? saleEvent.Organization,
                    AdvertisingSource = request.AdvertisingSource,
                    ReferralName = request.ReferralName,
                    CfsRepName = request.CfsRepName ?? GetCurrentUserName(),
                    SalesTaxRate = request.SalesTaxRate ?? saleEvent.SalesTaxRate,
                    CcProcessingFeeRate = request.CcProcessingFeeRate ?? saleEvent.CcProcessingFeeRate,
                    DeliverySameAsBilling = true,
                    CreatedByUserId = GetCurrentUserId(),
                };

                saleEvent.NextOrderNumber += 1;

                DB.Orders.Add(order);
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while starting the order.", exception = e.Message });
            }
        }

        /// <summary>
        /// Adds a line to an order. When a catalog variant is supplied the brand, size,
        /// description and price are snapshotted from it. When a delivery option is supplied on a
        /// product line, the matching service line is created and linked to it in the same call.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <param name="request">Line fields</param>
        /// <returns>The recalculated order.</returns>
        [HttpPost("order/{id}/line")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddOrderLine(int id, [FromBody] OrderLineDto request)
        {
            try
            {
                var order = await LoadOrderAsync(id);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status is OrderStatus.Completed or OrderStatus.Voided)
                    return BadRequest(new { error = "This order is closed and can no longer be changed." });

                var lineType = Enum.TryParse<OrderLineType>(request.LineType, true, out var parsedType)
                    ? parsedType
                    : OrderLineType.Product;

                var nextSort = order.Lines.Count == 0 ? 1 : order.Lines.Max(l => l.SortOrder) + 1;
                var line = new OrderLine { OrderId = order.Id, LineType = lineType, SortOrder = nextSort };
                ProductVariant? soldVariant = null;
                var includedChoices = new Dictionary<int, List<LineChoice>>();

                if (request.ProductVariantId != null)
                {
                    var variant = await DB.ProductVariants
                        .Include(v => v.Product)
                        .ThenInclude(p => p!.Options)
                        .ThenInclude(o => o.Choices)
                        .Include(v => v.Components)
                        .ThenInclude(c => c.ComponentVariant)
                        .ThenInclude(cv => cv!.Product)
                        .ThenInclude(cp => cp!.Options)
                        .ThenInclude(o => o.Choices)
                        .AsSplitQuery()
                        .FirstOrDefaultAsync(v => v.Id == request.ProductVariantId.Value);

                    if (variant == null)
                        return NotFound(new { error = "Product not found." });

                    // A variant with no price is an "Inquire" card - the rep has to key a price in.
                    if (variant.Price == null && request.UnitPrice == null)
                        return BadRequest(new { error = "This size has no price on file. Enter a price to continue." });

                    // Selections such as Color: every required one needs a choice. Any price
                    // change for a choice is added to the size's price.
                    var (chosen, choiceProblem) = Choices.Resolve(variant.Product!, PickedChoices(request.Choices));
                    if (choiceProblem != null)
                        return BadRequest(new { error = choiceProblem });

                    // Each included item with selections needs its choices too.
                    foreach (var component in variant.Components.Where(c => c.ComponentVariant?.Product != null))
                    {
                        var picked = request.IncludedChoices?.FirstOrDefault(i => i.ComponentVariantId == component.ComponentVariantId)?.Choices;
                        var (included, includedProblem) = Choices.Resolve(component.ComponentVariant!.Product!, PickedChoices(picked));
                        if (includedProblem != null)
                            return BadRequest(new { error = includedProblem });
                        includedChoices[component.ComponentVariantId] = included;
                    }

                    line.ProductVariantId = variant.Id;
                    line.Category = variant.Product?.Category ?? ProductCategory.Misc;
                    line.Brand = request.Brand ?? variant.Product?.Brand;
                    line.Size = request.Size ?? variant.Size;
                    line.Description = request.Description ?? BuildDescription(variant);
                    line.UnitPrice = (request.UnitPrice ?? variant.Price ?? 0m) + chosen.Sum(c => c.PriceAdjustment ?? 0m);
                    line.ChoicesJson = Choices.ToJson(chosen);
                    line.StockKey = Choices.KeyFor(chosen, Choices.CountedOptions(variant.Product!));
                    line.IncludesAdjustableBase = variant.Components.Any(c =>
                        c.ComponentVariant?.Product?.Category == ProductCategory.AdjustableBase);

                    // The catalog sale is taken when the item goes on the order and stays with it.
                    // A size with no catalog price is sold at the price the rep keys in, so no sale.
                    if (variant.Price != null)
                        (line.SaleDiscountPercent, line.SaleDiscountAmount) = Choices.SaleFor(variant);

                    soldVariant = variant;
                }
                else if (lineType == OrderLineType.Delivery && request.DeliveryOptionId != null)
                {
                    var option = await DB.DeliveryOptions.FindAsync(request.DeliveryOptionId.Value);
                    if (option == null)
                        return NotFound(new { error = "Delivery option not found." });

                    // Priced as the item it ships offers it: that product's own price and sale for
                    // the option when it has them, otherwise the option's.
                    var parentVariantId = order.Lines.FirstOrDefault(l => l.Id == request.ParentLineId)?.ProductVariantId;
                    var forProduct = parentVariantId == null ? null : await ProductDeliveryAsync(option.Id, parentVariantId.Value);

                    line.DeliveryOptionId = option.Id;
                    line.Category = ProductCategory.Misc;
                    line.Description = request.Description ?? option.Name;
                    line.UnitPrice = request.UnitPrice ?? forProduct?.PriceOverride ?? option.Price;
                    if (request.UnitPrice == null)
                        (line.SaleDiscountPercent, line.SaleDiscountAmount) = Choices.DeliverySaleFor(option, forProduct);
                    line.IsTaxable = request.IsTaxable ?? option.IsTaxable;
                    line.TakeWith = option.IsTakeWith;
                    line.ShowOnSalesSheet = option.ShowOnSalesSheet;
                    line.ParentLineId = request.ParentLineId;

                    var parentLine = order.Lines.FirstOrDefault(l => l.Id == request.ParentLineId);
                    if (parentLine != null && option.IsTakeWith)
                        parentLine.TakeWith = true;
                }
                else if (lineType == OrderLineType.Upcharge)
                {
                    // An upcharge hangs off an item the customer is buying, never off a shipping
                    // row, an included item or another upcharge.
                    var parentLine = order.Lines.FirstOrDefault(l => l.Id == request.ParentLineId);
                    if (parentLine == null || parentLine.LineType is not (OrderLineType.Product or OrderLineType.Custom))
                        return BadRequest(new { error = "Pick the item the upcharge is for." });

                    if (string.IsNullOrWhiteSpace(request.Description))
                        return BadRequest(new { error = "Enter the reason for the upcharge." });

                    if (request.Description.Trim().Length > 300)
                        return BadRequest(new { error = "The reason can be at most 300 characters." });

                    if (request.UnitPrice is not > 0)
                        return BadRequest(new { error = "Enter the upcharge amount." });

                    line.Category = ProductCategory.Misc;
                    line.Description = request.Description.Trim();
                    line.UnitPrice = request.UnitPrice.Value;
                    line.ParentLineId = parentLine.Id;
                }
                else
                {
                    if (string.IsNullOrWhiteSpace(request.Description))
                        return BadRequest(new { error = "Missing parameter." });

                    if (request.Description.Length > 300)
                        return BadRequest(new { error = "Invalid parameter." });

                    line.LineType = OrderLineType.Custom;
                    line.Category = Enum.TryParse<ProductCategory>(request.Category, true, out var category)
                        ? category
                        : ProductCategory.Misc;
                    line.Brand = request.Brand;
                    line.Size = request.Size;
                    line.Description = request.Description;
                    line.UnitPrice = request.UnitPrice ?? 0m;
                }

                line.Quantity = request.Quantity ?? 1;
                line.DiscountPercent = request.DiscountPercent;
                line.DiscountAmount = request.DiscountAmount;

                if (request.TakeWith != null)
                    line.TakeWith = request.TakeWith.Value;

                if (request.IsTaxable != null)
                    line.IsTaxable = request.IsTaxable.Value;

                if (request.Notes is { Length: > 500 })
                    return BadRequest(new { error = "An item note can be at most 500 characters." });

                line.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

                if (line.Quantity < 1)
                    return BadRequest(new { error = "The quantity must be at least 1." });

                if (line.UnitPrice < 0)
                    return BadRequest(new { error = "The unit price cannot be negative." });

                if (line.DiscountPercent is < 0 or > 100)
                    return BadRequest(new { error = "The discount must be between 0 and 100 percent." });

                if (line.DiscountAmount is < 0)
                    return BadRequest(new { error = "A discount can't be negative." });

                // One discount style per line: a percent wins over an amount.
                if (line.DiscountPercent is > 0)
                    line.DiscountAmount = null;
                else
                    line.DiscountPercent = null;

                if (line.LineType == OrderLineType.Upcharge)
                    KeepUpchargePlain(line);

                // A tracked item can only be a Take With while the cart has enough of it on hand;
                // otherwise it has to ship. The shipping choice that rides along with a product
                // line and the items inside a bundle count too, so check before anything is saved.
                if (line.LineType == OrderLineType.Product && request.DeliveryOptionId != null
                    && await DB.DeliveryOptions.AnyAsync(d => d.Id == request.DeliveryOptionId && d.IsTakeWith))
                    line.TakeWith = true;

                var bundleDemand = line.TakeWith && soldVariant != null
                    ? soldVariant.Components.Select(c => new KeyValuePair<(int, string), int>(
                        (c.ComponentVariantId, IncludedStockKey(c, includedChoices)), line.Quantity * Math.Max(1, c.Quantity)))
                    : Enumerable.Empty<KeyValuePair<(int, string), int>>();

                InventoryRules.SyncIncludedTakeWith(order);
                var stockError = await InventoryRules.CheckStockAsync(DB, order.Lines.Append(line), bundleDemand);
                if (stockError != null)
                    return BadRequest(new { error = stockError });

                order.Lines.Add(line);
                await DB.SaveChangesAsync();

                // A bundle - such as a mattress sold as a set with an adjustable base - gets each
                // included item on its own row underneath, so the sheet shows exactly what is being
                // delivered. Anything sold on its own has no components and adds nothing here.
                if (line.LineType == OrderLineType.Product && soldVariant is { Components.Count: > 0 })
                    AddBundleComponentLines(order, line, soldVariant, includedChoices);

                // A product line may carry its delivery choice with it, so the floor can add both
                // in one tap without a second round trip.
                if (line.LineType == OrderLineType.Product && request.DeliveryOptionId != null)
                {
                    var added = await AddLinkedDeliveryLineAsync(order, line, request.DeliveryOptionId.Value);
                    if (!added)
                        return NotFound(new { error = "Delivery option not found." });
                }

                InventoryRules.SyncIncludedTakeWith(order);
                LineOrder.Normalize(order);
                OrderCalculator.RecalculateOrder(order);
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while adding the line.", exception = e.Message });
            }
        }

        /// <summary>
        /// Adds a payment row to an order.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <param name="request">Payment fields</param>
        /// <returns>The recalculated order.</returns>
        [HttpPost("order/{id}/payment")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddOrderPayment(int id, [FromBody] OrderPaymentDto request)
        {
            try
            {
                var order = await LoadOrderAsync(id);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status == OrderStatus.Voided)
                    return BadRequest(new { error = "This order has been voided." });

                if (request.Amount == null || string.IsNullOrWhiteSpace(request.Method))
                    return BadRequest(new { error = "Missing parameter." });

                if (!Enum.TryParse<PaymentMethod>(request.Method, true, out var method))
                    return BadRequest(new { error = "Invalid parameter." });

                if (request.Amount.Value <= 0)
                    return BadRequest(new { error = "The payment amount must be greater than zero." });

                var reference = Clean(request.Reference);
                var financeType = method == PaymentMethod.Financing ? Clean(request.FinanceType) : null;
                if (reference?.Length > 100 || financeType?.Length > 100)
                    return BadRequest(new { error = "The financing number and type can be at most 100 characters." });

                if (financeType != null)
                {
                    var typeProblem = await FinanceTypeProblemAsync(financeType);
                    if (typeProblem != null)
                        return BadRequest(new { error = typeProblem });
                    financeType = await CanonicalFinanceTypeAsync(financeType);
                }

                order.Payments.Add(new OrderPayment
                {
                    OrderId = order.Id,
                    Method = method,
                    Amount = request.Amount.Value,
                    CheckNumber = request.CheckNumber,
                    Reference = reference,
                    FinanceType = financeType,
                });

                OrderCalculator.RecalculateOrder(order);
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while adding the payment.", exception = e.Message });
            }
        }

        /// <summary>
        /// Hands a draft to the checkout table. This is the button the floor rep presses when the
        /// customer walks over to pay.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The submitted order.</returns>
        [HttpPost("order/{id}/submit")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SubmitOrder(int id)
        {
            try
            {
                var order = await LoadOrderAsync(id);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status != OrderStatus.Draft)
                    return BadRequest(new { error = "Only a draft can be sent to checkout." });

                if (order.Lines.Count == 0)
                    return BadRequest(new { error = "Add at least one item before sending to checkout." });

                if (string.IsNullOrWhiteSpace(order.BillingName))
                    return BadRequest(new { error = "Enter the customer name before sending to checkout." });

                OrderCalculator.RecalculateOrder(order);
                order.Status = OrderStatus.AwaitingCheckout;
                order.SubmittedAt = DateTime.UtcNow;
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while sending the order to checkout.", exception = e.Message });
            }
        }

        /// <summary>
        /// Closes an order at the checkout table. A balance may remain, which is how layaway and
        /// financing sales are recorded.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The completed order.</returns>
        [HttpPost("order/{id}/complete")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> CompleteOrder(int id)
        {
            try
            {
                var order = await LoadOrderAsync(id);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status == OrderStatus.Voided)
                    return BadRequest(new { error = "This order has been voided." });

                if (order.Status == OrderStatus.Completed)
                    return BadRequest(new { error = "This order is already complete." });

                if (order.Lines.Count == 0)
                    return BadRequest(new { error = "An order needs at least one item before it can be completed." });

                if (order.Payments.Count == 0)
                    return BadRequest(new { error = "Record at least one payment before completing the order." });

                if (!IsAcknowledged(order))
                    return BadRequest(new { error = "The customer needs to confirm their details, initial each acknowledgement and sign before the order can be completed." });

                // Another sale may have taken the last one since this order was written up.
                InventoryRules.SyncIncludedTakeWith(order);
                var stockError = await InventoryRules.CheckStockAsync(DB, order.Lines);
                if (stockError != null)
                    return BadRequest(new { error = stockError });

                OrderCalculator.RecalculateOrder(order);
                order.Status = OrderStatus.Completed;
                order.CompletedAt = DateTime.UtcNow;
                // Keep the wording the customer just initialled with the sale.
                order.TermsJson = SettingsStore.Store((await SettingsStore.LoadAsync(DB)).Terms);
                order.CompletedByUserId = GetCurrentUserId();
                order.ReceivedBy ??= GetCurrentUserName();
                order.ReceivedDate ??= DateTime.UtcNow;
                order.UpdatedAt = DateTime.UtcNow;
                await InventoryRules.DeductForSaleAsync(DB, order, GetCurrentUserId(), GetCurrentUserName());
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while completing the order.", exception = e.Message });
            }
        }

        /// <summary>
        /// Sends an order back to the checkout table or the sales floor. Checkout uses this when it
        /// spots something wrong; an administrator can also use it on a completed sale, which takes
        /// it out of the day's totals until it is completed again. Payments already recorded stay
        /// on the order.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <param name="to">"floor" (the default) or "checkout"</param>
        /// <returns>The reopened order.</returns>
        [HttpPost("order/{id}/reopen")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ReopenOrder(int id, [FromQuery] string? to = null)
        {
            try
            {
                var order = await LoadOrderAsync(id);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status == OrderStatus.Voided)
                    return BadRequest(new { error = "This order has been voided." });

                var target = string.IsNullOrWhiteSpace(to) || to.Equals("floor", StringComparison.OrdinalIgnoreCase)
                    ? OrderStatus.Draft
                    : to.Equals("checkout", StringComparison.OrdinalIgnoreCase)
                        ? OrderStatus.AwaitingCheckout
                        : (OrderStatus?)null;

                if (target == null)
                    return BadRequest(new { error = "Invalid parameter." });

                if (order.Status == OrderStatus.Completed && !IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may reopen a completed sale." });

                if (order.Status == target)
                    return BadRequest(new { error = target == OrderStatus.Draft
                        ? "This order is already on the sales floor."
                        : "This order is already at checkout." });

                // Anything the sale took home goes back on the shelf until it is completed again.
                if (order.Status == OrderStatus.Completed)
                    await InventoryRules.RestoreForOrderAsync(DB, order, GetCurrentUserId(), GetCurrentUserName(), "reopened");

                order.Status = target.Value;
                order.SubmittedAt = target == OrderStatus.AwaitingCheckout
                    ? DateTime.UtcNow
                    : null;
                order.CompletedAt = null;
                order.CompletedByUserId = null;
                // Completing it again keeps the wording in force then.
                order.TermsJson = null;
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while reopening the order.", exception = e.Message });
            }
        }

        /// <summary>
        /// Voids an order. The row is kept for the audit trail but drops out of every total.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The voided order.</returns>
        [HttpPost("order/{id}/void")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> VoidOrder(int id)
        {
            try
            {
                var order = await LoadOrderAsync(id);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status == OrderStatus.Completed)
                    await InventoryRules.RestoreForOrderAsync(DB, order, GetCurrentUserId(), GetCurrentUserName(), "voided");

                order.Status = OrderStatus.Voided;
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while voiding the order.", exception = e.Message });
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists orders for an event, optionally filtered by status.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <param name="status">Optional status name</param>
        /// <returns>Order summaries, most recently touched first.</returns>
        [HttpGet("orders/event/{eventId}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetOrdersForEvent(int eventId, [FromQuery] string? status = null)
        {
            try
            {
                var query = DB.Orders.Where(o => o.EventId == eventId);

                if (!string.IsNullOrWhiteSpace(status))
                {
                    if (!Enum.TryParse<OrderStatus>(status, true, out var parsed))
                        return BadRequest(new { error = "Invalid parameter." });

                    query = query.Where(o => o.Status == parsed);
                }

                var orders = await query
                    .Include(o => o.Lines)
                    .Include(o => o.Event)
                    .AsNoTracking()
                    .OrderByDescending(o => o.UpdatedAt)
                    .ToListAsync();

                return Ok(orders.Select(ToSummaryDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting orders.", exception = e.Message });
            }
        }

        /// <summary>
        /// Lists the drafts the signed-in rep currently has open, so they can juggle several
        /// customers at once.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <param name="all">Pass true to see every rep's drafts rather than just your own</param>
        /// <returns>Draft order summaries, oldest first.</returns>
        [HttpGet("orders/drafts/event/{eventId}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetDrafts(int eventId, [FromQuery] bool all = false)
        {
            try
            {
                var userId = GetCurrentUserId();

                var query = DB.Orders
                    .Where(o => o.EventId == eventId && o.Status == OrderStatus.Draft);

                if (!all && userId != null)
                    query = query.Where(o => o.CreatedByUserId == userId.Value);

                var orders = await query
                    .Include(o => o.Lines)
                    .Include(o => o.Event)
                    .AsNoTracking()
                    .OrderBy(o => o.CreatedAt)
                    .ToListAsync();

                return Ok(orders.Select(ToSummaryDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting drafts.", exception = e.Message });
            }
        }

        /// <summary>
        /// The checkout queue: orders the floor has handed over, oldest first so the customer who
        /// walked over first is served first.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <returns>Order summaries awaiting checkout.</returns>
        [HttpGet("orders/checkout/event/{eventId}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetCheckoutQueue(int eventId)
        {
            try
            {
                var orders = await DB.Orders
                    .Where(o => o.EventId == eventId && o.Status == OrderStatus.AwaitingCheckout)
                    .Include(o => o.Lines)
                    .Include(o => o.Event)
                    .AsNoTracking()
                    .OrderBy(o => o.SubmittedAt)
                    .ToListAsync();

                return Ok(orders.Select(ToSummaryDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the checkout queue.", exception = e.Message });
            }
        }

        /// <summary>
        /// Every order across every event, newest first. Admin only - this is how a manager looks
        /// back at a fundraiser that finished weeks ago.
        /// </summary>
        /// <param name="status">Optional status name</param>
        /// <param name="search">Optional match on customer name, rep name, order number, phone or email</param>
        /// <param name="take">Maximum rows to return, capped at 500</param>
        /// <returns>Order summaries, most recently touched first.</returns>
        [HttpGet("orders")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetAllOrders(
            [FromQuery] string? status = null,
            [FromQuery] string? search = null,
            [FromQuery] int take = 200)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may browse every event." });

                var query = DB.Orders.AsQueryable();

                if (!string.IsNullOrWhiteSpace(status))
                {
                    if (!Enum.TryParse<OrderStatus>(status, true, out var parsed))
                        return BadRequest(new { error = "Invalid parameter." });

                    query = query.Where(o => o.Status == parsed);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    // Lower-cased on both sides so the search ignores case on any database.
                    var term = search.Trim().ToLower();

                    // A phone number matches on its digits alone, however it was typed or stored:
                    // "724 555 0100", "5550100" and "(724) 555-0100" all find the same order.
                    var digits = new string(term.Where(char.IsDigit).ToArray());
                    var byPhone = digits.Length >= 4;

                    query = query.Where(o =>
                        (o.BillingName != null && o.BillingName.ToLower().Contains(term))
                        || (o.CfsRepName != null && o.CfsRepName.ToLower().Contains(term))
                        || (o.BillingEmail != null && o.BillingEmail.ToLower().Contains(term))
                        || o.OrderNumber.ToString().Contains(term)
                        || (byPhone && o.BillingCell != null
                            && o.BillingCell.Replace("(", "").Replace(")", "").Replace("-", "").Replace(" ", "").Replace(".", "").Contains(digits))
                        || (byPhone && o.BillingAlt != null
                            && o.BillingAlt.Replace("(", "").Replace(")", "").Replace("-", "").Replace(" ", "").Replace(".", "").Contains(digits)));
                }

                var orders = await query
                    .Include(o => o.Lines)
                    .Include(o => o.Event)
                    .AsNoTracking()
                    .OrderByDescending(o => o.SaleDate)
                    .ThenByDescending(o => o.OrderNumber)
                    .Take(Math.Clamp(take, 1, 500))
                    .ToListAsync();

                return Ok(orders.Select(ToSummaryDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting orders.", exception = e.Message });
            }
        }

        /// <summary>
        /// Full orders for an event, ready to print as a stack of sales sheets or export. Admin only.
        /// Defaults to completed sales, which is what goes in the event's paperwork.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <param name="status">Status to include; defaults to Completed</param>
        /// <returns>Full orders in order-number order.</returns>
        [HttpGet("orders/event/{eventId}/sheets")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetSalesSheetsForEvent(int eventId, [FromQuery] string? status = null)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may export an event's sales sheets." });

                if (!await DB.Events.AnyAsync(e => e.Id == eventId))
                    return NotFound(new { error = "Event not found." });

                var wanted = OrderStatus.Completed;
                if (!string.IsNullOrWhiteSpace(status) && !Enum.TryParse(status, true, out wanted))
                    return BadRequest(new { error = "Invalid parameter." });

                var orders = await DB.Orders
                    .Where(o => o.EventId == eventId && o.Status == wanted)
                    .Include(o => o.Lines)
                    .Include(o => o.Payments)
                    .Include(o => o.Event)
                    .Include(o => o.CreatedByUser)
                    .Include(o => o.CompletedByUser)
                    .AsNoTracking()
                    .OrderBy(o => o.OrderNumber)
                    .ToListAsync();

                return Ok(orders.Select(ToDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the sales sheets.", exception = e.Message });
            }
        }

        /// <summary>
        /// Gets a full order, including every line and payment, for editing and for the receipt.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The order.</returns>
        [HttpGet("order/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetOrder(int id)
        {
            try
            {
                var dto = await LoadDtoAsync(id);
                if (dto == null)
                    return NotFound(new { error = "Order not found." });

                return Ok(dto);
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the order.", exception = e.Message });
            }
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Puts an order's items in a new order. Each item's own rows - included items, upcharges,
        /// shipping - move with it and stay in that order underneath.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <param name="itemIds">Every item line's id, in the order the sales sheet should list them</param>
        /// <returns>The order with its lines in the new order.</returns>
        [HttpPut("order/{id}/lines/order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ReorderOrderLines(int id, [FromBody] List<int> itemIds)
        {
            try
            {
                var order = await LoadOrderAsync(id);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status is OrderStatus.Completed or OrderStatus.Voided)
                    return BadRequest(new { error = "This order is closed and can no longer be changed." });

                var items = LineOrder.Items(order);
                if (itemIds.Count != items.Count || itemIds.Distinct().Count() != itemIds.Count
                    || items.Any(l => !itemIds.Contains(l.Id)))
                    return BadRequest(new { error = "The order has changed. Refresh and try again." });

                LineOrder.Normalize(order, itemIds);
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while reordering the items.", exception = e.Message });
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Updates the header, customer, delivery, comments and acknowledgement fields of an order.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The recalculated order.</returns>
        [HttpPatch("order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateOrder([FromBody] OrderDto request)
        {
            try
            {
                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var order = await LoadOrderAsync(request.Id.Value);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status == OrderStatus.Voided)
                    return BadRequest(new { error = "This order has been voided." });

                if (request.SalesTaxRate is < 0 or > 1)
                    return BadRequest(new { error = "The sales tax rate must be between 0 and 1." });

                if (request.CcProcessingFeeRate is < 0 or > 1)
                    return BadRequest(new { error = "The card processing fee rate must be between 0 and 1." });

                var detailsBefore = CustomerDetails(order);

                ApplyHeader(order, request);
                ApplyBilling(order, request);
                ApplyDelivery(order, request);
                ApplyAcknowledgements(order, request);

                // The customer initialled the details they were shown; if those details change,
                // they have to look again before the sale can be completed.
                if (request.CustomerInfoInitials == null && CustomerDetails(order) != detailsBefore)
                    order.CustomerInfoInitials = null;

                if (request.Comments != null)
                    order.Comments = string.IsNullOrWhiteSpace(request.Comments) ? null : request.Comments;

                if (request.SalesTaxRate != null)
                    order.SalesTaxRate = request.SalesTaxRate.Value;

                if (request.CcProcessingFeeRate != null)
                    order.CcProcessingFeeRate = request.CcProcessingFeeRate.Value;

                if (request.ApplyCcProcessingFee != null)
                    order.ApplyCcProcessingFee = request.ApplyCcProcessingFee.Value;

                // Waiving the card fee is a checkout decision, and changes the total of a sale
                // that is still open only.
                if (request.WaiveCcProcessingFee != null && request.WaiveCcProcessingFee.Value != order.WaiveCcProcessingFee)
                {
                    if (order.Status == OrderStatus.Completed)
                        return BadRequest(new { error = "This sale is complete, so its card fee can no longer be changed." });
                    if (!IsInRole(UserRole.Checkout) && !IsInRole(UserRole.SalesCheckout) && !IsInRole(UserRole.Admin))
                        return StatusCode(403, new { error = "Only the checkout table can waive the card fee." });

                    order.WaiveCcProcessingFee = request.WaiveCcProcessingFee.Value;
                }

                OrderCalculator.RecalculateOrder(order);
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating the order.", exception = e.Message });
            }
        }

        /// <summary>
        /// Updates one line of an order.
        /// </summary>
        /// <param name="request">Fields to change, including the line id</param>
        /// <returns>The recalculated order.</returns>
        [HttpPatch("line")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateOrderLine([FromBody] OrderLineDto request)
        {
            try
            {
                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var existing = await DB.OrderLines.FindAsync(request.Id.Value);
                if (existing == null)
                    return NotFound(new { error = "Line not found." });

                var order = await LoadOrderAsync(existing.OrderId);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status is OrderStatus.Completed or OrderStatus.Voided)
                    return BadRequest(new { error = "This order is closed and can no longer be changed." });

                var line = order.Lines.First(l => l.Id == request.Id.Value);

                if (line.LineType == OrderLineType.Included)
                    return BadRequest(new { error = "This item comes with a bundle. Edit or remove the bundle line instead." });

                if (request.Description != null)
                {
                    if (string.IsNullOrWhiteSpace(request.Description) || request.Description.Length > 300)
                        return BadRequest(new { error = "Invalid parameter." });

                    line.Description = request.Description;
                }

                if (request.Quantity is < 1)
                    return BadRequest(new { error = "The quantity must be at least 1." });

                if (request.UnitPrice is < 0)
                    return BadRequest(new { error = "The unit price cannot be negative." });

                if (request.DiscountPercent is < 0 or > 100)
                    return BadRequest(new { error = "The discount must be between 0 and 100 percent." });

                if (request.DiscountAmount is < 0)
                    return BadRequest(new { error = "A discount can't be negative." });

                if (request.Brand != null)
                    line.Brand = request.Brand;

                if (request.Size != null)
                    line.Size = request.Size;

                if (request.Quantity != null)
                {
                    var previous = Math.Max(1, line.Quantity);
                    line.Quantity = request.Quantity.Value;

                    // Included items scale with the number of bundles sold: two pillows per set
                    // stays two pillows per set.
                    foreach (var included in order.Lines.Where(l => l.ParentLineId == line.Id
                                                                    && l.LineType == OrderLineType.Included))
                    {
                        var perBundle = Math.Max(1, included.Quantity / previous);
                        included.Quantity = perBundle * line.Quantity;
                    }
                }

                if (request.TakeWith != null)
                    line.TakeWith = request.TakeWith.Value;

                if (request.UnitPrice != null)
                    line.UnitPrice = request.UnitPrice.Value;

                // Sending one discount style clears the other, so the two can never both apply.
                if (request.DiscountPercent != null)
                {
                    line.DiscountPercent = request.DiscountPercent.Value == 0 ? null : request.DiscountPercent;
                    line.DiscountAmount = null;
                }
                else if (request.DiscountAmount != null)
                {
                    line.DiscountAmount = request.DiscountAmount.Value == 0 ? null : request.DiscountAmount;
                    line.DiscountPercent = null;
                }

                if (request.IsTaxable != null)
                    line.IsTaxable = request.IsTaxable.Value;

                if (request.Notes != null)
                {
                    if (request.Notes.Length > 500)
                        return BadRequest(new { error = "An item note can be at most 500 characters." });

                    line.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
                }

                if (request.SortOrder != null)
                    line.SortOrder = request.SortOrder.Value;

                if (request.Category != null && Enum.TryParse<ProductCategory>(request.Category, true, out var category))
                    line.Category = category;

                if (line.LineType == OrderLineType.Upcharge)
                {
                    if (line.UnitPrice <= 0)
                        return BadRequest(new { error = "Enter the upcharge amount." });

                    line.Description = line.Description.Trim();
                    KeepUpchargePlain(line);
                }

                InventoryRules.SyncIncludedTakeWith(order);
                var stockError = await InventoryRules.CheckStockAsync(DB, order.Lines);
                if (stockError != null)
                    return BadRequest(new { error = stockError });

                OrderCalculator.RecalculateOrder(order);
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating the line.", exception = e.Message });
            }
        }

        /// <summary>
        /// Updates one payment row of an order.
        /// </summary>
        /// <param name="request">Fields to change, including the payment id</param>
        /// <returns>The recalculated order.</returns>
        [HttpPatch("payment")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateOrderPayment([FromBody] OrderPaymentDto request)
        {
            try
            {
                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var existing = await DB.OrderPayments.FindAsync(request.Id.Value);
                if (existing == null)
                    return NotFound(new { error = "Payment not found." });

                var order = await LoadOrderAsync(existing.OrderId);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status == OrderStatus.Voided)
                    return BadRequest(new { error = "This order has been voided." });

                if (request.Amount is <= 0)
                    return BadRequest(new { error = "The payment amount must be greater than zero." });

                var payment = order.Payments.First(p => p.Id == request.Id.Value);

                if (request.Method != null)
                {
                    if (!Enum.TryParse<PaymentMethod>(request.Method, true, out var method))
                        return BadRequest(new { error = "Invalid parameter." });

                    payment.Method = method;
                }

                if (request.Amount != null)
                    payment.Amount = request.Amount.Value;

                if (request.CheckNumber != null)
                    payment.CheckNumber = string.IsNullOrWhiteSpace(request.CheckNumber) ? null : request.CheckNumber;

                if (request.Reference?.Trim().Length > 100 || request.FinanceType?.Trim().Length > 100)
                    return BadRequest(new { error = "The financing number and type can be at most 100 characters." });

                if (request.Reference != null)
                    payment.Reference = Clean(request.Reference);

                if (request.FinanceType != null)
                {
                    var financeType = Clean(request.FinanceType);
                    if (financeType != null)
                    {
                        var typeProblem = await FinanceTypeProblemAsync(financeType);
                        if (typeProblem != null)
                            return BadRequest(new { error = typeProblem });
                        financeType = await CanonicalFinanceTypeAsync(financeType);
                    }
                    payment.FinanceType = financeType;
                }

                // Only a financing payment carries a financing type.
                if (payment.Method != PaymentMethod.Financing)
                    payment.FinanceType = null;

                OrderCalculator.RecalculateOrder(order);
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating the payment.", exception = e.Message });
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Deletes a draft order outright. Submitted and completed orders must be voided instead -
        /// unless a system admin passes permanent=true, which deletes an order in any state.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <param name="permanent">True to delete an order that is not a draft (system admin only)</param>
        /// <returns>200 when the order was removed.</returns>
        [HttpDelete("order/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteOrder(int id, [FromQuery] bool permanent = false)
        {
            try
            {
                if (permanent && !IsSystemAdmin())
                    return StatusCode(403, new { error = "Only a system admin can delete an order permanently." });

                var order = await DB.Orders.FindAsync(id);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (permanent)
                {
                    await using var transaction = await DB.Database.BeginTransactionAsync();
                    await PermanentDelete.OrdersAsync(DB, [id]);
                    await transaction.CommitAsync();
                    return Ok();
                }

                if (order.Status != OrderStatus.Draft)
                    return BadRequest(new { error = "Only a draft can be deleted. Void the order instead." });

                DB.Orders.Remove(order);
                await DB.SaveChangesAsync();

                return Ok();
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while deleting the order.", exception = e.Message });
            }
        }

        /// <summary>
        /// Removes a line, along with any delivery line attached to it.
        /// </summary>
        /// <param name="id">Line id</param>
        /// <returns>The recalculated order.</returns>
        [HttpDelete("line/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteOrderLine(int id)
        {
            try
            {
                var existing = await DB.OrderLines.FindAsync(id);
                if (existing == null)
                    return NotFound(new { error = "Line not found." });

                var order = await LoadOrderAsync(existing.OrderId);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status is OrderStatus.Completed or OrderStatus.Voided)
                    return BadRequest(new { error = "This order is closed and can no longer be changed." });

                var target = order.Lines.First(l => l.Id == id);
                if (target.LineType == OrderLineType.Included)
                    return BadRequest(new { error = "This item comes with a bundle. Remove the bundle line instead." });

                var doomed = order.Lines.Where(l => l.Id == id || l.ParentLineId == id).ToList();
                foreach (var line in doomed)
                {
                    order.Lines.Remove(line);
                    DB.OrderLines.Remove(line);
                }

                // Removing the last Take With row from an item clears its Take With box.
                if (target.LineType == OrderLineType.Delivery && target.TakeWith && target.ParentLineId != null)
                {
                    var parent = order.Lines.FirstOrDefault(l => l.Id == target.ParentLineId);
                    if (parent != null && !order.Lines.Any(l => l.ParentLineId == parent.Id
                                                                && l.LineType == OrderLineType.Delivery
                                                                && l.TakeWith))
                        parent.TakeWith = false;
                }

                InventoryRules.SyncIncludedTakeWith(order);
                LineOrder.Normalize(order);
                OrderCalculator.RecalculateOrder(order);
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while deleting the line.", exception = e.Message });
            }
        }

        /// <summary>
        /// Removes a payment row.
        /// </summary>
        /// <param name="id">Payment id</param>
        /// <returns>The recalculated order.</returns>
        [HttpDelete("payment/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteOrderPayment(int id)
        {
            try
            {
                var existing = await DB.OrderPayments.FindAsync(id);
                if (existing == null)
                    return NotFound(new { error = "Payment not found." });

                var order = await LoadOrderAsync(existing.OrderId);
                if (order == null)
                    return NotFound(new { error = "Order not found." });

                if (order.Status == OrderStatus.Voided)
                    return BadRequest(new { error = "This order has been voided." });

                var payment = order.Payments.First(p => p.Id == id);
                order.Payments.Remove(payment);
                DB.OrderPayments.Remove(payment);

                OrderCalculator.RecalculateOrder(order);
                order.UpdatedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(order.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while deleting the payment.", exception = e.Message });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// An upcharge is only a reason and an amount per item: it carries no discount, note or
        /// Take With of its own. Its quantity and tax follow its item when the order is totalled.
        /// </summary>
        /// <param name="line">The upcharge line</param>
        private static void KeepUpchargePlain(OrderLine line)
        {
            line.DiscountPercent = null;
            line.DiscountAmount = null;
            line.SaleDiscountPercent = null;
            line.SaleDiscountAmount = null;
            line.TakeWith = false;
            line.Notes = null;
            line.Category = ProductCategory.Misc;
        }

        /// <summary>
        /// Loads an order with its lines and payments tracked, ready to recalculate and save.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The order, or null when not found.</returns>
        private async Task<Order?> LoadOrderAsync(int id)
        {
            return await DB.Orders
                .Include(o => o.Lines)
                .Include(o => o.Payments)
                .FirstOrDefaultAsync(o => o.Id == id);
        }

        /// <summary>
        /// Creates the shipping row that belongs to a product line and links the two. Every method
        /// gets a row, including no-charge ones such as Drop Ship, because the sheet has to say how
        /// each item is leaving the building. Take With also ticks the box on the product row.
        /// </summary>
        /// <param name="order">Owning order</param>
        /// <param name="parent">The product line the shipping row belongs to</param>
        /// <param name="deliveryOptionId">Chosen delivery option</param>
        /// <returns>False when the delivery option does not exist.</returns>
        private async Task<bool> AddLinkedDeliveryLineAsync(Order order, OrderLine parent, int deliveryOptionId)
        {
            var option = await DB.DeliveryOptions.FindAsync(deliveryOptionId);
            if (option == null)
                return false;

            var productDelivery = parent.ProductVariantId == null
                ? null
                : await ProductDeliveryAsync(option.Id, parent.ProductVariantId.Value);

            var price = productDelivery?.PriceOverride ?? option.Price;
            var (salePercent, saleAmount) = Choices.DeliverySaleFor(option, productDelivery);

            parent.DeliveryOptionId = option.Id;

            if (option.IsTakeWith)
                parent.TakeWith = true;

            order.Lines.Add(new OrderLine
            {
                OrderId = order.Id,
                LineType = OrderLineType.Delivery,
                Category = ProductCategory.Misc,
                DeliveryOptionId = option.Id,
                ParentLineId = parent.Id,
                Description = option.Name,
                Quantity = 1,
                UnitPrice = price < 0 ? 0 : price,
                // The sale in force is copied onto the row, so ending it never changes this order.
                SaleDiscountPercent = salePercent,
                SaleDiscountAmount = saleAmount,
                IsTaxable = option.IsTaxable,
                TakeWith = option.IsTakeWith,
                ShowOnSalesSheet = option.ShowOnSalesSheet,
                SortOrder = parent.SortOrder + 2,
            });

            return true;
        }

        /// <summary>
        /// A product's own settings for a delivery option - its price and sale for it - found from
        /// one of its sizes, or null when it doesn't list the option.
        /// </summary>
        /// <param name="deliveryOptionId">The delivery option</param>
        /// <param name="variantId">A size of the product</param>
        /// <returns>The product's entry for the option, or null.</returns>
        private Task<ProductDeliveryOption?> ProductDeliveryAsync(int deliveryOptionId, int variantId) =>
            DB.ProductDeliveryOptions
                .FirstOrDefaultAsync(p => p.DeliveryOptionId == deliveryOptionId
                                          && p.ProductId == DB.ProductVariants
                                              .Where(v => v.Id == variantId)
                                              .Select(v => v.ProductId)
                                              .FirstOrDefault());

        /// <summary>
        /// Adds a no-charge Included row for every item in a bundle, directly under the bundle
        /// line and ahead of its shipping row. Each row snapshots the component's brand, size,
        /// name and category, so it prints correctly and counts in its own stat sheet column.
        /// </summary>
        /// <param name="order">Owning order</param>
        /// <param name="parent">The bundle line</param>
        /// <param name="variant">The bundle variant, with components and their products loaded</param>
        /// <param name="choices">Each included size's selections, by component variant id</param>
        private static void AddBundleComponentLines(Order order, OrderLine parent, ProductVariant variant,
            Dictionary<int, List<LineChoice>> choices)
        {
            foreach (var component in variant.Components.Where(c => c.ComponentVariant?.Product != null))
            {
                var item = component.ComponentVariant!;
                var product = item.Product!;
                var chosen = choices.GetValueOrDefault(item.Id) ?? [];

                order.Lines.Add(new OrderLine
                {
                    OrderId = order.Id,
                    LineType = OrderLineType.Included,
                    Category = product.Category,
                    ProductVariantId = item.Id,
                    ParentLineId = parent.Id,
                    Brand = product.Brand,
                    Size = item.Size,
                    Description = string.IsNullOrWhiteSpace(item.Configuration)
                        ? product.Name
                        : $"{product.Name} - {item.Configuration}",
                    Quantity = parent.Quantity * Math.Max(1, component.Quantity),
                    UnitPrice = 0m,
                    IsTaxable = false,
                    TakeWith = parent.TakeWith,
                    SortOrder = parent.SortOrder + 1,
                    ChoicesJson = Choices.ToJson(chosen),
                    StockKey = Choices.KeyFor(chosen, Choices.CountedOptions(product)),
                });
            }
        }

        /// <summary>
        /// The stock an included item draws from, from the selections picked for it.
        /// </summary>
        private static string IncludedStockKey(ProductVariantComponent component, Dictionary<int, List<LineChoice>> choices)
        {
            var product = component.ComponentVariant?.Product;
            return product == null
                ? ""
                : Choices.KeyFor(choices.GetValueOrDefault(component.ComponentVariantId) ?? [], Choices.CountedOptions(product));
        }

        /// <summary>
        /// The selection and choice ids sent by the dashboard.
        /// </summary>
        private static IEnumerable<(int OptionId, int ChoiceId)> PickedChoices(List<LineChoiceDto>? choices) =>
            (choices ?? [])
                .Where(c => c.OptionId != null && c.ChoiceId != null)
                .Select(c => (c.OptionId!.Value, c.ChoiceId!.Value));

        /// <summary>
        /// Why a financing type can't be recorded, or null when it can: it must be one of the
        /// finance options offered, unless Settings lets checkout type in another.
        /// </summary>
        /// <param name="financeType">Trimmed financing type</param>
        /// <returns>A message for checkout, or null.</returns>
        private async Task<string?> FinanceTypeProblemAsync(string financeType)
        {
            var lower = financeType.ToLower();
            if (await DB.FinanceOptions.AnyAsync(f => f.IsActive && f.Name.ToLower() == lower))
                return null;

            return (await SettingsStore.LoadAsync(DB)).AllowOtherFinanceType
                ? null
                : "Choose one of the financing options.";
        }

        /// <summary>
        /// A financing type spelt as its finance option is, when it is one, so the same kind
        /// always reads the same on sales sheets.
        /// </summary>
        /// <param name="financeType">Trimmed financing type</param>
        /// <returns>The option's name, or the type as given.</returns>
        private async Task<string> CanonicalFinanceTypeAsync(string financeType)
        {
            var lower = financeType.ToLower();
            return await DB.FinanceOptions
                .Where(f => f.IsActive && f.Name.ToLower() == lower)
                .Select(f => f.Name)
                .FirstOrDefaultAsync() ?? financeType;
        }

        /// <summary>
        /// Trimmed text, or null when blank.
        /// </summary>
        private static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        /// <summary>
        /// Builds the Description cell for a catalog variant, e.g. "Agility 3000 - IMC61 Adjustable".
        /// </summary>
        /// <param name="variant">Catalog variant with its product loaded</param>
        /// <returns>The description text.</returns>
        private static string BuildDescription(ProductVariant variant)
        {
            var name = variant.Product?.Name ?? "Item";
            return string.IsNullOrWhiteSpace(variant.Configuration)
                ? name
                : $"{name} - {variant.Configuration}";
        }

        /// <summary>
        /// Copies the header row fields from a request onto an order.
        /// </summary>
        /// <param name="order">Target order</param>
        /// <param name="request">Incoming DTO</param>
        private static void ApplyHeader(Order order, OrderDto request)
        {
            if (request.DraftLabel != null)
                order.DraftLabel = string.IsNullOrWhiteSpace(request.DraftLabel) ? null : request.DraftLabel;

            if (request.SaleDate != null)
                order.SaleDate = request.SaleDate.Value;

            if (request.Organization != null)
                order.Organization = request.Organization;

            if (request.AdvertisingSource != null)
                order.AdvertisingSource = request.AdvertisingSource;

            if (request.ReferralName != null)
                order.ReferralName = request.ReferralName;

            if (request.CfsRepName != null)
                order.CfsRepName = request.CfsRepName;
        }

        /// <summary>
        /// Copies the billing block from a request onto an order.
        /// </summary>
        /// <param name="order">Target order</param>
        /// <param name="request">Incoming DTO</param>
        private static void ApplyBilling(Order order, OrderDto request)
        {
            if (request.BillingName != null) order.BillingName = request.BillingName;
            if (request.BillingAddress != null) order.BillingAddress = request.BillingAddress;
            if (request.BillingUnit != null) order.BillingUnit = request.BillingUnit;
            if (request.BillingFloor != null) order.BillingFloor = request.BillingFloor;
            if (request.BillingSuite != null) order.BillingSuite = request.BillingSuite;
            if (request.BillingCity != null) order.BillingCity = request.BillingCity;
            if (request.BillingState != null) order.BillingState = request.BillingState;
            if (request.BillingZip != null) order.BillingZip = request.BillingZip;
            if (request.BillingCell != null) order.BillingCell = request.BillingCell;
            if (request.BillingAlt != null) order.BillingAlt = request.BillingAlt;
            if (request.BillingEmail != null) order.BillingEmail = request.BillingEmail;
        }

        /// <summary>
        /// Copies the delivery block from a request onto an order.
        /// </summary>
        /// <param name="order">Target order</param>
        /// <param name="request">Incoming DTO</param>
        private static void ApplyDelivery(Order order, OrderDto request)
        {
            if (request.DeliverySameAsBilling != null) order.DeliverySameAsBilling = request.DeliverySameAsBilling.Value;
            if (request.DeliveryName != null) order.DeliveryName = request.DeliveryName;
            if (request.DeliveryAddress != null) order.DeliveryAddress = request.DeliveryAddress;
            if (request.DeliveryUnit != null) order.DeliveryUnit = request.DeliveryUnit;
            if (request.DeliveryFloor != null) order.DeliveryFloor = request.DeliveryFloor;
            if (request.DeliverySuite != null) order.DeliverySuite = request.DeliverySuite;
            if (request.DeliveryCity != null) order.DeliveryCity = request.DeliveryCity;
            if (request.DeliveryState != null) order.DeliveryState = request.DeliveryState;
            if (request.DeliveryZip != null) order.DeliveryZip = request.DeliveryZip;
            if (request.DeliveryCell != null) order.DeliveryCell = request.DeliveryCell;
            if (request.DeliveryAlt != null) order.DeliveryAlt = request.DeliveryAlt;
            if (request.DeliveryEmail != null) order.DeliveryEmail = request.DeliveryEmail;
        }

        /// <summary>
        /// Copies the initials and signature block from a request onto an order.
        /// </summary>
        /// <param name="order">Target order</param>
        /// <param name="request">Incoming DTO</param>
        /// <summary>
        /// Whether the customer has confirmed their details, initialled all three paragraphs and
        /// signed - everything the sales sheet needs before the sale is final.
        /// </summary>
        /// <param name="order">Order entity</param>
        /// <returns>True when complete.</returns>
        private static bool IsAcknowledged(Order order)
        {
            return !string.IsNullOrWhiteSpace(order.CustomerInfoInitials)
                   && !string.IsNullOrWhiteSpace(order.WarrantyInitials)
                   && !string.IsNullOrWhiteSpace(order.DropShipInitials)
                   && !string.IsNullOrWhiteSpace(order.AdvisoryInitials)
                   && !string.IsNullOrWhiteSpace(order.CustomerSignature);
        }

        /// <summary>
        /// Everything the customer confirms on the details screen, as one string for comparison.
        /// </summary>
        /// <param name="order">Order entity</param>
        /// <returns>The details, joined.</returns>
        private static string CustomerDetails(Order order)
        {
            return string.Join("|",
                order.BillingName, order.BillingAddress, order.BillingUnit, order.BillingFloor,
                order.BillingSuite, order.BillingCity, order.BillingState, order.BillingZip,
                order.BillingCell, order.BillingAlt, order.BillingEmail, order.DeliverySameAsBilling,
                order.DeliveryName, order.DeliveryAddress, order.DeliveryUnit, order.DeliveryFloor,
                order.DeliverySuite, order.DeliveryCity, order.DeliveryState, order.DeliveryZip,
                order.DeliveryCell, order.DeliveryAlt, order.DeliveryEmail);
        }

        private static void ApplyAcknowledgements(Order order, OrderDto request)
        {
            if (request.CustomerInfoInitials != null) order.CustomerInfoInitials = request.CustomerInfoInitials;
            if (request.WarrantyInitials != null) order.WarrantyInitials = request.WarrantyInitials;
            if (request.DropShipInitials != null) order.DropShipInitials = request.DropShipInitials;
            if (request.AdvisoryInitials != null) order.AdvisoryInitials = request.AdvisoryInitials;
            if (request.CustomerSignatureName != null) order.CustomerSignatureName = request.CustomerSignatureName;
            if (request.CustomerSignature != null)
                order.CustomerSignature = string.IsNullOrWhiteSpace(request.CustomerSignature)
                    ? null
                    : request.CustomerSignature;
            if (request.SignedDate != null) order.SignedDate = request.SignedDate;
            if (request.ReceivedBy != null) order.ReceivedBy = request.ReceivedBy;
            if (request.ReceivedDate != null) order.ReceivedDate = request.ReceivedDate;
        }

        /// <summary>
        /// Reloads an order and maps it to the full DTO.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The mapped DTO, or null when the order is gone.</returns>
        private async Task<OrderDto?> LoadDtoAsync(int id)
        {
            var order = await DB.Orders
                .Include(o => o.Lines)
                .ThenInclude(l => l.ProductVariant)
                .ThenInclude(v => v!.Product)
                .Include(o => o.Lines)
                .ThenInclude(l => l.ProductVariant)
                .ThenInclude(v => v!.ChoiceStocks)
                .Include(o => o.Payments)
                .Include(o => o.Event)
                .Include(o => o.CreatedByUser)
                .Include(o => o.CompletedByUser)
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == id);

            return order == null ? null : ToDto(order);
        }

        /// <summary>
        /// Maps an order entity to the full DTO.
        /// </summary>
        /// <param name="order">Order entity with children loaded</param>
        /// <returns>The mapped DTO.</returns>
        private static OrderDto ToDto(Order order)
        {
            return new OrderDto
            {
                Id = order.Id,
                EventId = order.EventId,
                OrderNumber = order.OrderNumber,
                Status = order.Status.ToString(),
                DraftLabel = order.DraftLabel,
                SaleDate = order.SaleDate,
                Organization = order.Organization,
                AdvertisingSource = order.AdvertisingSource,
                ReferralName = order.ReferralName,
                CfsRepName = order.CfsRepName,
                BillingName = order.BillingName,
                BillingAddress = order.BillingAddress,
                BillingUnit = order.BillingUnit,
                BillingFloor = order.BillingFloor,
                BillingSuite = order.BillingSuite,
                BillingCity = order.BillingCity,
                BillingState = order.BillingState,
                BillingZip = order.BillingZip,
                BillingCell = order.BillingCell,
                BillingAlt = order.BillingAlt,
                BillingEmail = order.BillingEmail,
                DeliverySameAsBilling = order.DeliverySameAsBilling,
                DeliveryName = order.DeliveryName,
                DeliveryAddress = order.DeliveryAddress,
                DeliveryUnit = order.DeliveryUnit,
                DeliveryFloor = order.DeliveryFloor,
                DeliverySuite = order.DeliverySuite,
                DeliveryCity = order.DeliveryCity,
                DeliveryState = order.DeliveryState,
                DeliveryZip = order.DeliveryZip,
                DeliveryCell = order.DeliveryCell,
                DeliveryAlt = order.DeliveryAlt,
                DeliveryEmail = order.DeliveryEmail,
                Comments = order.Comments,
                SalesTaxRate = order.SalesTaxRate,
                CcProcessingFeeRate = order.CcProcessingFeeRate,
                ApplyCcProcessingFee = order.ApplyCcProcessingFee,
                WaiveCcProcessingFee = order.WaiveCcProcessingFee,
                Subtotal = order.Subtotal,
                TaxAmount = order.TaxAmount,
                CcProcessingFee = order.CcProcessingFee,
                Total = order.Total,
                AmountPaid = order.AmountPaid,
                BalanceDue = order.BalanceDue,
                CustomerInfoInitials = order.CustomerInfoInitials,
                WarrantyInitials = order.WarrantyInitials,
                DropShipInitials = order.DropShipInitials,
                AdvisoryInitials = order.AdvisoryInitials,
                Terms = order.TermsJson == null
                    ? null
                    : SettingsStore.ReadTerms(order.TermsJson)
                        .Select(t => new SalesTermDto { Key = t.Key, Title = t.Title, Heading = t.Heading, Text = t.Text })
                        .ToList(),
                CustomerSignatureName = order.CustomerSignatureName,
                CustomerSignature = order.CustomerSignature,
                SignedDate = order.SignedDate,
                ReceivedBy = order.ReceivedBy,
                ReceivedDate = order.ReceivedDate,
                CreatedByName = order.CreatedByUser?.Name,
                CompletedByName = order.CompletedByUser?.Name,
                CreatedAt = order.CreatedAt,
                SubmittedAt = order.SubmittedAt,
                CompletedAt = order.CompletedAt,
                UpdatedAt = order.UpdatedAt,
                EventOrganization = order.Event?.Organization,
                Lines = order.Lines
                    .OrderBy(l => l.SortOrder)
                    .Select(l => new OrderLineDto
                    {
                        Id = l.Id,
                        LineType = l.LineType.ToString(),
                        Category = l.Category.ToString(),
                        ProductVariantId = l.ProductVariantId,
                        DeliveryOptionId = l.DeliveryOptionId,
                        ParentLineId = l.ParentLineId,
                        Brand = l.Brand,
                        Size = l.Size,
                        Description = l.Description,
                        Quantity = l.Quantity,
                        TakeWith = l.TakeWith,
                        UnitPrice = l.UnitPrice,
                        DiscountPercent = l.DiscountPercent,
                        DiscountAmount = l.DiscountAmount,
                        SaleDiscountPercent = l.SaleDiscountPercent,
                        SaleDiscountAmount = l.SaleDiscountAmount,
                        Choices = Choices.FromJson(l.ChoicesJson)
                            .Select(c => new LineChoiceDto
                            {
                                OptionId = c.OptionId,
                                ChoiceId = c.ChoiceId,
                                Option = c.Option,
                                Choice = c.Choice,
                                PriceAdjustment = c.PriceAdjustment,
                            })
                            .ToList(),
                        StockKey = l.StockKey,
                        SalePrice = l.SalePrice,
                        LineTotal = l.LineTotal,
                        IncludesAdjustableBase = l.IncludesAdjustableBase,
                        ShowOnSalesSheet = l.ShowOnSalesSheet,
                        IsTaxable = l.IsTaxable,
                        SortOrder = l.SortOrder,
                        Notes = l.Notes,
                        QuantityOnHand = l.ProductVariant?.Product?.TrackInventory == true && !l.ProductVariant.ExcludeFromInventory
                            ? string.IsNullOrEmpty(l.StockKey)
                                ? l.ProductVariant.QuantityOnHand
                                : l.ProductVariant.ChoiceStocks.FirstOrDefault(c => c.StockKey == l.StockKey)?.QuantityOnHand ?? 0
                            : null,
                        NotKeptAtCart = InventoryRules.NotKept(l.ProductVariant)
                                        || order.Lines.Any(c => c.ParentLineId == l.Id
                                                                && c.LineType == OrderLineType.Included
                                                                && InventoryRules.NotKept(c.ProductVariant)),
                    })
                    .ToList(),
                Payments = order.Payments
                    .OrderBy(p => p.Id)
                    .Select(p => new OrderPaymentDto
                    {
                        Id = p.Id,
                        Method = p.Method.ToString(),
                        Amount = p.Amount,
                        CheckNumber = p.CheckNumber,
                        Reference = p.Reference,
                        FinanceType = p.FinanceType,
                    })
                    .ToList(),
            };
        }

        /// <summary>
        /// Maps an order entity to the lightweight summary DTO used by the queues.
        /// </summary>
        /// <param name="order">Order entity with lines loaded</param>
        /// <returns>The mapped summary.</returns>
        private static OrderSummaryDto ToSummaryDto(Order order)
        {
            return new OrderSummaryDto
            {
                Id = order.Id,
                EventId = order.EventId,
                OrderNumber = order.OrderNumber,
                EventOrganization = order.Event?.Organization,
                EventDate = order.Event?.EventDate,
                Status = order.Status.ToString(),
                DraftLabel = order.DraftLabel,
                BillingName = order.BillingName,
                CfsRepName = order.CfsRepName,
                BillingCell = order.BillingCell,
                BillingAlt = order.BillingAlt,
                BillingEmail = order.BillingEmail,
                LineCount = order.Lines.Count,
                Subtotal = order.Subtotal,
                Total = order.Total,
                BalanceDue = order.BalanceDue,
                CreatedAt = order.CreatedAt,
                SubmittedAt = order.SubmittedAt,
                CompletedAt = order.CompletedAt,
                UpdatedAt = order.UpdatedAt,
            };
        }

        #endregion
    }
}
