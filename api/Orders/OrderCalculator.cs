using api.Models;

namespace api.Utils
{
    /// <summary>
    /// Recomputes line and order money fields. Kept in one place so the sales floor, the checkout
    /// table and the printed receipt can never disagree about a total.
    /// </summary>
    public static class OrderCalculator
    {
        #region Public Methods

        /// <summary>
        /// Recalculates a single line's sale price and total from its unit price and discounts.
        /// The catalog sale comes off first, then the rep's own discount comes off the sale price.
        /// Each is a percent or a fixed amount off each item; a percent wins when both are set.
        /// </summary>
        /// <param name="line">Line to recalculate in place</param>
        public static void RecalculateLine(OrderLine line)
        {
            var unit = Discounted(line.UnitPrice, line.SaleDiscountPercent, line.SaleDiscountAmount);
            unit = Discounted(unit, line.DiscountPercent, line.DiscountAmount);

            var quantity = line.Quantity < 1 ? 1 : line.Quantity;

            line.Quantity = quantity;
            line.SalePrice = Round(unit);
            line.LineTotal = Round(line.SalePrice * quantity);
        }

        /// <summary>
        /// Recalculates every line, then the order subtotal, tax, card fee, total and balance due.
        /// </summary>
        /// <param name="order">Order to recalculate in place, with lines and payments loaded</param>
        public static void RecalculateOrder(Order order)
        {
            // An upcharge is charged per item and taxed like its item, so it follows the item's
            // quantity and tax setting whenever either changes.
            foreach (var upcharge in order.Lines.Where(l => l.LineType == OrderLineType.Upcharge))
            {
                var parent = order.Lines.FirstOrDefault(l => l.Id == upcharge.ParentLineId);
                if (parent == null)
                    continue;

                upcharge.Quantity = parent.Quantity;
                upcharge.IsTaxable = parent.IsTaxable;
            }

            foreach (var line in order.Lines)
                RecalculateLine(line);

            order.Subtotal = Round(order.Lines.Sum(l => l.LineTotal));

            var taxableBase = order.Lines.Where(l => l.IsTaxable).Sum(l => l.LineTotal);
            order.TaxAmount = Round(taxableBase * order.SalesTaxRate);

            var preFeeTotal = Round(order.Subtotal + order.TaxAmount);
            // Waived at the checkout table, the order carries no card fee however it is paid.
            var rate = order.WaiveCcProcessingFee ? 0m : order.CcProcessingFeeRate;

            // The card fee is charged only on the part of the sale paid by card, matching the
            // paper sheet where the fee box stays blank unless the customer pays by card. A $2,000
            // order with $1,000 paid in cash pays the fee on the other $1,000 only.
            var otherPaid = order.Payments
                .Where(p => p.Method != PaymentMethod.VisaMc)
                .Sum(p => p.Amount);

            var cardPaid = order.Payments
                .Where(p => p.Method == PaymentMethod.VisaMc)
                .Sum(p => p.Amount);

            // A card payment already includes its own fee, so strip it back out to find how much
            // of the sale it covered.
            var notCoveredByOtherMethods = Math.Max(0m, preFeeTotal - otherPaid);
            var coveredByCard = Math.Min(rate > 0 ? cardPaid / (1 + rate) : cardPaid, notCoveredByOtherMethods);

            // With the card picked at the checkout table, whatever is still owed will go on the
            // card too, so the customer is quoted the real figure before paying.
            var stillOwed = order.ApplyCcProcessingFee
                ? Math.Max(0m, notCoveredByOtherMethods - coveredByCard)
                : 0m;

            var feeBase = coveredByCard + stillOwed;

            order.CcProcessingFee = rate > 0 && feeBase > 0
                ? Round(feeBase * rate)
                : 0m;

            order.Total = Round(preFeeTotal + order.CcProcessingFee);
            order.AmountPaid = Round(order.Payments.Sum(p => p.Amount));
            order.BalanceDue = Round(order.Total - order.AmountPaid);
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Rounds to cents using banker's-free away-from-zero rounding, matching a paper till.
        /// </summary>
        /// <param name="value">Raw value</param>
        /// <returns>Value rounded to two decimal places.</returns>
        private static decimal Round(decimal value)
        {
            return Math.Round(value, 2, MidpointRounding.AwayFromZero);
        }

        #endregion

        #region Discounts

        /// <summary>
        /// A price with one discount taken off: a percent, or else a fixed amount. Never below zero.
        /// </summary>
        private static decimal Discounted(decimal price, decimal? percent, decimal? amount)
        {
            if (percent is > 0)
                price -= price * (Math.Min(percent.Value, 100m) / 100m);
            else if (amount is > 0)
                price -= amount.Value;
            return price < 0 ? 0 : price;
        }

        #endregion
    }
}
