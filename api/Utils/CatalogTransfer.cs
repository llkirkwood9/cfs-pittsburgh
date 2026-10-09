using api.Controllers;
using api.Data;
using api.Dtos;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Utils
{
    /// <summary>
    /// Thrown when a catalog file can't be restored; the message is meant for the system admin.
    /// </summary>
    public class CatalogImportException(string message) : Exception(message);

    /// <summary>
    /// Saves the catalog to a file and restores it again. Products are matched by territory, brand
    /// and name, sizes by size and configuration, and delivery options (within their territory),
    /// selections and choices by name, so a restore keeps the ids - and so the stock counts and
    /// past sales - of anything it matches. Territories are matched by name; an item whose
    /// territory isn't here comes in as a global one, with a warning.
    /// A restore either brings matching items in line with the file and adds the rest, leaving
    /// anything not in the file alone, or clears the catalog first and rebuilds it from the file.
    /// </summary>
    public static class CatalogTransfer
    {
        #region Private Types

        /// <summary>A product as restored: its entry in the file, the product, and each size's pairing.</summary>
        private record Restored(CatalogProductDto File, Product Product, List<(CatalogVariantDto File, ProductVariant Variant)> Variants);

        #endregion

        #region Public Fields

        /// <summary>
        /// The Format value every catalog file carries
        /// </summary>
        public const string FileFormat = "cfs-catalog";

        /// <summary>
        /// The layout version this code writes and reads
        /// </summary>
        public const int FileVersion = 1;

        #endregion

        #region Public Methods

        /// <summary>
        /// The whole catalog as a file: every product, archived ones included, the delivery options
        /// list and the financing options.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <returns>The file's contents.</returns>
        public static async Task<CatalogFileDto> ExportAsync(ApplicationDbContext db)
        {
            var deliveryOptions = await db.DeliveryOptions
                .AsNoTracking()
                .Include(d => d.Territory)
                .OrderBy(d => d.SortOrder)
                .ThenBy(d => d.Name)
                .ThenBy(d => d.Id)
                .ToListAsync();

            var financeOptions = await db.FinanceOptions
                .AsNoTracking()
                .Include(f => f.Territory)
                .OrderBy(f => f.TerritoryId != null)
                .ThenBy(f => f.Territory!.Name)
                .ThenBy(f => f.SortOrder)
                .ThenBy(f => f.Name)
                .ToListAsync();

            var products = await db.Products
                .AsNoTracking()
                .Include(p => p.Territory)
                .Include(p => p.Variants)
                .ThenInclude(v => v.Components)
                .ThenInclude(c => c.ComponentVariant)
                .ThenInclude(cv => cv!.Product)
                .ThenInclude(cp => cp!.Territory)
                .Include(p => p.DeliveryOptions)
                .ThenInclude(d => d.DeliveryOption)
                .Include(p => p.Options)
                .ThenInclude(o => o.Choices)
                .AsSplitQuery()
                .OrderBy(p => p.Category)
                .ThenBy(p => p.SortOrder)
                .ThenBy(p => p.Name)
                .ThenBy(p => p.Id)
                .ToListAsync();

            return new CatalogFileDto
            {
                Format = FileFormat,
                Version = FileVersion,
                ExportedAt = DateTime.UtcNow,
                FinanceOptions = financeOptions.Select(f => new CatalogFinanceOptionDto
                {
                    Name = f.Name,
                    IsActive = f.IsActive,
                    Territory = f.Territory?.Name,
                }).ToList(),
                DeliveryOptions = deliveryOptions.Select(d => new CatalogDeliveryOptionDto
                {
                    Name = d.Name,
                    Price = d.Price,
                    IsTaxable = d.IsTaxable,
                    IsTakeWith = d.IsTakeWith,
                    ShowOnSalesSheet = d.ShowOnSalesSheet,
                    IsActive = d.IsActive,
                    Territory = d.Territory?.Name,
                    SaleDiscountPercent = d.SaleDiscountPercent,
                    SaleDiscountAmount = d.SaleDiscountAmount,
                }).ToList(),
                Products = products.Select(p => new CatalogProductDto
                {
                    Territory = p.Territory?.Name,
                    Name = p.Name,
                    Brand = p.Brand,
                    Category = p.Category.ToString(),
                    Notes = p.Notes,
                    SortOrder = p.SortOrder,
                    IsActive = p.IsActive,
                    TrackInventory = p.TrackInventory,
                    SaleDiscountPercent = p.SaleDiscountPercent,
                    SaleDiscountAmount = p.SaleDiscountAmount,
                    Variants = p.Variants
                        .OrderBy(v => v.SortOrder)
                        .ThenBy(v => v.Id)
                        .Select(v => new CatalogVariantDto
                        {
                            Size = v.Size,
                            Configuration = v.Configuration,
                            Price = v.Price,
                            IsActive = v.IsActive,
                            ExcludeFromInventory = v.ExcludeFromInventory ? true : null,
                            HasOwnSale = v.HasOwnSale,
                            SaleDiscountPercent = v.SaleDiscountPercent,
                            SaleDiscountAmount = v.SaleDiscountAmount,
                            Includes = v.Components.Count == 0
                                ? null
                                : v.Components
                                    .Where(c => c.ComponentVariant?.Product != null)
                                    .Select(c => new CatalogComponentDto
                                    {
                                        Territory = c.ComponentVariant!.Product!.Territory?.Name,
                                        Brand = c.ComponentVariant.Product.Brand,
                                        Name = c.ComponentVariant.Product.Name,
                                        Size = c.ComponentVariant.Size,
                                        Configuration = c.ComponentVariant.Configuration,
                                        Quantity = c.Quantity,
                                    })
                                    .ToList(),
                        })
                        .ToList(),
                    DeliveryOptions = p.DeliveryOptions
                        .Where(d => d.DeliveryOption != null)
                        .OrderBy(d => d.DeliveryOption!.SortOrder)
                        .Select(d => new CatalogProductDeliveryDto
                        {
                            Name = d.DeliveryOption!.Name,
                            PriceOverride = d.PriceOverride,
                            IsDefault = d.IsDefault,
                            HasOwnSale = d.HasOwnSale,
                            SaleDiscountPercent = d.SaleDiscountPercent,
                            SaleDiscountAmount = d.SaleDiscountAmount,
                        })
                        .ToList(),
                    Options = p.Options.Count == 0
                        ? null
                        : p.Options
                            .OrderBy(o => o.SortOrder)
                            .ThenBy(o => o.Id)
                            .Select(o => new CatalogOptionDto
                            {
                                Name = o.Name,
                                IsRequired = o.IsRequired,
                                TracksStock = o.TracksStock,
                                Choices = o.Choices
                                    .Where(c => c.IsActive)
                                    .OrderBy(c => c.SortOrder)
                                    .ThenBy(c => c.Id)
                                    .Select(c => new CatalogChoiceDto { Name = c.Name, PriceAdjustment = c.PriceAdjustment })
                                    .ToList(),
                            })
                            .ToList(),
                }).ToList(),
            };
        }

        /// <summary>
        /// Restores a catalog file. The file is checked in full before anything changes, and the
        /// restore happens in one transaction, so it either all goes in or none of it does.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="file">The file's contents</param>
        /// <param name="replace">True to clear the catalog first - every product and delivery
        /// option, sold or not, is deleted permanently</param>
        /// <returns>What changed, with anything that couldn't be brought in.</returns>
        /// <exception cref="CatalogImportException">The file can't be restored.</exception>
        public static async Task<CatalogImportResultDto> ImportAsync(ApplicationDbContext db, CatalogFileDto file, bool replace)
        {
            var problem = Validate(file);
            if (problem != null)
                throw new CatalogImportException(problem);

            var result = new CatalogImportResultDto();
            await using var transaction = await db.Database.BeginTransactionAsync();

            if (replace)
                (result.ProductsRemoved, result.DeliveryOptionsRemoved) = await PermanentDelete.CatalogAsync(db);

            var territories = await db.Territories.AsNoTracking().ToListAsync();
            var deliveryOptions = await ImportDeliveryOptionsAsync(db, file.DeliveryOptions ?? [], territories, result);

            // A file from before financing options were exported has none, and leaves them alone.
            if (file.FinanceOptions != null)
                await ImportFinanceOptionsAsync(db, file.FinanceOptions, replace, territories, result);

            var existing = await db.Products
                .Include(p => p.Variants)
                .ThenInclude(v => v.Components)
                .Include(p => p.DeliveryOptions)
                .Include(p => p.Options)
                .ThenInclude(o => o.Choices)
                .AsSplitQuery()
                .ToListAsync();

            // Two products can share a brand and name (an archived one and its replacement, say), so
            // each existing product is matched at most once, in order, preferring one that is offered
            // (or not) just as the file says.
            var unmatched = existing.ToList();
            var imported = new List<Restored>();
            foreach (var dto in file.Products ?? [])
            {
                var territoryId = TerritoryFor(territories, dto.Territory, result);
                var product = unmatched
                    .Where(p => p.TerritoryId == territoryId && Same(p.Brand, dto.Brand) && Same(p.Name, dto.Name))
                    .OrderByDescending(p => p.IsActive == (dto.IsActive ?? true))
                    .ThenBy(p => p.Id)
                    .FirstOrDefault();

                if (product == null)
                {
                    product = new Product();
                    db.Products.Add(product);
                    result.ProductsAdded++;
                }
                else
                {
                    unmatched.Remove(product);
                    result.ProductsUpdated++;
                }

                product.TerritoryId = territoryId;
                var variants = await ApplyProductAsync(db, product, dto, deliveryOptions, result);
                imported.Add(new Restored(dto, product, variants));
            }

            await db.SaveChangesAsync();

            // Bundles last, once every product they can name is in place.
            ApplyBundles(existing.Concat(imported.Select(i => i.Product)).Distinct().ToList(), imported, territories, result);
            await db.SaveChangesAsync();

            await transaction.CommitAsync();
            return result;
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Checks a whole file, so a restore never stops half way.
        /// </summary>
        /// <returns>A message for the system admin, or null when the file is fine.</returns>
        private static string? Validate(CatalogFileDto file)
        {
            if (file.Format != FileFormat)
                return "This isn't a catalog file. Choose a file made with Export catalog.";
            if (file.Version is null or < 1)
                return "This catalog file is missing its version.";
            if (file.Version > FileVersion)
                return "This catalog file was made by a newer version of the app. Update the app first.";

            var deliveryOptions = file.DeliveryOptions ?? [];
            var products = file.Products ?? [];
            var financeOptions = file.FinanceOptions ?? [];
            if (deliveryOptions.Count > 500 || products.Count > 5000 || financeOptions.Count > 500)
                return "This catalog file is too large.";

            if (financeOptions.Any(f => (f.Name?.Trim().Length ?? 0) is 0 or > 100))
                return "Every financing option needs a name of up to 100 characters.";
            var repeated = financeOptions.GroupBy(f => (Key(f.Territory), Key(f.Name))).FirstOrDefault(g => g.Count() > 1);
            if (repeated != null)
                return $"The financing option \"{repeated.First().Name!.Trim()}\" is in the file more than once.";

            foreach (var d in deliveryOptions)
            {
                var name = d.Name?.Trim() ?? "";
                if (name.Length is 0 or > 100)
                    return "Every delivery option needs a name of up to 100 characters.";
                if (d.Price is null or < 0 or > 100_000)
                    return $"Delivery option \"{name}\": the price must be 0 or more.";
                if (d.SaleDiscountPercent is < 0 or > 100 || d.SaleDiscountAmount < 0)
                    return $"Delivery option \"{name}\": a sale must be 0 to 100 percent, or an amount of 0 or more.";
            }

            foreach (var p in products)
            {
                var name = p.Name?.Trim() ?? "";
                var brand = p.Brand?.Trim() ?? "";
                var label = brand.Length == 0 ? name : $"{brand} {name}";
                if (name.Length is 0 or > 150)
                    return "Every product needs a name of up to 150 characters.";
                if (brand.Length > 100)
                    return $"{label}: the brand can be at most 100 characters.";
                if (!Enum.TryParse<ProductCategory>(p.Category, true, out _))
                    return $"{label}: \"{p.Category}\" isn't a category.";
                if (p.Notes is { Length: > 500 })
                    return $"{label}: the notes can be at most 500 characters.";

                var sales = new List<(decimal? Percent, decimal? Amount)> { (p.SaleDiscountPercent, p.SaleDiscountAmount) };
                sales.AddRange((p.Variants ?? []).Select(v => (v.SaleDiscountPercent, v.SaleDiscountAmount)));
                sales.AddRange((p.DeliveryOptions ?? []).Select(d => (d.SaleDiscountPercent, d.SaleDiscountAmount)));
                if (sales.Any(s => s.Percent is < 0 or > 100 || s.Amount < 0))
                    return $"{label}: a sale must be 0 to 100 percent, or an amount of 0 or more.";

                var variants = p.Variants ?? [];
                if (variants.Count > 200)
                    return $"{label} has too many sizes.";
                if (variants.Any(v => (v.Size?.Trim().Length ?? 0) > 50 || (v.Configuration?.Trim().Length ?? 0) > 100))
                    return $"{label}: a size can be at most 50 characters and a configuration 100.";
                if (variants.Any(v => v.Price is < 0 or > 1_000_000))
                    return $"{label}: prices must be 0 or more.";
                if (variants.SelectMany(v => v.Includes ?? []).Any(c => c.Quantity is < 1 or > 20))
                    return $"{label}: an included item's quantity must be between 1 and 20.";

                var optionError = ProductController.ValidateOptions(ToOptionDtos(p.Options, null));
                if (optionError != null)
                    return $"{label}: {optionError}";
            }
            return null;
        }

        /// <summary>
        /// Brings the delivery options list in line with the file: a match by territory and name
        /// is updated and anything new is added. Options not in the file are left as they are.
        /// </summary>
        /// <returns>Every delivery option.</returns>
        private static async Task<List<DeliveryOption>> ImportDeliveryOptionsAsync(
            ApplicationDbContext db, List<CatalogDeliveryOptionDto> options, List<Territory> territories, CatalogImportResultDto result)
        {
            var all = await db.DeliveryOptions.OrderBy(d => d.Id).ToListAsync();
            var unmatched = all.ToList();

            foreach (var (dto, index) in options.Select((d, i) => (d, i)))
            {
                var territoryId = TerritoryFor(territories, dto.Territory, result);
                var option = unmatched
                    .Where(d => d.TerritoryId == territoryId && Same(d.Name, dto.Name))
                    .OrderByDescending(d => d.IsActive == (dto.IsActive ?? true))
                    .FirstOrDefault();
                if (option == null)
                {
                    // A name can't repeat among the options any one territory sees: a global one
                    // against any territory's, or two in the same territory.
                    if (all.Any(d => Same(d.Name, dto.Name) && (territoryId == null || d.TerritoryId == null || d.TerritoryId == territoryId)))
                    {
                        result.Warnings.Add($"The delivery option \"{dto.Name!.Trim()}\" has the same name as one already offered alongside it, so it was left out.");
                        continue;
                    }

                    option = new DeliveryOption();
                    db.DeliveryOptions.Add(option);
                    all.Add(option);
                    result.DeliveryOptionsAdded++;
                }
                else
                {
                    unmatched.Remove(option);
                    result.DeliveryOptionsUpdated++;
                }

                option.TerritoryId = territoryId;
                option.Name = dto.Name!.Trim();
                option.Price = dto.Price ?? 0;
                option.IsTaxable = dto.IsTaxable ?? true;
                option.IsTakeWith = dto.IsTakeWith ?? false;
                option.ShowOnSalesSheet = dto.ShowOnSalesSheet ?? true;
                option.IsActive = dto.IsActive ?? true;
                option.SortOrder = index + 1;
                (option.SaleDiscountPercent, option.SaleDiscountAmount) =
                    ProductController.CleanSale(dto.SaleDiscountPercent, dto.SaleDiscountAmount);
            }

            await db.SaveChangesAsync();
            return all;
        }

        /// <summary>
        /// Brings the financing options in line with the file, in the file's order within each list
        /// (global, or a territory's own): a match by territory and name is updated and anything new
        /// is added. A clear and replace deletes every territory's first; otherwise options not in
        /// the file are kept, after the file's ones in their list. Sales record the option by name,
        /// so deleting one never changes a past sale.
        /// </summary>
        private static async Task ImportFinanceOptionsAsync(
            ApplicationDbContext db, List<CatalogFinanceOptionDto> options, bool replace,
            List<Territory> territories, CatalogImportResultDto result)
        {
            if (replace)
                result.FinanceOptionsRemoved = await db.FinanceOptions.ExecuteDeleteAsync();

            var all = await db.FinanceOptions.OrderBy(f => f.SortOrder).ThenBy(f => f.Name).ToListAsync();
            var unmatched = all.ToList();
            var next = new Dictionary<int, int>();
            int NextIn(int? territoryId)
            {
                var key = territoryId ?? 0;
                next[key] = next.GetValueOrDefault(key) + 1;
                return next[key];
            }

            foreach (var dto in options)
            {
                var territoryId = TerritoryFor(territories, dto.Territory, result);
                var option = unmatched.FirstOrDefault(f => f.TerritoryId == territoryId && Same(f.Name, dto.Name));
                if (option == null)
                {
                    // A name can't repeat among the options any one territory sees.
                    if (all.Any(f => Same(f.Name, dto.Name) && (territoryId == null || f.TerritoryId == null || f.TerritoryId == territoryId)))
                    {
                        result.Warnings.Add($"The financing option \"{dto.Name!.Trim()}\" has the same name as one already offered alongside it, so it was left out.");
                        continue;
                    }

                    option = new FinanceOption { TerritoryId = territoryId };
                    db.FinanceOptions.Add(option);
                    all.Add(option);
                    result.FinanceOptionsAdded++;
                }
                else
                {
                    unmatched.Remove(option);
                    result.FinanceOptionsUpdated++;
                }

                option.Name = dto.Name!.Trim();
                option.IsActive = dto.IsActive ?? true;
                option.SortOrder = NextIn(territoryId);
            }

            foreach (var kept in unmatched)
                kept.SortOrder = NextIn(kept.TerritoryId);

            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Makes one product look like its entry in the file, apart from what it includes as a
        /// bundle, which is done once every product is in place.
        /// </summary>
        /// <returns>Each size in the file with the size it became.</returns>
        private static async Task<List<(CatalogVariantDto File, ProductVariant Variant)>> ApplyProductAsync(
            ApplicationDbContext db,
            Product product,
            CatalogProductDto dto,
            List<DeliveryOption> deliveryOptions,
            CatalogImportResultDto result)
        {
            var label = Label(dto);

            product.Name = dto.Name!.Trim();
            product.Brand = dto.Brand?.Trim() ?? string.Empty;
            product.Category = Enum.Parse<ProductCategory>(dto.Category!, true);
            product.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();
            product.SortOrder = dto.SortOrder ?? 0;
            product.IsActive = dto.IsActive ?? true;
            product.TrackInventory = dto.TrackInventory ?? false;
            (product.SaleDiscountPercent, product.SaleDiscountAmount) =
                ProductController.CleanSale(dto.SaleDiscountPercent, dto.SaleDiscountAmount);

            // Sizes: matches are updated (each existing size at most once, in order), new ones added.
            // A size no longer in the file is removed, or archived when it has been sold or another
            // bundle includes it.
            var unmatched = product.Variants.Where(v => v.Id != 0).OrderBy(v => v.SortOrder).ThenBy(v => v.Id).ToList();
            var pairs = new List<(CatalogVariantDto File, ProductVariant Variant)>();
            foreach (var v in dto.Variants ?? [])
            {
                var variant = unmatched
                    .Where(x => Same(x.Size, v.Size) && Same(x.Configuration, v.Configuration))
                    .OrderByDescending(x => x.IsActive == (v.IsActive ?? true))
                    .FirstOrDefault();
                if (variant == null)
                {
                    variant = new ProductVariant();
                    product.Variants.Add(variant);
                }
                else
                {
                    unmatched.Remove(variant);
                }
                pairs.Add((v, variant));
            }

            foreach (var gone in unmatched)
            {
                var inUse = await db.OrderLines.AnyAsync(l => l.ProductVariantId == gone.Id)
                            || await db.ProductVariantComponents.AnyAsync(c => c.ComponentVariantId == gone.Id);
                if (inUse)
                {
                    gone.IsActive = false;
                }
                else
                {
                    db.ProductVariants.Remove(gone);
                    product.Variants.Remove(gone);
                }
            }

            foreach (var ((v, variant), index) in pairs.Select((x, i) => (x, i)))
            {
                variant.Size = v.Size?.Trim() ?? string.Empty;
                variant.Configuration = string.IsNullOrWhiteSpace(v.Configuration) ? null : v.Configuration.Trim();
                variant.Price = v.Price;
                variant.SortOrder = index + 1;
                variant.IsActive = v.IsActive ?? true;
                variant.ExcludeFromInventory = v.ExcludeFromInventory ?? false;
                variant.HasOwnSale = v.HasOwnSale ?? false;
                (variant.SaleDiscountPercent, variant.SaleDiscountAmount) = variant.HasOwnSale
                    ? ProductController.CleanSale(v.SaleDiscountPercent, v.SaleDiscountAmount)
                    : (null, null);

                // Rebuilt from the file once every product is in place.
                db.ProductVariantComponents.RemoveRange(variant.Components);
                variant.Components.Clear();
            }

            // Delivery choices, by name: the product's own territory's first, then global ones.
            db.ProductDeliveryOptions.RemoveRange(product.DeliveryOptions);
            product.DeliveryOptions.Clear();
            foreach (var d in dto.DeliveryOptions ?? [])
            {
                var option = deliveryOptions
                    .Where(o => Same(o.Name, d.Name) && (o.TerritoryId == null || o.TerritoryId == product.TerritoryId))
                    .OrderByDescending(o => o.TerritoryId != null)
                    .ThenByDescending(o => o.IsActive)
                    .FirstOrDefault();
                if (option == null)
                {
                    result.Warnings.Add(deliveryOptions.Any(o => Same(o.Name, d.Name))
                        ? $"{label} offers \"{d.Name}\", which isn't available where it's sold, so it was left off."
                        : $"{label} offers \"{d.Name}\", which isn't in the delivery options list, so it was left off.");
                    continue;
                }
                if (product.DeliveryOptions.Any(x => x.DeliveryOption == option))
                    continue;

                product.DeliveryOptions.Add(new ProductDeliveryOption
                {
                    DeliveryOption = option,
                    PriceOverride = d.PriceOverride is < 0 ? null : d.PriceOverride,
                    IsDefault = d.IsDefault ?? false,
                    HasOwnSale = d.HasOwnSale ?? false,
                    SaleDiscountPercent = d.HasOwnSale == true ? ProductController.CleanSale(d.SaleDiscountPercent, d.SaleDiscountAmount).Percent : null,
                    SaleDiscountAmount = d.HasOwnSale == true ? ProductController.CleanSale(d.SaleDiscountPercent, d.SaleDiscountAmount).Amount : null,
                });
            }

            // Selections, keeping the ids of those (and their choices) that match by name, so stock
            // counted per choice carries on.
            var options = ToOptionDtos(dto.Options, product);
            if (product.Id == 0)
                ProductController.SyncOptions(product, options);
            else
                await ProductController.ReplaceOptionsAsync(db, product, options);

            return pairs;
        }

        /// <summary>
        /// Rebuilds what each restored size includes. An item is found by brand, name, size and
        /// configuration among everything now in the catalog; one that can't be found, is the
        /// product itself, or is a bundle in its own right is left out with a warning.
        /// </summary>
        private static void ApplyBundles(List<Product> catalog, List<Restored> imported, List<Territory> territories, CatalogImportResultDto result)
        {
            foreach (var (dto, product, variants) in imported)
            {
                foreach (var (v, bundle) in variants)
                {
                    if (v.Includes is not { Count: > 0 })
                        continue;

                    var label = $"{Label(dto)} - {SizeLabel(v.Size, v.Configuration)}";

                    foreach (var c in v.Includes)
                    {
                        // Only global items and the bundle's own territory's can be included; the
                        // territory the file names comes first.
                        var named = territories.FirstOrDefault(t => Same(t.Name, c.Territory))?.Id;
                        var candidates = catalog.Where(p => Same(p.Brand, c.Brand) && Same(p.Name, c.Name)).ToList();
                        var target = candidates
                            .Where(p => p.TerritoryId == null || p.TerritoryId == product.TerritoryId)
                            .OrderByDescending(p => p.TerritoryId == named)
                            .ThenByDescending(p => p.IsActive)
                            .ThenBy(p => p.Id)
                            .SelectMany(p => p.Variants
                                .Where(x => Same(x.Size, c.Size) && Same(x.Configuration, c.Configuration))
                                .OrderByDescending(x => x.IsActive))
                            .FirstOrDefault();

                        var name = $"{c.Brand} {c.Name} - {SizeLabel(c.Size, c.Configuration)}".Trim();
                        if (target == null)
                        {
                            result.Warnings.Add(candidates.Count > 0
                                ? $"{label} includes {name}, which isn't sold where it is, so it was left out."
                                : $"{label} includes {name}, which isn't in the catalog, so it was left out.");
                            continue;
                        }
                        if (product.Variants.Contains(target))
                        {
                            result.Warnings.Add($"{label} can't include itself, so {name} was left out.");
                            continue;
                        }
                        if (IsBundle(target, imported))
                        {
                            result.Warnings.Add($"{label} includes {name}, which is a bundle itself, so it was left out.");
                            continue;
                        }

                        var already = bundle.Components.FirstOrDefault(x => x.ComponentVariant == target);
                        if (already != null)
                        {
                            already.Quantity = Math.Min(20, already.Quantity + (c.Quantity ?? 1));
                            continue;
                        }

                        bundle.Components.Add(new ProductVariantComponent
                        {
                            ComponentVariant = target,
                            Quantity = c.Quantity ?? 1,
                        });
                    }
                }
            }
        }

        /// <summary>
        /// Whether a size is a bundle once the restore is done: by the file for restored products,
        /// otherwise by what it includes now.
        /// </summary>
        private static bool IsBundle(ProductVariant variant, List<Restored> imported)
        {
            foreach (var restored in imported)
            {
                if (!restored.Product.Variants.Contains(variant))
                    continue;
                var pair = restored.Variants.FirstOrDefault(x => x.Variant == variant);
                return pair.File?.Includes is { Count: > 0 };
            }
            return variant.Components.Count > 0;
        }

        /// <summary>
        /// A file's selections as the catalog editor would send them. With a product, each
        /// selection and choice that matches one it already has by name takes that one's id.
        /// </summary>
        private static List<ProductOptionDto> ToOptionDtos(List<CatalogOptionDto>? options, Product? product)
        {
            return (options ?? []).Select(o =>
            {
                var match = product?.Options.FirstOrDefault(x => x.Id != 0 && Same(x.Name, o.Name));
                return new ProductOptionDto
                {
                    Id = match?.Id,
                    Name = o.Name,
                    IsRequired = o.IsRequired ?? true,
                    TracksStock = (o.TracksStock ?? false) && (product?.TrackInventory ?? true),
                    Choices = (o.Choices ?? []).Select(c => new ProductOptionChoiceDto
                    {
                        Id = match?.Choices
                            .Where(x => Same(x.Name, c.Name))
                            .OrderByDescending(x => x.IsActive)
                            .Select(x => (int?)x.Id)
                            .FirstOrDefault(),
                        Name = c.Name,
                        PriceAdjustment = c.PriceAdjustment,
                        IsActive = true,
                    }).ToList(),
                };
            }).ToList();
        }

        /// <summary>
        /// The territory an item in the file belongs to: the one with that name, or global when
        /// the file names none - or names one that isn't here, which is noted once per name.
        /// </summary>
        private static int? TerritoryFor(List<Territory> territories, string? name, CatalogImportResultDto result)
        {
            if (string.IsNullOrWhiteSpace(name))
                return null;

            var territory = territories.FirstOrDefault(t => Same(t.Name, name));
            var warning = $"There's no territory named {name.Trim()} here, so its items came in as global items.";
            if (territory == null && !result.Warnings.Contains(warning))
                result.Warnings.Add(warning);
            return territory?.Id;
        }

        /// <summary>A product's name for messages, e.g. "Helix Midnight Luxe".</summary>
        private static string Label(CatalogProductDto dto) =>
            string.IsNullOrWhiteSpace(dto.Brand) ? dto.Name?.Trim() ?? "" : $"{dto.Brand.Trim()} {dto.Name?.Trim()}";

        /// <summary>A size for messages, e.g. "Queen / Mattress Only".</summary>
        private static string SizeLabel(string? size, string? configuration) =>
            string.IsNullOrWhiteSpace(configuration) ? size?.Trim() ?? "" : $"{size?.Trim()} / {configuration.Trim()}";

        /// <summary>A name for matching: trimmed and lower case, with nothing the same as blank.</summary>
        private static string Key(string? value) => value?.Trim().ToLowerInvariant() ?? "";

        /// <summary>Whether two names match, ignoring case and spaces around them.</summary>
        private static bool Same(string? a, string? b) => Key(a) == Key(b);

        #endregion
    }
}
