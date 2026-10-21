using System.Text.Json;
using api.Models;

namespace api.Utils
{
    /// <summary>
    /// One selection made for an item on an order, e.g. Color: Gray. Kept on the order line as
    /// JSON so the sheet keeps printing it even if the catalog later changes.
    /// </summary>
    /// <param name="OptionId">The selection</param>
    /// <param name="Option">Its name when sold, e.g. "Color"</param>
    /// <param name="ChoiceId">The choice</param>
    /// <param name="Choice">Its name when sold, e.g. "Gray"</param>
    /// <param name="PriceAdjustment">What the choice added to the price, if anything</param>
    public record LineChoice(int OptionId, string Option, int ChoiceId, string Choice, decimal? PriceAdjustment);

    /// <summary>
    /// Selections (such as Color), the keys for stock kept per combination of counted choices,
    /// and catalog sales. Stock itself is per territory, in InventoryStocks (see InventoryRules):
    /// a size with no counted selections uses the empty key.
    /// </summary>
    public static class Choices
    {
        #region Private Fields

        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        #endregion

        #region Selections and keys

        /// <summary>
        /// The selections whose stock is counted separately, in key order. Only for a product
        /// that tracks inventory.
        /// </summary>
        /// <param name="product">Product with its options and choices loaded</param>
        /// <returns>The counted selections.</returns>
        public static List<ProductOption> CountedOptions(Product product) =>
            product.TrackInventory
                ? product.Options.Where(o => o.TracksStock && o.Choices.Any(c => c.IsActive)).OrderBy(o => o.Id).ToList()
                : [];

        /// <summary>
        /// The stock key for a set of choices: the counted ones, "selection:choice" by selection
        /// id, joined with "|". Empty when none are counted.
        /// </summary>
        /// <param name="chosen">The choices made</param>
        /// <param name="counted">The product's counted selections</param>
        /// <returns>The key.</returns>
        public static string KeyFor(IEnumerable<LineChoice> chosen, IEnumerable<ProductOption> counted)
        {
            var countedIds = counted.Select(o => o.Id).ToHashSet();
            return string.Join("|", chosen
                .Where(c => countedIds.Contains(c.OptionId))
                .OrderBy(c => c.OptionId)
                .Select(c => $"{c.OptionId}:{c.ChoiceId}"));
        }

        /// <summary>
        /// Every combination of active choices across the counted selections, with a label such
        /// as "Gray / Striped". A product with none gives just the empty key.
        /// </summary>
        /// <param name="product">Product with its options and choices loaded</param>
        /// <returns>Key and label for each combination, in catalog order.</returns>
        public static List<(string Key, string Label)> Combinations(Product product)
        {
            var counted = CountedOptions(product);
            if (counted.Count == 0)
                return [("", "")];

            // Listed in the order the selections are shown, but keyed by selection id.
            var shown = counted.OrderBy(o => o.SortOrder).ThenBy(o => o.Id).ToList();
            var combos = new List<List<(ProductOption Option, ProductOptionChoice Choice)>> { new() };
            foreach (var option in shown)
            {
                var choices = option.Choices.Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Id).ToList();
                combos = combos.SelectMany(combo => choices.Select(choice => combo.Append((option, choice)).ToList())).ToList();
            }

            return combos.Select(combo => (
                string.Join("|", combo.OrderBy(x => x.Option.Id).Select(x => $"{x.Option.Id}:{x.Choice.Id}")),
                string.Join(" / ", combo.Select(x => x.Choice.Name))
            )).ToList();
        }

        /// <summary>
        /// A label for a stock key, such as "Gray / Striped", naming retired choices too.
        /// </summary>
        /// <param name="product">Product with its options and choices loaded</param>
        /// <param name="key">The stock key</param>
        /// <returns>The label; empty for the empty key.</returns>
        public static string LabelFor(Product product, string key)
        {
            if (string.IsNullOrEmpty(key))
                return "";

            var parts = new List<(int Sort, int OptionId, string Name)>();
            foreach (var pair in key.Split('|', StringSplitOptions.RemoveEmptyEntries))
            {
                var bits = pair.Split(':');
                if (bits.Length != 2 || !int.TryParse(bits[0], out var optionId) || !int.TryParse(bits[1], out var choiceId))
                    continue;
                var option = product.Options.FirstOrDefault(o => o.Id == optionId);
                var choice = option?.Choices.FirstOrDefault(c => c.Id == choiceId);
                parts.Add((option?.SortOrder ?? int.MaxValue, optionId, choice?.Name ?? "(removed choice)"));
            }
            return string.Join(" / ", parts.OrderBy(p => p.Sort).ThenBy(p => p.OptionId).Select(p => p.Name));
        }

