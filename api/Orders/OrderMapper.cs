using api.Dtos;
using api.Models;
using api.Utils;

namespace api.Orders
{
    /// <summary>
    /// Maps orders to the DTOs the floor, checkout and the dashboard read.
    /// </summary>
    public static class OrderMapper
    {
        #region Public Methods

        /// <summary>
        /// Maps an order entity to the full DTO.
        /// </summary>
        /// <param name="order">Order entity with children loaded</param>
        /// <param name="onHand">The territory's stock of the order's tracked items, or null to leave it out</param>
        /// <param name="currentTerms">The statements in force now in the order's territory, for an order with no copy of its own</param>
        /// <returns>The mapped DTO.</returns>
        public static OrderDto ToDto(Order order, Dictionary<(int VariantId, string StockKey), int>? onHand, IReadOnlyList<SalesTerm> currentTerms)
        {
            // A completed order is judged by the wording, and rules, it was signed under.
            var terms = order.TermsJson == null ? currentTerms : SettingsStore.ReadTerms(order.TermsJson);

            return new OrderDto
            {
                Id = order.Id,
                EventId = order.EventId,
                TerritoryId = order.Event?.TerritoryId,
                TerritoryName = order.Event?.Territory?.Name,
                OrderNumber = order.OrderNumber,
                Status = order.Status.ToString(),
                DraftLabel = order.DraftLabel,
                SaleDate = order.SaleDate,
                Organization = order.Organization,
                AdvertisingSource = order.AdvertisingSource,
                ReferralName = order.ReferralName,
                CfsRepName = order.CfsRepName,
                BillingName = order.BillingName,
                BillingFirstName = order.BillingFirstName,
                BillingLastName = order.BillingLastName,
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
                    : SettingsStore.ReadTerms(order.TermsJson).Select(SalesTermDto.From).ToList(),
                RequiredTerms = Acknowledgements.RequiredTerms(order, terms),
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
                        HasWarranty = l.HasWarranty,
                        WarrantyLength = l.WarrantyLength,
                        ShowOnSalesSheet = l.ShowOnSalesSheet,
                        IsTaxable = l.IsTaxable,
                        SortOrder = l.SortOrder,
                        Notes = l.Notes,
                        QuantityOnHand = InventoryRules.IsTracked(l.ProductVariant) && onHand != null
                            ? onHand.GetValueOrDefault((l.ProductVariant!.Id, l.StockKey ?? ""))
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
        public static OrderSummaryDto ToSummaryDto(Order order)
        {
            return new OrderSummaryDto
            {
                Id = order.Id,
                EventId = order.EventId,
                TerritoryId = order.Event?.TerritoryId,
                TerritoryName = order.Event?.Territory?.Name,
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
                ItemCount = order.Lines.Where(OrderRules.IsItem).Sum(l => l.Quantity),
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
