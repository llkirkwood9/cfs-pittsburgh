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
        /// Recalculates a single line's sale price and total from its unit price and discount.
        /// A percent discount wins when both are supplied.
        /// </summary>
        /// <param name="line">Line to recalculate in place</param>
        public static void RecalculateLine(OrderLine line)
        {
            var unit = line.UnitPrice;

            if (line.DiscountPercent is > 0)
                unit -= unit * (line.DiscountPercent.Value / 100m);
            else if (line.DiscountAmount is > 0)
                unit -= line.DiscountAmount.Value;

            if (unit < 0)
                unit = 0;

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
            foreach (var line in order.Lines)
                RecalculateLine(line);

            order.Subtotal = Round(order.Lines.Sum(l => l.LineTotal));

            var taxableBase = order.Lines.Where(l => l.IsTaxable).Sum(l => l.LineTotal);
            order.TaxAmount = Round(taxableBase * order.SalesTaxRate);

            // The card fee is charged on the card-funded portion only, matching the paper sheet
            // where the fee box is left blank unless the customer pays by card.
            var cardPaid = order.Payments
                .Where(p => p.Method == PaymentMethod.VisaMc)
                .Sum(p => p.Amount);

            var preFeeTotal = Round(order.Subtotal + order.TaxAmount);

            // Once a card payment has actually been keyed in, that amount decides the fee. Before
            // then, picking Visa/MC at the checkout table is enough to put the fee on the total,
            // so the customer is quoted the real figure rather than being surprised by it after
            // the payment is recorded. The fee is capped at the pre-fee total either way, so a
            // card payment that already includes the fee does not compound it.
            var feeBase = cardPaid > 0
                ? Math.Min(cardPaid, preFeeTotal)
                : order.ApplyCcProcessingFee
                    ? preFeeTotal
                    : 0m;

            order.CcProcessingFee = order.CcProcessingFeeRate > 0 && feeBase > 0
                ? Round(feeBase * order.CcProcessingFeeRate)
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
    }
}