        /// <summary>
        /// Checks the selections a rep made for a product and turns them into line choices.
        /// Every required selection needs a choice; a selection whose stock is counted always does.
        /// </summary>
        /// <param name="product">Product with its options and choices loaded</param>
        /// <param name="picked">Selection id to choice id, as sent by the dashboard</param>
        /// <returns>The choices in display order, or a message for the rep.</returns>
        public static (List<LineChoice> Chosen, string? Problem) Resolve(Product product, IEnumerable<(int OptionId, int ChoiceId)>? picked)
        {
            var byOption = (picked ?? []).GroupBy(p => p.OptionId).ToDictionary(g => g.Key, g => g.Last().ChoiceId);
            var counted = CountedOptions(product).Select(o => o.Id).ToHashSet();
            var chosen = new List<LineChoice>();

            foreach (var option in product.Options.OrderBy(o => o.SortOrder).ThenBy(o => o.Id))
            {
                var active = option.Choices.Where(c => c.IsActive).ToList();
                if (active.Count == 0)
                    continue;

                if (!byOption.TryGetValue(option.Id, out var choiceId))
                {
                    if (option.IsRequired || counted.Contains(option.Id))
                        return ([], $"Choose a {option.Name.ToLowerInvariant()} for {product.Name}.");
                    continue;
                }

                var choice = active.FirstOrDefault(c => c.Id == choiceId);
                if (choice == null)
                    return ([], $"That {option.Name.ToLowerInvariant()} is no longer offered for {product.Name}. Pick another.");

                chosen.Add(new LineChoice(option.Id, option.Name, choice.Id, choice.Name, choice.PriceAdjustment));
            }

            if (byOption.Keys.Any(id => product.Options.All(o => o.Id != id)))
                return ([], $"A selection doesn't belong to {product.Name}.");

            return (chosen, null);
        }

        /// <summary>
        /// The selections as stored on a line.
        /// </summary>
        public static string? ToJson(List<LineChoice> chosen) =>
            chosen.Count == 0 ? null : JsonSerializer.Serialize(chosen, JsonOptions);

        /// <summary>
        /// A line's stored selections.
        /// </summary>
        public static List<LineChoice> FromJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return [];
            try
            {
                return JsonSerializer.Deserialize<List<LineChoice>>(json, JsonOptions) ?? [];
            }
            catch (JsonException)
            {
                return [];
            }
        }

        /// <summary>
        /// The selections as one line of text for the sheet, e.g. "Color: Gray, Pattern: Striped".
        /// </summary>
        public static string Describe(IEnumerable<LineChoice> chosen) =>
            string.Join(", ", chosen.Select(c => $"{c.Option}: {c.Choice}"));

        #endregion

        #region Sales

        /// <summary>
        /// The catalog sale on a size: its own when it has one, otherwise its product's. A percent
        /// wins over an amount; zero or less means no sale.
        /// </summary>
        /// <param name="variant">Size with its product loaded</param>
        /// <returns>Percent and amount off - at most one of them set.</returns>
        public static (decimal? Percent, decimal? Amount) SaleFor(ProductVariant variant)
        {
            var (percent, amount) = variant.HasOwnSale
                ? (variant.SaleDiscountPercent, variant.SaleDiscountAmount)
                : (variant.Product?.SaleDiscountPercent, variant.Product?.SaleDiscountAmount);

            return Clean(percent, amount);
        }

        /// <summary>
        /// The sale on a delivery option for a product: the product's own when it has one,
        /// otherwise the option's. A percent wins over an amount; zero or less means no sale.
        /// </summary>
        /// <param name="option">The delivery option</param>
        /// <param name="forProduct">The product's entry for the option, if it offers it</param>
        /// <returns>Percent and amount off - at most one of them set.</returns>
        public static (decimal? Percent, decimal? Amount) DeliverySaleFor(DeliveryOption option, ProductDeliveryOption? forProduct)
        {
            return forProduct is { HasOwnSale: true }
                ? Clean(forProduct.SaleDiscountPercent, forProduct.SaleDiscountAmount)
                : Clean(option.SaleDiscountPercent, option.SaleDiscountAmount);
        }

        private static (decimal? Percent, decimal? Amount) Clean(decimal? percent, decimal? amount)
        {
            if (percent is > 0)
                return (Math.Min(percent.Value, 100m), null);
            if (amount is > 0)
                return (null, amount);
            return (null, null);
        }

        #endregion
    }
}
