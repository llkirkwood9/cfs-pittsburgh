using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Utils
{
    /// <summary>
    /// Copies catalog items from one territory's catalog into another's. Each territory has its own
    /// catalog, so a new territory can start from an existing one, a catalog editor can bring one
    /// item across, and the global items of older databases are split into every territory.
    /// Only the catalog is copied - never stock counts, which belong to each territory's cart.
    /// </summary>
    public static class CatalogCopy
    {
        #region Public Methods

        /// <summary>
        /// Copies a territory's whole catalog - delivery options, financing options and products,
        /// with their sizes, prices, sales, selections, bundles and delivery choices - into another
        /// territory. Stock counts are not copied.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="fromTerritoryId">The territory to copy from</param>
        /// <param name="toTerritoryId">The territory to copy into</param>
        /// <returns>How many products were copied.</returns>
        public static async Task<int> CopyCatalogAsync(ApplicationDbContext db, int fromTerritoryId, int toTerritoryId)
        {
            var batch = new Batch(toTerritoryId);

            var deliveryOptions = await db.DeliveryOptions.AsNoTracking()
                .Where(d => d.TerritoryId == fromTerritoryId)
                .OrderBy(d => d.SortOrder).ThenBy(d => d.Id)
                .ToListAsync();
            foreach (var option in deliveryOptions)
                batch.DeliveryOptions[option.Id] = Target<DeliveryOption>.New(db.DeliveryOptions.Add(CloneDeliveryOption(option, toTerritoryId)).Entity);

            var financeOptions = await db.FinanceOptions.AsNoTracking()
                .Where(f => f.TerritoryId == fromTerritoryId)
                .OrderBy(f => f.SortOrder).ThenBy(f => f.Id)
                .ToListAsync();
            foreach (var option in financeOptions)
                db.FinanceOptions.Add(CloneFinanceOption(option, toTerritoryId));

            var products = await LoadProducts(db).AsNoTracking()
                .Where(p => p.TerritoryId == fromTerritoryId)
                .ToListAsync();
            foreach (var product in products)
                db.Products.Add(CloneProduct(product, batch));

            // Bundles can only include items from their own catalog, all of which were just copied.
            ResolveComponents(batch, _ => null);

            await db.SaveChangesAsync();
            return products.Count;
        }

        /// <summary>
        /// Copies one product into another territory's catalog. The delivery options it offers are
        /// matched by name in that catalog, and copied there when it has none of that name; the items
        /// a bundle includes are matched by brand, name, size and configuration, and left out when
        /// that catalog doesn't sell them.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="productId">The product to copy</param>
        /// <param name="toTerritoryId">The territory to copy it into</param>
        /// <returns>The new product (saved), and notes on anything added or left out.</returns>
        public static async Task<(Product Copy, List<string> Notes)> CopyProductAsync(
            ApplicationDbContext db, int productId, int toTerritoryId)
        {
            var notes = new List<string>();
            var source = await LoadProducts(db).AsNoTracking().FirstAsync(p => p.Id == productId);
            var batch = new Batch(toTerritoryId);

            // The delivery options it offers, in the target catalog.
            var sourceOptionIds = source.DeliveryOptions.Select(d => d.DeliveryOptionId).Distinct().ToList();
            var sourceOptions = await db.DeliveryOptions.AsNoTracking().Where(d => sourceOptionIds.Contains(d.Id)).ToListAsync();
            var targetOptions = await db.DeliveryOptions.AsNoTracking().Where(d => d.TerritoryId == toTerritoryId).ToListAsync();
            var nextSort = targetOptions.Count == 0 ? 0 : targetOptions.Max(d => d.SortOrder) + 1;
            foreach (var option in sourceOptions)
            {
                var match = targetOptions.FirstOrDefault(d => Same(d.Name, option.Name));
                if (match != null)
                {
                    batch.DeliveryOptions[option.Id] = Target<DeliveryOption>.Existing(match.Id);
                    continue;
                }

                var copy = CloneDeliveryOption(option, toTerritoryId);
                copy.SortOrder = nextSort++;
                batch.DeliveryOptions[option.Id] = Target<DeliveryOption>.New(db.DeliveryOptions.Add(copy).Entity);
                notes.Add($"The delivery option \"{option.Name}\" was added too.");
            }

            var product = CloneProduct(source, batch);
            db.Products.Add(product);

            // What its bundles include, in the target catalog.
            var wanted = batch.PendingComponents.Select(p => p.Source.ComponentVariantId).Distinct().ToList();
            var included = await db.ProductVariants.AsNoTracking()
                .Include(v => v.Product)
                .Where(v => wanted.Contains(v.Id))
                .ToListAsync();
            var candidates = await db.ProductVariants.AsNoTracking()
                .Include(v => v.Product)
                .Where(v => v.Product!.TerritoryId == toTerritoryId)
                .ToListAsync();
            ResolveComponents(batch, sourceVariantId =>
            {
                var from = included.FirstOrDefault(v => v.Id == sourceVariantId);
                if (from?.Product == null)
                    return null;
                var match = candidates.FirstOrDefault(v =>
                    Same(v.Product!.Brand, from.Product.Brand) && Same(v.Product.Name, from.Product.Name)
                    && Same(v.Size, from.Size) && Same(v.Configuration ?? string.Empty, from.Configuration ?? string.Empty));
                if (match == null)
                {
                    var label = $"{from.Product.Name} {from.Size}{(string.IsNullOrEmpty(from.Configuration) ? "" : " / " + from.Configuration)}".Trim();
                    notes.Add($"{label} isn't in that catalog, so it was left out of the bundle.");
                }
                return match?.Id;
            });

            await db.SaveChangesAsync();
            return (product, notes.Distinct().ToList());
        }

        /// <summary>
        /// Splits the global catalog of a database from before every territory had its own: the
        /// first territory keeps the global items themselves, and every other territory gets its
        /// own copy of each, with its stock counts, stock history and past sales moved onto its
        /// copy. Items a territory added itself are pointed at its copies of the global delivery
        /// options and bundled items. Does nothing when there are no global items.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="log">Writes what was done</param>
        /// <returns>True when anything was split.</returns>
        public static async Task<bool> SplitGlobalItemsAsync(ApplicationDbContext db, Action<string> log)
        {
            var anyGlobal = await db.Products.AnyAsync(p => p.TerritoryId == null)
                            || await db.DeliveryOptions.AnyAsync(d => d.TerritoryId == null)
                            || await db.FinanceOptions.AnyAsync(f => f.TerritoryId == null);
            if (!anyGlobal)
                return false;

            await using var transaction = await db.Database.BeginTransactionAsync();

            var territories = await db.Territories.OrderBy(t => t.Id).ToListAsync();
            if (territories.Count == 0)
            {
                // Global items with nowhere to go: give them a first territory.
                var first = new Territory { Name = "Pittsburgh" };
                db.Territories.Add(first);
                await db.SaveChangesAsync();
                territories.Add(first);
            }

            var globalOptions = await db.DeliveryOptions.AsNoTracking().Where(d => d.TerritoryId == null).ToListAsync();
            var globalFinance = await db.FinanceOptions.AsNoTracking().Where(f => f.TerritoryId == null).ToListAsync();
            var globalProducts = await LoadProducts(db).AsNoTracking().Where(p => p.TerritoryId == null).ToListAsync();
            var globalVariantIds = globalProducts.SelectMany(p => p.Variants).Select(v => v.Id).ToHashSet();
            var globalOptionIds = globalOptions.Select(d => d.Id).ToHashSet();

            foreach (var territory in territories.Skip(1))
            {
                var batch = new Batch(territory.Id);
                foreach (var option in globalOptions)
                    batch.DeliveryOptions[option.Id] = Target<DeliveryOption>.New(db.DeliveryOptions.Add(CloneDeliveryOption(option, territory.Id)).Entity);
                foreach (var option in globalFinance)
                    db.FinanceOptions.Add(CloneFinanceOption(option, territory.Id));
                foreach (var product in globalProducts)
                    db.Products.Add(CloneProduct(product, batch));
                ResolveComponents(batch, _ => null);

                // The territory's own items offered global delivery options and could include global
                // items: point them at its copies.
                var ownOffers = await db.ProductDeliveryOptions
                    .Where(d => d.Product!.TerritoryId == territory.Id && globalOptionIds.Contains(d.DeliveryOptionId))
                    .ToListAsync();
                foreach (var offer in ownOffers)
                    offer.DeliveryOption = batch.DeliveryOptions[offer.DeliveryOptionId].Entity;

                var ownComponents = await db.ProductVariantComponents
                    .Where(c => c.BundleVariant!.Product!.TerritoryId == territory.Id && globalVariantIds.Contains(c.ComponentVariantId))
                    .ToListAsync();
                foreach (var component in ownComponents)
                    component.ComponentVariant = batch.Variants[component.ComponentVariantId].Entity;

                await db.SaveChangesAsync();

                // Now the copies have ids: move this territory's stock, its history and its sales onto them.
                var variantIds = batch.Variants.ToDictionary(v => v.Key, v => v.Value.Entity!.Id);
                var optionIds = batch.Options.ToDictionary(o => o.Key, o => o.Value.Id);
                var choiceIds = batch.Choices.ToDictionary(c => c.Key, c => c.Value.Id);
                var deliveryIds = batch.DeliveryOptions.ToDictionary(d => d.Key, d => d.Value.Entity!.Id);

                var stock = await db.InventoryStocks
                    .Where(s => s.TerritoryId == territory.Id && globalVariantIds.Contains(s.ProductVariantId))
                    .ToListAsync();
                foreach (var row in stock)
                {
                    row.ProductVariantId = variantIds[row.ProductVariantId];
                    row.StockKey = RemapKey(row.StockKey, optionIds, choiceIds);
                }

                var history = await db.InventoryAdjustments
                    .Where(a => a.TerritoryId == territory.Id && globalVariantIds.Contains(a.ProductVariantId))
                    .ToListAsync();
                foreach (var row in history)
                {
                    row.ProductVariantId = variantIds[row.ProductVariantId];
                    row.StockKey = RemapKey(row.StockKey, optionIds, choiceIds);
                }

                var lines = await db.OrderLines
                    .Where(l => l.Order!.Event!.TerritoryId == territory.Id
                                && ((l.ProductVariantId != null && globalVariantIds.Contains(l.ProductVariantId.Value))
                                    || (l.DeliveryOptionId != null && globalOptionIds.Contains(l.DeliveryOptionId.Value))))
                    .ToListAsync();
                foreach (var line in lines)
                {
                    if (line.ProductVariantId is { } variantId && variantIds.TryGetValue(variantId, out var newVariant))
                    {
                        line.ProductVariantId = newVariant;
                        line.StockKey = RemapKey(line.StockKey, optionIds, choiceIds);
                        line.ChoicesJson = RemapChoices(line.ChoicesJson, optionIds, choiceIds);
                    }
                    if (line.DeliveryOptionId is { } deliveryId && deliveryIds.TryGetValue(deliveryId, out var newDelivery))
                        line.DeliveryOptionId = newDelivery;
                }

                await db.SaveChangesAsync();
                log($"Gave {territory.Name} its own copy of {globalProducts.Count} global products, {globalOptions.Count} delivery options and {globalFinance.Count} financing options.");
            }

            // The first territory keeps the originals.
            var firstId = territories[0].Id;
            await db.Products.Where(p => p.TerritoryId == null).ExecuteUpdateAsync(u => u.SetProperty(p => p.TerritoryId, firstId));
            await db.DeliveryOptions.Where(d => d.TerritoryId == null).ExecuteUpdateAsync(u => u.SetProperty(d => d.TerritoryId, firstId));
            await db.FinanceOptions.Where(f => f.TerritoryId == null).ExecuteUpdateAsync(u => u.SetProperty(f => f.TerritoryId, firstId));
            log($"{territories[0].Name} kept the global items themselves; every territory now has its own catalog.");

            await transaction.CommitAsync();
            return true;
        }

        #endregion

        #region Private Types

        /// <summary>
        /// Where a copied reference points: a new entity in this batch, or something already saved.
        /// </summary>
        private sealed record Target<T>(int Id, T? Entity) where T : class
        {
            public static Target<T> New(T entity) => new(0, entity);
            public static Target<T> Existing(int id) => new(id, null);
        }

        /// <summary>
        /// What one copy has made so far, by the id of what it was copied from.
        /// </summary>
        private sealed class Batch(int territoryId)
        {
            public int TerritoryId { get; } = territoryId;
            public Dictionary<int, Target<DeliveryOption>> DeliveryOptions { get; } = new();
            public Dictionary<int, Target<ProductVariant>> Variants { get; } = new();
            public Dictionary<int, ProductOption> Options { get; } = new();
            public Dictionary<int, ProductOptionChoice> Choices { get; } = new();
            public List<(ProductVariant Copy, ProductVariantComponent Source)> PendingComponents { get; } = new();
        }

        #endregion

        #region Private Methods

        private static IQueryable<Product> LoadProducts(ApplicationDbContext db) =>
            db.Products
                .Include(p => p.Variants).ThenInclude(v => v.Components)
                .Include(p => p.Options).ThenInclude(o => o.Choices)
                .Include(p => p.DeliveryOptions)
                .AsSplitQuery();

        private static DeliveryOption CloneDeliveryOption(DeliveryOption source, int territoryId) => new()
        {
            TerritoryId = territoryId,
            Name = source.Name,
            Price = source.Price,
            IsTaxable = source.IsTaxable,
            IsTakeWith = source.IsTakeWith,
            ShowOnSalesSheet = source.ShowOnSalesSheet,
            SortOrder = source.SortOrder,
            IsActive = source.IsActive,
            SaleDiscountPercent = source.SaleDiscountPercent,
            SaleDiscountAmount = source.SaleDiscountAmount,
        };

        private static FinanceOption CloneFinanceOption(FinanceOption source, int territoryId) => new()
        {
            TerritoryId = territoryId,
            Name = source.Name,
            SortOrder = source.SortOrder,
            IsActive = source.IsActive,
        };

        /// <summary>
        /// A new product like the source, in the batch's territory. Its delivery choices point at the
        /// batch's delivery options (left out when there's none); bundle contents wait for
        /// ResolveComponents, since what they point at may be copied later in the batch.
        /// </summary>
        private static Product CloneProduct(Product source, Batch batch)
        {
            var copy = new Product
            {
                TerritoryId = batch.TerritoryId,
                Name = source.Name,
                Brand = source.Brand,
                Category = source.Category,
                Notes = source.Notes,
                SortOrder = source.SortOrder,
                IsActive = source.IsActive,
                TrackInventory = source.TrackInventory,
                HasWarranty = source.HasWarranty,
                WarrantyLength = source.WarrantyLength,
                SaleDiscountPercent = source.SaleDiscountPercent,
                SaleDiscountAmount = source.SaleDiscountAmount,
            };

            foreach (var variant in source.Variants.OrderBy(v => v.SortOrder).ThenBy(v => v.Id))
            {
                var newVariant = new ProductVariant
                {
                    Size = variant.Size,
                    Configuration = variant.Configuration,
                    Price = variant.Price,
                    SortOrder = variant.SortOrder,
                    IsActive = variant.IsActive,
                    ExcludeFromInventory = variant.ExcludeFromInventory,
                    Notes = variant.Notes,
                    HasOwnSale = variant.HasOwnSale,
                    SaleDiscountPercent = variant.SaleDiscountPercent,
                    SaleDiscountAmount = variant.SaleDiscountAmount,
                };
                copy.Variants.Add(newVariant);
                batch.Variants[variant.Id] = Target<ProductVariant>.New(newVariant);
                foreach (var component in variant.Components)
                    batch.PendingComponents.Add((newVariant, component));
            }

            foreach (var option in source.Options.OrderBy(o => o.SortOrder).ThenBy(o => o.Id))
            {
                var newOption = new ProductOption
                {
                    Name = option.Name,
                    SortOrder = option.SortOrder,
                    IsRequired = option.IsRequired,
                    TracksStock = option.TracksStock,
                };
                foreach (var choice in option.Choices.OrderBy(c => c.SortOrder).ThenBy(c => c.Id))
                {
                    var newChoice = new ProductOptionChoice
                    {
                        Name = choice.Name,
                        PriceAdjustment = choice.PriceAdjustment,
                        SortOrder = choice.SortOrder,
                        IsActive = choice.IsActive,
                    };
                    newOption.Choices.Add(newChoice);
                    batch.Choices[choice.Id] = newChoice;
                }
                copy.Options.Add(newOption);
                batch.Options[option.Id] = newOption;
            }

            foreach (var offer in source.DeliveryOptions)
            {
                if (!batch.DeliveryOptions.TryGetValue(offer.DeliveryOptionId, out var target))
                    continue;
                var newOffer = new ProductDeliveryOption
                {
                    PriceOverride = offer.PriceOverride,
                    IsDefault = offer.IsDefault,
                    HasOwnSale = offer.HasOwnSale,
                    SaleDiscountPercent = offer.SaleDiscountPercent,
                    SaleDiscountAmount = offer.SaleDiscountAmount,
                };
                if (target.Entity != null)
                    newOffer.DeliveryOption = target.Entity;
                else
                    newOffer.DeliveryOptionId = target.Id;
                copy.DeliveryOptions.Add(newOffer);
            }

            return copy;
        }

        /// <summary>
        /// Fills in the bundle contents of the batch's copies: an item copied in the same batch, or
        /// else whatever the fallback finds in the target catalog. Left out when neither has it.
        /// </summary>
        /// <param name="batch">The copy</param>
        /// <param name="fallback">Finds an existing variant id in the target catalog for a source variant id</param>
        private static void ResolveComponents(Batch batch, Func<int, int?> fallback)
        {
            foreach (var (copy, source) in batch.PendingComponents)
            {
                var component = new ProductVariantComponent { Quantity = source.Quantity };
                if (batch.Variants.TryGetValue(source.ComponentVariantId, out var target) && target.Entity != null)
                    component.ComponentVariant = target.Entity;
                else if (fallback(source.ComponentVariantId) is { } existing)
                    component.ComponentVariantId = existing;
                else
                    continue;
                copy.Components.Add(component);
            }
            batch.PendingComponents.Clear();
        }

        /// <summary>
        /// A stock key ("selection:choice|...") with the copied selections' and choices' ids, still
        /// in selection id order.
        /// </summary>
        private static string RemapKey(string key, Dictionary<int, int> optionIds, Dictionary<int, int> choiceIds)
        {
            if (string.IsNullOrEmpty(key))
                return key;

            var parts = new List<(int Option, int Choice)>();
            foreach (var part in key.Split('|'))
            {
                var pair = part.Split(':');
                if (pair.Length != 2 || !int.TryParse(pair[0], out var option) || !int.TryParse(pair[1], out var choice))
                    return key;
                parts.Add((optionIds.GetValueOrDefault(option, option), choiceIds.GetValueOrDefault(choice, choice)));
            }
            return string.Join("|", parts.OrderBy(p => p.Option).Select(p => $"{p.Option}:{p.Choice}"));
        }

        /// <summary>
        /// A line's stored selections with the copied selections' and choices' ids.
        /// </summary>
        private static string? RemapChoices(string? json, Dictionary<int, int> optionIds, Dictionary<int, int> choiceIds)
        {
            var chosen = Choices.FromJson(json);
            if (chosen.Count == 0)
                return json;
            return Choices.ToJson(chosen
                .Select(c => c with
                {
                    OptionId = optionIds.GetValueOrDefault(c.OptionId, c.OptionId),
                    ChoiceId = choiceIds.GetValueOrDefault(c.ChoiceId, c.ChoiceId),
                })
                .ToList());
        }

        private static bool Same(string? a, string? b) =>
            string.Equals(a?.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);

        #endregion
    }
}
