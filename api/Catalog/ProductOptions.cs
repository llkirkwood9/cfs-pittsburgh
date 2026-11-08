using api.Data;
using api.Dtos;
using api.Models;
using api.Utils;
using Microsoft.EntityFrameworkCore;

namespace api.Catalog
{
    /// <summary>
    /// A product's selections, such as Color, and their choices: checking them, adding them to a
    /// new product, and bringing an existing product's in line without losing the stock counted
    /// per choice.
    /// </summary>
    public static class ProductOptions
    {
        #region Public Methods

        /// <summary>
        /// Checks the selections in a save request: each needs a name and at least one choice,
        /// every choice a name, and names can't repeat.
        /// </summary>
        /// <param name="options">The selections sent, or null for none</param>
        /// <returns>An error message, or null.</returns>
        public static string? Validate(List<ProductOptionDto>? options)
        {
            if (options == null)
                return null;

            if (options.Count > CatalogRules.MaxOptions)
                return "A product can have at most 10 selections.";

            foreach (var option in options)
            {
                var name = option.Name?.Trim() ?? "";
                if (name.Length == 0)
                    return "Every selection needs a name, such as Color.";
                if (name.Length > CatalogRules.MaxOptionNameLength)
                    return "A selection's name can be at most 50 characters.";

                var choices = (option.Choices ?? []).Where(c => c.IsActive ?? true).ToList();
                if (choices.Count == 0)
                    return $"Give \"{name}\" at least one choice.";
                if (choices.Count > CatalogRules.MaxChoices)
                    return $"\"{name}\" can have at most 50 choices.";
                if (choices.Any(c => string.IsNullOrWhiteSpace(c.Name) || c.Name.Trim().Length > CatalogRules.MaxOptionNameLength))
                    return $"Every choice for \"{name}\" needs a name of up to 50 characters.";
                if (choices.GroupBy(c => c.Name!.Trim().ToLowerInvariant()).Any(g => g.Count() > 1))
                    return $"\"{name}\" lists the same choice twice.";
                if (choices.Any(c => c.PriceAdjustment is < -CatalogRules.MaxPriceAdjustment or > CatalogRules.MaxPriceAdjustment))
                    return $"A price change for \"{name}\" is too large.";
            }

            if (options.GroupBy(o => o.Name!.Trim().ToLowerInvariant()).Any(g => g.Count() > 1))
                return "Two selections have the same name.";

            return null;
        }

        /// <summary>
        /// Adds the selections from a save request to a new product.
        /// </summary>
        /// <param name="product">The new product</param>
        /// <param name="options">The selections, already validated</param>
        public static void AddTo(Product product, List<ProductOptionDto>? options)
        {
            foreach (var (dto, index) in (options ?? []).Select((o, i) => (o, i)))
            {
                var option = new ProductOption();
                CopyOption(option, dto, index);
                foreach (var (choiceDto, choiceIndex) in (dto.Choices ?? []).Where(c => c.IsActive ?? true).Select((c, i) => (c, i)))
                {
                    var choice = new ProductOptionChoice();
                    CopyChoice(choice, choiceDto, choiceIndex);
                    option.Choices.Add(choice);
                }
                product.Options.Add(option);
            }
        }

        /// <summary>
        /// Brings an existing product's selections in line with a save request. A choice taken
        /// out is retired rather than deleted, so stock and past sales still name it; a selection
        /// taken out is removed, along with any stock counted by its choices.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="product">The product, tracked, with its sizes and selections loaded</param>
        /// <param name="options">The selections, already validated</param>
        public static async Task ReplaceAsync(ApplicationDbContext db, Product product, List<ProductOptionDto> options)
        {
            var keep = options.Where(o => o.Id != null).Select(o => o.Id!.Value).ToHashSet();
            foreach (var gone in product.Options.Where(o => !keep.Contains(o.Id)).ToList())
            {
                await RemoveChoiceStockAsync(db, product, gone.Id);
                db.ProductOptions.Remove(gone);
                product.Options.Remove(gone);
            }

            foreach (var (dto, index) in options.Select((o, i) => (o, i)))
            {
                var option = dto.Id == null ? null : product.Options.FirstOrDefault(o => o.Id == dto.Id.Value);
                if (option == null)
                {
                    option = new ProductOption();
                    product.Options.Add(option);
                }

                // Counting stock per choice switched off: those counts no longer apply.
                if (option.Id != 0 && option.TracksStock && !(dto.TracksStock ?? false))
                    await RemoveChoiceStockAsync(db, product, option.Id);

                CopyOption(option, dto, index);

                var wanted = (dto.Choices ?? []).Where(c => c.IsActive ?? true).ToList();
                var keepChoices = wanted.Where(c => c.Id != null).Select(c => c.Id!.Value).ToHashSet();
                foreach (var retired in option.Choices.Where(c => c.Id != 0 && !keepChoices.Contains(c.Id)))
                    retired.IsActive = false;

                foreach (var (choiceDto, choiceIndex) in wanted.Select((c, i) => (c, i)))
                {
                    var choice = choiceDto.Id == null ? null : option.Choices.FirstOrDefault(c => c.Id == choiceDto.Id.Value);
                    if (choice == null)
                    {
                        choice = new ProductOptionChoice();
                        option.Choices.Add(choice);
                    }
                    CopyChoice(choice, choiceDto, choiceIndex);
                }
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Clears the stock counted for a selection's choices, across the product's sizes and in
        /// every territory.
        /// </summary>
        private static async Task RemoveChoiceStockAsync(ApplicationDbContext db, Product product, int optionId)
        {
            var variantIds = product.Variants.Select(v => v.Id).ToList();
            var rows = await db.InventoryStocks
                .Where(s => variantIds.Contains(s.ProductVariantId) && s.StockKey != "")
                .ToListAsync();
            db.InventoryStocks.RemoveRange(rows.Where(r => StockKeys.Mentions(r.StockKey, optionId)));
        }

        private static void CopyOption(ProductOption option, ProductOptionDto dto, int index)
        {
            option.Name = dto.Name!.Trim();
            option.SortOrder = index + 1;
            option.TracksStock = dto.TracksStock ?? false;
            // A selection that counts stock always needs a choice, or there is nothing to count against.
            option.IsRequired = option.TracksStock || (dto.IsRequired ?? true);
        }

        private static void CopyChoice(ProductOptionChoice choice, ProductOptionChoiceDto dto, int index)
        {
            choice.Name = dto.Name!.Trim();
            choice.PriceAdjustment = dto.PriceAdjustment is null or 0 ? null : dto.PriceAdjustment;
            choice.SortOrder = index + 1;
            choice.IsActive = true;
        }

        #endregion
    }
}
