using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using api.Catalog;
using api.Data;
using api.Dtos;
using api.Inventory;
using api.Models;
using api.Orders;
using api.Settings;
using api.Utils;

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
        ILogger<BasicController> logger)
        : BasicController(db, logger)
    {
        #region POST Methods

        /// <summary>
        /// Opens a new draft order against an event. It gets its order number when its first item is
        /// added, so a draft opened just to look at prices uses up no number.
        /// </summary>
        /// <param name="request">Event id, and optionally a draft label and rep name</param>
        /// <returns>The created order.</returns>
        [HttpPost("order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddOrder([FromBody] OrderDto request)
        {
            if (request.EventId == null)
                return BadRequest(new { error = "Missing parameter." });

            var saleEvent = (await DB.Events.FindAsync(request.EventId.Value)).IfVisibleTo(Scope);
            if (saleEvent == null)
                return NotFound(new { error = "Event not found." });

            // New sales are only written against the active event, so nothing is taken under an
            // event that has finished or not been set up yet.
            if (!saleEvent.IsActive)
                return BadRequest(new { error = "There is no active event. A manager needs to activate one before new orders can be taken." });

            var order = new Order
            {
                EventId = saleEvent.Id,
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

            DB.Orders.Add(order);
            await DB.SaveChangesAsync();

            return Ok(await LoadDtoAsync(order.Id));
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
            var order = await LoadOrderAsync(id);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            if (OrderRules.IsClosed(order))
                return BadRequest(new { error = OrderRules.ClosedMessage });

            var lineType = Enum.TryParse<OrderLineType>(request.LineType, true, out var parsedType)
                ? parsedType
                : OrderLineType.Product;

            OrderLine line;
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

                // Only items from the event's territory's catalog.
                if (variant == null || variant.Product?.TerritoryId != order.Event!.TerritoryId)
                    return NotFound(new { error = "Product not found." });

                // A variant with no price is an "Inquire" card - the rep has to key a price in.
                if (variant.Price == null && request.UnitPrice == null)
                    return BadRequest(new { error = "This size has no price on file. Enter a price to continue." });

                // Selections such as Color: every required one needs a choice.
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

                line = OrderLines.ForVariant(variant, chosen, request.UnitPrice);
                line.Brand = request.Brand ?? line.Brand;
                line.Size = request.Size ?? line.Size;
                line.Description = request.Description ?? line.Description;

                soldVariant = variant;
            }
            else if (lineType == OrderLineType.Delivery && request.DeliveryOptionId != null)
            {
                var option = await OrderLines.FindDeliveryOptionAsync(DB, request.DeliveryOptionId.Value, order.Event!.TerritoryId);
                if (option == null)
                    return NotFound(new { error = "Delivery option not found." });

                var parentLine = order.Lines.FirstOrDefault(l => l.Id == request.ParentLineId);
                var forProduct = await OrderLines.ProductDeliveryAsync(DB, option.Id, parentLine?.ProductVariantId);

                // Unlike a shipping row added with its item, a negative price here is refused below.
                line = OrderLines.Delivery(order, option, forProduct, parentLine, request.UnitPrice);
                line.Description = request.Description ?? line.Description;
                // Linked to the line asked for, even one that isn't on this order.
                line.ParentLineId = request.ParentLineId;
            }
            else if (lineType == OrderLineType.Upcharge)
            {
                // An upcharge hangs off an item the customer is buying, never off a shipping
                // row, an included item or another upcharge.
                var parentLine = order.Lines.FirstOrDefault(l => l.Id == request.ParentLineId);
                if (parentLine == null || parentLine.LineType is not (OrderLineType.Product or OrderLineType.Custom))
                    return BadRequest(new { error = "Pick the item the upcharge is for." });

                switch (OrderLines.DescriptionProblem(request.Description, storedTrimmed: true))
                {
                    case DescriptionGap.Missing:
                        return BadRequest(new { error = "Enter the reason for the upcharge." });
                    case DescriptionGap.TooLong:
                        return BadRequest(new { error = "The reason can be at most 300 characters." });
                }

                if (request.UnitPrice is not > 0)
                    return BadRequest(new { error = "Enter the upcharge amount." });

                line = new OrderLine
                {
                    Category = ProductCategory.Misc,
                    Description = request.Description!.Trim(),
                    UnitPrice = request.UnitPrice.Value,
                    ParentLineId = parentLine.Id,
                };
            }
            else
            {
                switch (OrderLines.DescriptionProblem(request.Description))
                {
                    case DescriptionGap.Missing:
                        return BadRequest(new { error = "Missing parameter." });
                    case DescriptionGap.TooLong:
                        return BadRequest(new { error = "Invalid parameter." });
                }

                lineType = OrderLineType.Custom;
                line = new OrderLine
                {
                    Category = Enum.TryParse<ProductCategory>(request.Category, true, out var category)
                        ? category
                        : ProductCategory.Misc,
                    Brand = request.Brand,
                    Size = request.Size,
                    Description = request.Description!,
                    UnitPrice = request.UnitPrice ?? 0m,
                };
            }

            line.OrderId = order.Id;
            line.LineType = lineType;
            line.SortOrder = order.Lines.Count == 0 ? 1 : order.Lines.Max(l => l.SortOrder) + 1;
            line.Quantity = request.Quantity ?? 1;

            if (request.TakeWith != null)
                line.TakeWith = request.TakeWith.Value;

            if (request.IsTaxable != null)
                line.IsTaxable = request.IsTaxable.Value;

            if (OrderLines.NotesProblem(request.Notes) is { } notesProblem)
                return BadRequest(new { error = notesProblem });

            line.Notes = OrderLines.CleanNotes(request.Notes);

            if (OrderLines.ValuesProblem(line.Quantity, line.UnitPrice, request.DiscountPercent, request.DiscountAmount) is { } valuesProblem)
                return BadRequest(new { error = valuesProblem });

            OrderLines.SetDiscount(line, request.DiscountPercent, request.DiscountAmount);

            if (line.LineType == OrderLineType.Upcharge)
                OrderLines.KeepUpchargePlain(line);

            // A tracked item can only be a Take With while the cart has enough of it on hand;
            // otherwise it has to ship. The shipping choice that rides along with a product
            // line and the items inside a bundle count too, so check before anything is saved.
            if (line.LineType == OrderLineType.Product && request.DeliveryOptionId != null
                && await DB.DeliveryOptions.AnyAsync(d => d.Id == request.DeliveryOptionId && d.IsTakeWith))
                line.TakeWith = true;

            var bundleDemand = OrderLines.BundleTakeWithDemand(line, soldVariant, includedChoices);

            var stockError = await InventoryRules.CheckStockAsync(DB, order, line, bundleDemand);
            if (stockError != null)
                return BadRequest(new { error = stockError });

            order.Lines.Add(line);
            await DB.SaveChangesAsync();

            // A bundle - such as a mattress sold as a set with an adjustable base - gets each
            // included item on its own row underneath, so the sheet shows exactly what is being
            // delivered. Anything sold on its own has no components and adds nothing here.
            if (line.LineType == OrderLineType.Product && soldVariant is { Components.Count: > 0 })
                order.Lines.AddRange(OrderLines.BundleComponents(order, line, soldVariant, includedChoices));

            // A product line may carry its delivery choice with it, so the floor can add both
            // in one tap without a second round trip.
            if (line.LineType == OrderLineType.Product && request.DeliveryOptionId != null)
            {
                var added = await AddLinkedDeliveryLineAsync(order, line, request.DeliveryOptionId.Value);
                if (!added)
                    return NotFound(new { error = "Delivery option not found." });
            }

            return await SavedAsync(order, OrderChange.Lines);
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
            var order = await LoadOrderAsync(id);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            if (order.Status == OrderStatus.Voided)
                return BadRequest(new { error = OrderRules.VoidedMessage });

            if (request.Amount == null || string.IsNullOrWhiteSpace(request.Method))
                return BadRequest(new { error = "Missing parameter." });

            if (!Enum.TryParse<PaymentMethod>(request.Method, true, out var method))
                return BadRequest(new { error = "Invalid parameter." });

            if (request.Amount.Value <= 0)
                return BadRequest(new { error = OrderPayments.AmountMessage });

            var reference = OrderFields.Clean(request.Reference);
            var financeType = method == PaymentMethod.Financing ? OrderFields.Clean(request.FinanceType) : null;
            if (reference?.Length > OrderPayments.MaxReferenceLength || financeType?.Length > OrderPayments.MaxReferenceLength)
                return BadRequest(new { error = OrderPayments.TooLongMessage });

            if (financeType != null)
            {
                var (resolved, typeProblem) = await OrderPayments.ResolveFinanceTypeAsync(DB, financeType, order.Event!.TerritoryId);
                if (typeProblem != null)
                    return BadRequest(new { error = typeProblem });
                financeType = resolved;
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

            return await SavedAsync(order, OrderChange.Amounts);
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
            var order = await LoadOrderAsync(id);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            return await AnswerAsync(order, await OrderLifecycle.SubmitAsync(DB, order));
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
            var order = await LoadOrderAsync(id);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            return await AnswerAsync(order, await OrderLifecycle.CompleteAsync(DB, order, Actor()));
        }

        /// <summary>
        /// Sends an order back to the checkout table or the sales floor. Checkout uses this when it
        /// spots something wrong; a manager or above can also use it on a completed sale, which takes
        /// it out of the day's totals until it is completed again, or on a voided order, to bring it
        /// back. Payments already recorded stay on the order.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <param name="to">"floor" (the default) or "checkout"</param>
        /// <returns>The reopened order.</returns>
        [HttpPost("order/{id}/reopen")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ReopenOrder(int id, [FromQuery] string? to = null)
        {
            var order = await LoadOrderAsync(id);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            var target = string.IsNullOrWhiteSpace(to) || to.Equals("floor", StringComparison.OrdinalIgnoreCase)
                ? OrderStatus.Draft
                : to.Equals("checkout", StringComparison.OrdinalIgnoreCase)
                    ? OrderStatus.AwaitingCheckout
                    : (OrderStatus?)null;

            if (target == null)
                return BadRequest(new { error = "Invalid parameter." });

            return await AnswerAsync(order, await OrderLifecycle.ReopenAsync(DB, order, target.Value, Actor()));
        }

        /// <summary>
        /// Voids an order. The row is kept for the audit trail but drops out of every total. The
        /// checkout table may void an order waiting there; anything on the sales floor or already
        /// completed takes a manager or above.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The voided order.</returns>
        [HttpPost("order/{id}/void")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> VoidOrder(int id)
        {
            var order = await LoadOrderAsync(id);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            return await AnswerAsync(order, await OrderLifecycle.VoidAsync(DB, order, Actor()));
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
            if (!await EventVisibleAsync(eventId))
                return NotFound(new { error = "Event not found." });

            // A draft with nothing on it yet has no number and isn't an order to anyone but
            // the rep who opened it, so it stays off the Orders screen.
            var query = DB.Orders.Where(o => o.EventId == eventId).WithoutBlankDrafts();

            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!Enum.TryParse<OrderStatus>(status, true, out var parsed))
                    return BadRequest(new { error = "Invalid parameter." });

                query = query.Where(o => o.Status == parsed);
            }

            var orders = await query
                .ForSummary()
                .OrderByDescending(o => o.UpdatedAt)
                .ToListAsync();

            return Ok(orders.Select(OrderMapper.ToSummaryDto).ToList());
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
            if (!await EventVisibleAsync(eventId))
                return NotFound(new { error = "Event not found." });

            var userId = GetCurrentUserId();

            var query = DB.Orders
                .Where(o => o.EventId == eventId && o.Status == OrderStatus.Draft);

            if (!all && userId != null)
                query = query.Where(o => o.CreatedByUserId == userId.Value);

            var orders = await query
                .ForSummary()
                .OrderBy(o => o.CreatedAt)
                .ToListAsync();

            return Ok(orders.Select(OrderMapper.ToSummaryDto).ToList());
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
            if (!await EventVisibleAsync(eventId))
                return NotFound(new { error = "Event not found." });

            var orders = await DB.Orders
                .Where(o => o.EventId == eventId && o.Status == OrderStatus.AwaitingCheckout)
                .ForSummary()
                .OrderBy(o => o.SubmittedAt)
                .ToListAsync();

            return Ok(orders.Select(OrderMapper.ToSummaryDto).ToList());
        }

        /// <summary>
        /// Every order across every event in the territory being viewed - or every territory for an
        /// system admin or administrator viewing them all - newest first. Managers and above only; this is
        /// how they look back at a fundraiser that finished weeks ago.
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
            if (!IsAtLeast(UserRole.Manager))
                return Forbidden("Only a manager, administrator or system admin may browse every event.");

            // Blank drafts, with no number yet, aren't listed.
            var query = DB.Orders.VisibleTo(Scope).WithoutBlankDrafts();

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
                .ForSummary()
                .OrderByDescending(o => o.SaleDate)
                .ThenByDescending(o => o.OrderNumber)
                .Take(Math.Clamp(take, 1, 500))
                .ToListAsync();

            return Ok(orders.Select(OrderMapper.ToSummaryDto).ToList());
        }

        /// <summary>
        /// Full orders for an event, ready to print as a stack of sales sheets or export. Managers
        /// and above only.
        /// Defaults to completed sales, which is what goes in the event's paperwork.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <param name="status">Status to include; defaults to Completed</param>
        /// <returns>Full orders in order-number order.</returns>
        [HttpGet("orders/event/{eventId}/sheets")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetSalesSheetsForEvent(int eventId, [FromQuery] string? status = null)
        {
            if (!IsAtLeast(UserRole.Manager))
                return Forbidden("Only a manager, administrator or system admin may export an event's sales sheets.");

            if (!await EventVisibleAsync(eventId))
                return NotFound(new { error = "Event not found." });

            var wanted = OrderStatus.Completed;
            if (!string.IsNullOrWhiteSpace(status) && !Enum.TryParse(status, true, out wanted))
                return BadRequest(new { error = "Invalid parameter." });

            var orders = await DB.Orders
                .Where(o => o.EventId == eventId && o.Status == wanted)
                .Include(o => o.Lines)
                .Include(o => o.Payments)
                .Include(o => o.Event)
                .ThenInclude(e => e!.Territory)
                .Include(o => o.CreatedByUser)
                .Include(o => o.CompletedByUser)
                .AsNoTracking()
                .OrderBy(o => o.OrderNumber)
                .ToListAsync();

            // The event's territory may word its terms its own way.
            var currentTerms = (await SettingsStore.LoadAsync(DB, orders.FirstOrDefault()?.Event?.TerritoryId)).Terms;
            return Ok(orders.Select(o => OrderMapper.ToDto(o, null, currentTerms)).ToList());
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
            var dto = await LoadDtoAsync(id);
            if (dto == null)
                return NotFound(new { error = "Order not found." });

            return Ok(dto);
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
            var order = await LoadOrderAsync(id);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            if (OrderRules.IsClosed(order))
                return BadRequest(new { error = OrderRules.ClosedMessage });

            var items = LineOrder.Items(order);
            if (itemIds.Count != items.Count || itemIds.Distinct().Count() != itemIds.Count
                || items.Any(l => !itemIds.Contains(l.Id)))
                return BadRequest(new { error = "The order has changed. Refresh and try again." });

            LineOrder.Normalize(order, itemIds);
            return await SavedAsync(order, OrderChange.Other);
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
            if (request.Id == null)
                return BadRequest(new { error = "Missing parameter." });

            var order = await LoadOrderAsync(request.Id.Value);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            if (order.Status == OrderStatus.Voided)
                return BadRequest(new { error = OrderRules.VoidedMessage });

            if (Rates.Problem(request.SalesTaxRate, request.CcProcessingFeeRate) is { } rateProblem)
                return BadRequest(new { error = rateProblem });

            // The customer initialled the details they were shown; if those details change,
            // they have to look again before the sale can be completed.
            OrderFields.Apply(order, request);

            // Waiving the card fee is a checkout decision, and changes the total of a sale
            // that is still open only.
            if (request.WaiveCcProcessingFee != null && request.WaiveCcProcessingFee.Value != order.WaiveCcProcessingFee)
            {
                if (order.Status == OrderStatus.Completed)
                    return BadRequest(new { error = "This sale is complete, so its card fee can no longer be changed." });
                if (!Scope.CanWorkCheckout)
                    return Forbidden("Only the checkout table can waive the card fee.");

                order.WaiveCcProcessingFee = request.WaiveCcProcessingFee.Value;
            }

            return await SavedAsync(order, OrderChange.Amounts);
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
            if (request.Id == null)
                return BadRequest(new { error = "Missing parameter." });

            var existing = await DB.OrderLines.FindAsync(request.Id.Value);
            if (existing == null)
                return NotFound(new { error = "Line not found." });

            var order = await LoadOrderAsync(existing.OrderId);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            if (OrderRules.IsClosed(order))
                return BadRequest(new { error = OrderRules.ClosedMessage });

            var line = order.Lines.First(l => l.Id == request.Id.Value);

            if (line.LineType == OrderLineType.Included)
                return BadRequest(new { error = "This item comes with a bundle. Edit or remove the bundle line instead." });

            if (request.Description != null)
            {
                if (OrderLines.DescriptionProblem(request.Description) != DescriptionGap.None)
                    return BadRequest(new { error = "Invalid parameter." });

                line.Description = request.Description;
            }

            if (OrderLines.ValuesProblem(request.Quantity, request.UnitPrice, request.DiscountPercent, request.DiscountAmount) is { } valuesProblem)
                return BadRequest(new { error = valuesProblem });

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
                OrderLines.SetDiscount(line, request.DiscountPercent, null);
            else if (request.DiscountAmount != null)
                OrderLines.SetDiscount(line, null, request.DiscountAmount);

            if (request.IsTaxable != null)
                line.IsTaxable = request.IsTaxable.Value;

            if (request.Notes != null)
            {
                if (OrderLines.NotesProblem(request.Notes) is { } notesProblem)
                    return BadRequest(new { error = notesProblem });

                line.Notes = OrderLines.CleanNotes(request.Notes);
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
                OrderLines.KeepUpchargePlain(line);
            }

            var stockError = await InventoryRules.CheckStockAsync(DB, order);
            if (stockError != null)
                return BadRequest(new { error = stockError });

            return await SavedAsync(order, OrderChange.Amounts);
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
            if (request.Id == null)
                return BadRequest(new { error = "Missing parameter." });

            var existing = await DB.OrderPayments.FindAsync(request.Id.Value);
            if (existing == null)
                return NotFound(new { error = "Payment not found." });

            var order = await LoadOrderAsync(existing.OrderId);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            if (order.Status == OrderStatus.Voided)
                return BadRequest(new { error = OrderRules.VoidedMessage });

            if (request.Amount is <= 0)
                return BadRequest(new { error = OrderPayments.AmountMessage });

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

            var reference = OrderFields.Clean(request.Reference);
            var financeType = OrderFields.Clean(request.FinanceType);
            if (reference?.Length > OrderPayments.MaxReferenceLength || financeType?.Length > OrderPayments.MaxReferenceLength)
                return BadRequest(new { error = OrderPayments.TooLongMessage });

            if (request.Reference != null)
                payment.Reference = reference;

            // A type sent is checked even for a payment that isn't financing, then dropped below.
            if (request.FinanceType != null)
            {
                if (financeType != null)
                {
                    var (resolved, typeProblem) = await OrderPayments.ResolveFinanceTypeAsync(DB, financeType, order.Event!.TerritoryId);
                    if (typeProblem != null)
                        return BadRequest(new { error = typeProblem });
                    financeType = resolved;
                }
                payment.FinanceType = financeType;
            }

            // Only a financing payment carries a financing type.
            if (payment.Method != PaymentMethod.Financing)
                payment.FinanceType = null;

            return await SavedAsync(order, OrderChange.Amounts);
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
            if (permanent && !IsSystemAdmin())
                return Forbidden("Only a system admin can delete an order permanently.");

            var order = (await DB.Orders.Include(o => o.Event).FirstOrDefaultAsync(o => o.Id == id)).IfVisibleTo(Scope);
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

        /// <summary>
        /// Removes a line, along with any delivery line attached to it.
        /// </summary>
        /// <param name="id">Line id</param>
        /// <returns>The recalculated order.</returns>
        [HttpDelete("line/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteOrderLine(int id)
        {
            var existing = await DB.OrderLines.FindAsync(id);
            if (existing == null)
                return NotFound(new { error = "Line not found." });

            var order = await LoadOrderAsync(existing.OrderId);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            if (OrderRules.IsClosed(order))
                return BadRequest(new { error = OrderRules.ClosedMessage });

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

            return await SavedAsync(order, OrderChange.Lines);
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
            var existing = await DB.OrderPayments.FindAsync(id);
            if (existing == null)
                return NotFound(new { error = "Payment not found." });

            var order = await LoadOrderAsync(existing.OrderId);
            if (order == null)
                return NotFound(new { error = "Order not found." });

            if (order.Status == OrderStatus.Voided)
                return BadRequest(new { error = OrderRules.VoidedMessage });

            var payment = order.Payments.First(p => p.Id == id);
            order.Payments.Remove(payment);
            DB.OrderPayments.Remove(payment);

            return await SavedAsync(order, OrderChange.Amounts);
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// The answer to a status step: the reason it was refused, or the order as it now stands.
        /// </summary>
        /// <param name="order">The order</param>
        /// <param name="problem">Why the step was refused, or null when it was done</param>
        /// <returns>The response.</returns>
        private async Task<IActionResult> AnswerAsync(Order order, OrderProblem? problem)
        {
            if (problem != null)
                return problem.Forbidden ? Forbidden(problem.Message) : BadRequest(new { error = problem.Message });

            return Ok(await LoadDtoAsync(order.Id));
        }

        /// <summary>
        /// The signed-in user, as the order steps record them.
        /// </summary>
        /// <returns>Their id, name and whether they are a manager or above.</returns>
        private OrderActor Actor() => new(GetCurrentUserId(), GetCurrentUserName(), IsAtLeast(UserRole.Manager));

        /// <summary>
        /// The selection and choice ids sent by the dashboard.
        /// </summary>
        /// <param name="choices">The selections as sent</param>
        /// <returns>Selection id and choice id pairs.</returns>
        private static IEnumerable<(int OptionId, int ChoiceId)> PickedChoices(List<LineChoiceDto>? choices) =>
            (choices ?? [])
                .Where(c => c.OptionId != null && c.ChoiceId != null)
                .Select(c => (c.OptionId!.Value, c.ChoiceId!.Value));

        /// <summary>
        /// Saves a changed order with the bookkeeping its change calls for, and answers with the
        /// order as it now stands.
        /// </summary>
        /// <param name="order">The changed order, tracked</param>
        /// <param name="change">What the change touched</param>
        /// <returns>The order.</returns>
        private async Task<IActionResult> SavedAsync(Order order, OrderChange change)
        {
            await OrderSaving.SaveAsync(DB, order, change);
            return Ok(await LoadDtoAsync(order.Id));
        }

        /// <summary>
        /// Loads an order with its lines, payments and event tracked, ready to recalculate and save.
        /// An order from another territory's event counts as not found.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The order, or null when not found or not visible.</returns>
        private async Task<Order?> LoadOrderAsync(int id)
        {
            var order = await DB.Orders
                .Include(o => o.Lines)
                .Include(o => o.Payments)
                .Include(o => o.Event)
                .FirstOrDefaultAsync(o => o.Id == id);

            return order.IfVisibleTo(Scope);
        }

        /// <summary>
        /// Whether an event exists and the signed-in user may see it.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <returns>True when it exists and is in their territory, or they're company-wide.</returns>
        private async Task<bool> EventVisibleAsync(int eventId)
        {
            var territoryId = await DB.Events.Where(e => e.Id == eventId).Select(e => (int?)e.TerritoryId).FirstOrDefaultAsync();
            return territoryId != null && Scope.CanSee(territoryId);
        }

        /// <summary>
        /// Creates the shipping row that belongs to a product line and links the two. Every method
        /// gets a row, including no-charge ones such as Drop Ship, because the sheet has to say how
        /// each item is leaving the building.
        /// </summary>
        /// <param name="order">Owning order</param>
        /// <param name="parent">The product line the shipping row belongs to</param>
        /// <param name="deliveryOptionId">Chosen delivery option</param>
        /// <returns>False when the delivery option does not exist.</returns>
        private async Task<bool> AddLinkedDeliveryLineAsync(Order order, OrderLine parent, int deliveryOptionId)
        {
            var option = await OrderLines.FindDeliveryOptionAsync(DB, deliveryOptionId, order.Event!.TerritoryId);
            if (option == null)
                return false;

            var forProduct = await OrderLines.ProductDeliveryAsync(DB, option.Id, parent.ProductVariantId);

            parent.DeliveryOptionId = option.Id;

            var line = OrderLines.Delivery(order, option, forProduct, parent, keyedPrice: null);
            // Added along with its item, a negative price on file counts as no charge.
            if (line.UnitPrice < 0)
                line.UnitPrice = 0;
            line.SortOrder = parent.SortOrder + 2;
            order.Lines.Add(line);

            return true;
        }

        /// <summary>
        /// Reloads an order and maps it to the full DTO.
        /// </summary>
        /// <param name="id">Order id</param>
        /// <returns>The mapped DTO, or null when the order is gone.</returns>
        private async Task<OrderDto?> LoadDtoAsync(int id)
        {
            var order = (await DB.Orders
                .Include(o => o.Lines)
                .ThenInclude(l => l.ProductVariant)
                .ThenInclude(v => v!.Product)
                .Include(o => o.Payments)
                .Include(o => o.Event)
                .ThenInclude(e => e!.Territory)
                .Include(o => o.CreatedByUser)
                .Include(o => o.CompletedByUser)
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == id)).IfVisibleTo(Scope);

            if (order == null)
                return null;

            // What the event's territory has on hand, so the floor can see whether a Take With is possible.
            var tracked = order.Lines
                .Where(l => InventoryRules.IsTracked(l.ProductVariant))
                .Select(l => l.ProductVariant!.Id)
                .Distinct()
                .ToList();
            var onHand = tracked.Count == 0
                ? new Dictionary<(int VariantId, string StockKey), int>()
                : await InventoryRules.OnHandAsync(DB, order.Event!.TerritoryId, tracked);

            return OrderMapper.ToDto(order, onHand, (await SettingsStore.LoadAsync(DB, order.Event!.TerritoryId)).Terms);
        }

        #endregion
    }
}
