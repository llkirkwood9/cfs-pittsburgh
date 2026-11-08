using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using api.Catalog;
using api.Data;
using api.Dtos;
using api.Inventory;
using api.Models;
using api.Services;
using api.Utils;

namespace api.Controllers
{
    /// <summary>
    /// The product catalog. A product owns its priced size/configuration variants and the set of
    /// delivery options offered for it, so delivery types can differ from one mattress to the next.
    /// Every territory has its own catalog; managers look after their own territories' items.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ProductController(
        ApplicationDbContext db,
        ILogger<BasicController> logger)
        : CatalogItemController(db, logger)
    {
        #region POST Methods

        /// <summary>
        /// Adds a product with its variants and delivery availability.
        /// </summary>
        /// <param name="request">Product fields</param>
        /// <returns>The created product.</returns>
        [HttpPost("product")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddProduct([FromBody] ProductDto request)
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Category))
                return BadRequest(new { error = "Missing parameter." });

            if (request.Name.Length > CatalogRules.MaxProductNameLength || (request.Brand?.Length ?? 0) > CatalogRules.MaxBrandLength)
                return BadRequest(new { error = "Invalid parameter." });

            if (!Enum.TryParse<ProductCategory>(request.Category, true, out var category))
                return BadRequest(new { error = "Invalid parameter." });

            var (territoryId, problem) = await CatalogTerritoryAsync(request.TerritoryId);
            if (problem != null)
                return problem;

            var product = new Product
            {
                TerritoryId = territoryId,
                Name = request.Name,
                Brand = request.Brand ?? string.Empty,
                Category = category,
                Notes = request.Notes,
                SortOrder = request.SortOrder ?? 0,
                IsActive = request.IsActive ?? true,
                TrackInventory = request.TrackInventory ?? false,
                HasWarranty = request.HasWarranty ?? CatalogRules.WarrantyByDefault(category),
                WarrantyLength = CatalogRules.CleanWarrantyLength(request.WarrantyLength),
            };

            var componentError = await ValidateComponentsAsync(null, territoryId, request.Variants)
                                 ?? await ValidateDeliveryOptionsAsync(territoryId, request.DeliveryOptions);
            if (componentError != null)
                return BadRequest(new { error = componentError });

            var saleError = ValidateSales(request);
            if (saleError != null)
                return BadRequest(new { error = saleError });

            var optionError = ProductOptions.Validate(request.Options);
            if (optionError != null)
                return BadRequest(new { error = optionError });

            (product.SaleDiscountPercent, product.SaleDiscountAmount) = CatalogRules.CleanSale(request.SaleDiscountPercent, request.SaleDiscountAmount);
            ApplyVariants(product, request.Variants);
            ApplyDeliveryOptions(product, request.DeliveryOptions);
            ProductOptions.AddTo(product, request.Options);

            DB.Products.Add(product);
            await DB.SaveChangesAsync();

            return Ok(await LoadDtoAsync(product.Id));
        }

        /// <summary>
        /// Copies a product from another territory's catalog into the territory in view (or the one
        /// given), for someone who works in more than one territory and looks after the catalog.
        /// Everything about it is copied - sizes, prices, sales, selections, notes and warranty -
        /// but no stock. The delivery options it offers are matched by name, and added to the
        /// territory's catalog when it has none of that name; bundled items are matched by brand,
        /// name and size, and left out when the territory doesn't sell them.
        /// </summary>
        /// <param name="id">The product to copy</param>
        /// <param name="toTerritoryId">The territory to copy it into; the one in view when left out</param>
        /// <returns>The new product, with notes on anything added or left out.</returns>
        [HttpPost("product/{id}/copy")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> CopyProduct(int id, [FromQuery] int? toTerritoryId = null)
        {
            var source = (await DB.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id)).IfVisibleTo(Scope);
            if (source == null)
                return NotFound(new { error = "Product not found." });

            var (territoryId, problem) = await CatalogTerritoryAsync(toTerritoryId);
            if (problem != null)
                return problem;

            if (source.TerritoryId == territoryId)
                return BadRequest(new { error = "That product is already in this territory's catalog." });

            if (await DB.Products.Where(p => p.TerritoryId == territoryId).WithBrandAndName(source.Brand, source.Name).AnyAsync())
                return BadRequest(new { error = $"This territory's catalog already has {source.Name}. Edit that one instead." });

            var (copy, notes) = await CatalogCopy.CopyProductAsync(DB, source.Id, territoryId);

            Trace(TraceEventType.Information, $"{GetCurrentUserName()} copied {source.Name} into territory {territoryId}.");
            return Ok(new ProductCopyResultDto { Product = await LoadDtoAsync(copy.Id), Notes = notes });
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the catalog of the territory being worked - or of all the user's territories, each
        /// item naming its own, when none is picked. Defaults to active products only, which is what
        /// the floor needs.
        /// </summary>
        /// <param name="includeInactive">Pass true from the catalog admin screen</param>
        /// <returns>Products with their variants and delivery options.</returns>
        [HttpGet("products")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetProducts([FromQuery] bool includeInactive = false)
        {
            var query = DB.Products
                .VisibleTo(Scope)
                .WithEverything()
                .AsNoTracking();

            if (!includeInactive)
                query = query.Where(p => p.IsActive);

            var products = await query
                .OrderBy(p => p.Category)
                .ThenBy(p => p.SortOrder)
                .ThenBy(p => p.Name)
                .ToListAsync();

            var onHand = await OnHandAsync(products);
            return Ok(products.Select(p => ToDto(p, includeInactive, onHand)).ToList());
        }

        /// <summary>
        /// Gets a single product with its variants and delivery options.
        /// </summary>
        /// <param name="id">Product id</param>
        /// <returns>The product.</returns>
        [HttpGet("product/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetProduct(int id)
        {
            var dto = await LoadDtoAsync(id);
            if (dto == null || !Scope.CanSee(dto.TerritoryId))
                return NotFound(new { error = "Product not found." });

            return Ok(dto);
        }

        /// <summary>
        /// Lists the category names, so the admin screen never hardcodes the enum.
        /// </summary>
        /// <returns>Category names.</returns>
        [HttpGet("categories")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public IActionResult GetCategories()
        {
            return Ok(Enum.GetNames<ProductCategory>());
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Updates a product. Variants and delivery options are replaced wholesale when supplied,
        /// which keeps the admin screen a simple save-the-whole-form affair.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated product.</returns>
        [HttpPatch("product")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateProduct([FromBody] ProductDto request)
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            if (request.Id == null)
                return BadRequest(new { error = "Missing parameter." });

            var product = await DB.Products
                .ForEditing()
                .FirstOrDefaultAsync(p => p.Id == request.Id.Value);

            product = product.IfVisibleTo(Scope);
            if (product == null)
                return NotFound(new { error = "Product not found." });

            if (DenyUnlessEditable(product.TerritoryId) is { } notEditable)
                return notEditable;

            var componentError = await ValidateComponentsAsync(product.Id, product.TerritoryId, request.Variants)
                                 ?? await ValidateDeliveryOptionsAsync(product.TerritoryId, request.DeliveryOptions);
            if (componentError != null)
                return BadRequest(new { error = componentError });

            var saleError = ValidateSales(request);
            if (saleError != null)
                return BadRequest(new { error = saleError });

            var optionError = ProductOptions.Validate(request.Options);
            if (optionError != null)
                return BadRequest(new { error = optionError });

            // The editor always sends the whole sale; 0 or nothing clears it.
            if (request.SaleDiscountPercent != null || request.SaleDiscountAmount != null)
                (product.SaleDiscountPercent, product.SaleDiscountAmount) = CatalogRules.CleanSale(request.SaleDiscountPercent, request.SaleDiscountAmount);

            if (request.Name != null)
            {
                if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > CatalogRules.MaxProductNameLength)
                    return BadRequest(new { error = "Invalid parameter." });

                product.Name = request.Name;
            }

            if (request.Brand != null)
            {
                if (request.Brand.Length > CatalogRules.MaxBrandLength)
                    return BadRequest(new { error = "Invalid parameter." });

                product.Brand = request.Brand;
            }

            if (request.Category != null)
            {
                if (!Enum.TryParse<ProductCategory>(request.Category, true, out var category))
                    return BadRequest(new { error = "Invalid parameter." });

                product.Category = category;
            }

            if (request.Notes != null)
                product.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes;

            if (request.SortOrder != null)
                product.SortOrder = request.SortOrder.Value;

            if (request.IsActive != null)
                product.IsActive = request.IsActive.Value;

            if (request.TrackInventory != null)
                product.TrackInventory = request.TrackInventory.Value;

            if (request.HasWarranty != null)
                product.HasWarranty = request.HasWarranty.Value;

            if (request.WarrantyLength != null)
                product.WarrantyLength = CatalogRules.CleanWarrantyLength(request.WarrantyLength);

            if (request.Variants != null)
            {
                // Variants still referenced by a sold line are deactivated rather than removed,
                // so historic receipts keep resolving.
                var keepIds = request.Variants.Where(v => v.Id != null).Select(v => v.Id!.Value).ToHashSet();
                var dropped = product.Variants.Where(v => !keepIds.Contains(v.Id)).ToList();

                foreach (var variant in dropped)
                {
                    // A variant still bundled into another product is kept too, so that
                    // bundle does not lose its component.
                    var inUse = await DB.OrderLines.AnyAsync(l => l.ProductVariantId == variant.Id)
                                || await DB.ProductVariantComponents.AnyAsync(c => c.ComponentVariantId == variant.Id);

                    if (inUse)
                        variant.IsActive = false;
                    else
                        DB.ProductVariants.Remove(variant);
                }

                foreach (var dto in request.Variants)
                {
                    var variant = dto.Id != null
                        ? product.Variants.FirstOrDefault(v => v.Id == dto.Id.Value)
                        : null;

                    if (variant == null)
                    {
                        variant = new ProductVariant();
                        product.Variants.Add(variant);
                    }

                    CopyVariant(variant, dto);

                    if (dto.Components != null)
                    {
                        DB.ProductVariantComponents.RemoveRange(variant.Components);
                        variant.Components.Clear();
                        SetComponents(variant, dto.Components);
                    }
                }
            }

            if (request.DeliveryOptions != null)
            {
                DB.ProductDeliveryOptions.RemoveRange(product.DeliveryOptions);
                product.DeliveryOptions.Clear();
                ApplyDeliveryOptions(product, request.DeliveryOptions);
            }

            if (request.Options != null)
                await ProductOptions.ReplaceAsync(DB, product, request.Options);

            await DB.SaveChangesAsync();

            return Ok(await LoadDtoAsync(product.Id));
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Removes a product, or deactivates it when it already appears on an order. A system admin can pass
        /// permanent=true to delete it even then; past sales keep the item as printed.
        /// </summary>
        /// <param name="id">Product id</param>
        /// <param name="permanent">True to delete even a product that has been sold (system admin only)</param>
        /// <returns>200, with a flag saying whether the row was archived instead of deleted.</returns>
        [HttpDelete("product/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteProduct(int id, [FromQuery] bool permanent = false)
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            var product = await DB.Products
                .Include(p => p.Variants)
                .FirstOrDefaultAsync(p => p.Id == id);

            product = product.IfVisibleTo(Scope);
            if (product == null)
                return NotFound(new { error = "Product not found." });

            if (DenyUnlessEditable(product.TerritoryId) is { } notEditable)
                return notEditable;

            if (permanent)
            {
                if (!IsSystemAdmin())
                    return Forbidden("Only a system admin can delete a product permanently.");

                await PermanentDelete.ProductAsync(DB, id);
                return Ok(new { archived = false });
            }

            var variantIds = product.Variants.Select(v => v.Id).ToList();
            var isSold = await DB.OrderLines.AnyAsync(l => l.ProductVariantId != null
                                                           && variantIds.Contains(l.ProductVariantId.Value));

            // Something else still ships this product as part of a bundle.
            var isBundled = await DB.ProductVariantComponents
                .AnyAsync(c => variantIds.Contains(c.ComponentVariantId)
                               && !variantIds.Contains(c.BundleVariantId));

            if (isSold || isBundled)
            {
                product.IsActive = false;
                await DB.SaveChangesAsync();
                return Ok(new { archived = true });
            }

            DB.Products.Remove(product);
            await DB.SaveChangesAsync();

            return Ok(new { archived = false });
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Copies variant DTOs onto a new product.
        /// </summary>
        /// <param name="product">Target product</param>
        /// <param name="variants">Variant DTOs, may be null</param>
        private static void ApplyVariants(Product product, List<ProductVariantDto>? variants)
        {
            if (variants == null)
                return;

            foreach (var dto in variants)
            {
                var variant = new ProductVariant();
                CopyVariant(variant, dto);
                SetComponents(variant, dto.Components);
                product.Variants.Add(variant);
            }
        }

        /// <summary>
        /// Copies a size's fields from the editor onto a new or existing size. The editor sends
        /// sizes as typed; a catalog file's are trimmed and placed in file order (CatalogTransfer).
        /// </summary>
        /// <param name="variant">Target size</param>
        /// <param name="dto">The size as sent</param>
        private static void CopyVariant(ProductVariant variant, ProductVariantDto dto)
        {
            variant.Size = dto.Size ?? string.Empty;
            variant.Configuration = string.IsNullOrWhiteSpace(dto.Configuration) ? null : dto.Configuration;
            variant.Price = dto.Price;
            variant.SortOrder = dto.SortOrder ?? 0;
            variant.IsActive = dto.IsActive ?? true;
            variant.ExcludeFromInventory = dto.ExcludeFromInventory ?? false;
            variant.Notes = CatalogRules.CleanSizeNotes(dto.Notes);
            variant.HasOwnSale = dto.HasOwnSale ?? false;
            (variant.SaleDiscountPercent, variant.SaleDiscountAmount) = variant.HasOwnSale
                ? CatalogRules.CleanSale(dto.SaleDiscountPercent, dto.SaleDiscountAmount)
                : (null, null);
        }

        /// <summary>
        /// Replaces a variant's bundle with the supplied components, merging duplicates.
        /// </summary>
        /// <param name="variant">The bundle variant</param>
        /// <param name="components">Component DTOs, may be null</param>
        private static void SetComponents(ProductVariant variant, List<ProductVariantComponentDto>? components)
        {
            if (components == null)
                return;

            foreach (var group in components
                         .Where(c => c.ComponentVariantId != null)
                         .GroupBy(c => c.ComponentVariantId!.Value))
            {
                variant.Components.Add(new ProductVariantComponent
                {
                    ComponentVariantId = group.Key,
                    Quantity = Math.Max(1, group.Sum(c => c.Quantity ?? 1)),
                });
            }
        }

        /// <summary>
        /// Checks every bundle component in a save request. A product cannot include itself, a
        /// bundle cannot include another bundle - one level keeps the sheet and the stat tallies
        /// predictable - and everything in it has to be from the bundle's own territory's catalog.
        /// </summary>
        /// <param name="productId">The product being saved, or null when it is new</param>
        /// <param name="territoryId">The product's territory</param>
        /// <param name="variants">Variant DTOs from the request</param>
        /// <returns>An error message, or null when everything is valid.</returns>
        private async Task<string?> ValidateComponentsAsync(int? productId, int? territoryId, List<ProductVariantDto>? variants)
        {
            var requested = (variants ?? new List<ProductVariantDto>())
                .SelectMany(v => v.Components ?? new List<ProductVariantComponentDto>())
                .ToList();

            if (requested.Count == 0)
                return null;

            if (requested.Any(c => c.ComponentVariantId == null))
                return "Pick an item and size for every bundled product.";

            if (requested.Any(c => !CatalogRules.IsValidBundleQuantity(c.Quantity)))
                return "A bundled item's quantity must be between 1 and 20.";

            var ids = requested.Select(c => c.ComponentVariantId!.Value).Distinct().ToList();

            var found = await DB.ProductVariants
                .Where(v => ids.Contains(v.Id))
                .Select(v => new { v.Id, v.ProductId, IsBundle = v.Components.Any(), v.Product!.TerritoryId })
                .ToListAsync();

            if (found.Count != ids.Count)
                return "A bundled item no longer exists in the catalog.";

            if (productId != null && found.Any(v => v.ProductId == productId.Value))
                return "A product cannot be bundled with itself.";

            if (found.Any(v => v.IsBundle))
                return "A bundle cannot include another bundle. Pick the individual items instead.";

            if (found.Any(v => v.TerritoryId != territoryId))
                return "A bundle can only include items from its own territory's catalog.";

            return null;
        }

        /// <summary>
        /// Checks the delivery options in a save request are from the product's own territory.
        /// </summary>
        /// <param name="territoryId">The product's territory</param>
        /// <param name="options">Delivery option DTOs from the request</param>
        /// <returns>An error message, or null when everything is valid.</returns>
        private async Task<string?> ValidateDeliveryOptionsAsync(int? territoryId, List<ProductDeliveryOptionDto>? options)
        {
            var ids = (options ?? []).Where(o => o.DeliveryOptionId != null).Select(o => o.DeliveryOptionId!.Value).Distinct().ToList();
            if (ids.Count == 0)
                return null;

            var found = await DB.DeliveryOptions
                .Where(d => ids.Contains(d.Id))
                .Select(d => d.TerritoryId)
                .ToListAsync();

            if (found.Count != ids.Count)
                return "A delivery option no longer exists.";

            if (found.Any(t => t != territoryId))
                return "An item can only offer its own territory's delivery options.";

            return null;
        }

        /// <summary>
        /// Checks the product's and each size's sale: percents from 0 to 100, amounts 0 or more.
        /// </summary>
        /// <returns>An error message, or null.</returns>
        private static string? ValidateSales(ProductDto request)
        {
            var sales = new List<(decimal? Percent, decimal? Amount)> { (request.SaleDiscountPercent, request.SaleDiscountAmount) };
            sales.AddRange((request.Variants ?? []).Select(v => (v.SaleDiscountPercent, v.SaleDiscountAmount)));
            sales.AddRange((request.DeliveryOptions ?? []).Select(d => (d.SaleDiscountPercent, d.SaleDiscountAmount)));

            return CatalogRules.SalesProblem(sales);
        }

        /// <summary>
        /// Units on hand of each tracked size in the territory being worked, or nothing when
        /// viewing every territory.
        /// </summary>
        /// <param name="products">Products with their variants loaded</param>
        /// <returns>(Variant id, stock key) to units on hand, or null.</returns>
        private async Task<Dictionary<(int VariantId, string StockKey), int>?> OnHandAsync(IEnumerable<Product> products)
        {
            if (Scope.TerritoryId is not { } territoryId)
                return null;

            var ids = products.Where(p => p.TrackInventory).SelectMany(p => p.Variants).Select(v => v.Id).ToList();
            return await InventoryRules.OnHandAsync(DB, territoryId, ids);
        }

        /// <summary>
        /// Copies delivery availability DTOs onto a product.
        /// </summary>
        /// <param name="product">Target product</param>
        /// <param name="options">Delivery option DTOs, may be null</param>
        private static void ApplyDeliveryOptions(Product product, List<ProductDeliveryOptionDto>? options)
        {
            if (options == null)
                return;

            foreach (var dto in options)
            {
                if (dto.DeliveryOptionId == null)
                    continue;

                var hasOwnSale = dto.HasOwnSale ?? false;
                var (salePercent, saleAmount) = hasOwnSale
                    ? CatalogRules.CleanSale(dto.SaleDiscountPercent, dto.SaleDiscountAmount)
                    : (null, null);

                product.DeliveryOptions.Add(new ProductDeliveryOption
                {
                    DeliveryOptionId = dto.DeliveryOptionId.Value,
                    PriceOverride = dto.PriceOverride,
                    IsDefault = dto.IsDefault ?? false,
                    HasOwnSale = hasOwnSale,
                    SaleDiscountPercent = salePercent,
                    SaleDiscountAmount = saleAmount,
                });
            }
        }

        /// <summary>
        /// Reloads a product and maps it, used after a save so the response carries real ids.
        /// </summary>
        /// <param name="id">Product id</param>
        /// <returns>The mapped DTO, or null when the product is gone.</returns>
        private async Task<ProductDto?> LoadDtoAsync(int id)
        {
            var product = await DB.Products
                .WithEverything()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id);

            return product == null ? null : ToDto(product, true, await OnHandAsync([product]));
        }

        /// <summary>
        /// Maps a product entity to its DTO, resolving the effective delivery price for each option.
        /// </summary>
        /// <param name="product">Product entity with variants and delivery options loaded</param>
        /// <param name="includeInactive">Whether to keep inactive variants in the result</param>
        /// <param name="onHand">The territory's stock, or null when viewing every territory</param>
        /// <returns>The mapped DTO.</returns>
        private ProductDto ToDto(Product product, bool includeInactive, Dictionary<(int VariantId, string StockKey), int>? onHand)
        {
            // Every combination of counted choices, for the stock shown on the floor.
            var combinations = Choices.Combinations(product);
            var counted = Choices.CountedOptions(product).Select(o => o.Id).ToHashSet();

            return new ProductDto
            {
                Id = product.Id,
                TerritoryId = product.TerritoryId,
                TerritoryName = product.Territory?.Name,
                CanEdit = CanEditCatalog(product.TerritoryId),
                Name = product.Name,
                Brand = product.Brand,
                Category = product.Category.ToString(),
                Notes = product.Notes,
                SortOrder = product.SortOrder,
                IsActive = product.IsActive,
                TrackInventory = product.TrackInventory,
                HasWarranty = product.HasWarranty,
                WarrantyLength = product.WarrantyLength,
                SaleDiscountPercent = product.SaleDiscountPercent,
                SaleDiscountAmount = product.SaleDiscountAmount,
                Options = product.Options
                    .OrderBy(o => o.SortOrder)
                    .ThenBy(o => o.Id)
                    .Select(o => new ProductOptionDto
                    {
                        Id = o.Id,
                        Name = o.Name,
                        SortOrder = o.SortOrder,
                        IsRequired = o.IsRequired,
                        TracksStock = o.TracksStock,
                        CountsStock = counted.Contains(o.Id),
                        Choices = o.Choices
                            .Where(c => c.IsActive)
                            .OrderBy(c => c.SortOrder)
                            .ThenBy(c => c.Id)
                            .Select(c => new ProductOptionChoiceDto
                            {
                                Id = c.Id,
                                Name = c.Name,
                                PriceAdjustment = c.PriceAdjustment,
                                SortOrder = c.SortOrder,
                                IsActive = c.IsActive,
                            })
                            .ToList(),
                    })
                    .ToList(),
                Variants = product.Variants
                    .Where(v => includeInactive || v.IsActive)
                    .OrderBy(v => v.SortOrder)
                    .Select(v => new ProductVariantDto
                    {
                        Id = v.Id,
                        ProductId = v.ProductId,
                        Size = v.Size,
                        Configuration = v.Configuration,
                        Price = v.Price,
                        SortOrder = v.SortOrder,
                        IsActive = v.IsActive,
                        QuantityOnHand = product.TrackInventory && onHand != null ? onHand.GetValueOrDefault((v.Id, "")) : null,
                        ExcludeFromInventory = v.ExcludeFromInventory,
                        Notes = v.Notes,
                        HasOwnSale = v.HasOwnSale,
                        SaleDiscountPercent = v.SaleDiscountPercent,
                        SaleDiscountAmount = v.SaleDiscountAmount,
                        Stocks = combinations.Count == 1 && combinations[0].Key == ""
                            ? null
                            : combinations.Select(c => new ChoiceStockDto
                            {
                                StockKey = c.Key,
                                Label = c.Label,
                                ChoiceIds = StockKeys.Parts(c.Key).Select(p => p!.Value.ChoiceId).ToList(),
                                QuantityOnHand = onHand?.GetValueOrDefault((v.Id, c.Key)),
                            }).ToList(),
                        Components = v.Components
                            .Where(c => c.ComponentVariant?.Product != null)
                            .Select(c => new ProductVariantComponentDto
                            {
                                Id = c.Id,
                                ComponentVariantId = c.ComponentVariantId,
                                Quantity = c.Quantity,
                                ProductId = c.ComponentVariant!.ProductId,
                                ProductName = c.ComponentVariant.Product!.Name,
                                Brand = c.ComponentVariant.Product.Brand,
                                Category = c.ComponentVariant.Product.Category.ToString(),
                                Size = c.ComponentVariant.Size,
                                Configuration = c.ComponentVariant.Configuration,
                            })
                            .ToList(),
                    })
                    .ToList(),
                DeliveryOptions = product.DeliveryOptions
                    .Where(d => d.DeliveryOption != null && (includeInactive || d.DeliveryOption.IsActive))
                    .OrderBy(d => d.DeliveryOption!.SortOrder)
                    .Select(d => new ProductDeliveryOptionDto
                    {
                        Id = d.Id,
                        ProductId = d.ProductId,
                        DeliveryOptionId = d.DeliveryOptionId,
                        Name = d.DeliveryOption!.Name,
                        Price = CatalogRules.DeliveryPrice(d.DeliveryOption, d),
                        PriceOverride = d.PriceOverride,
                        IsTaxable = d.DeliveryOption.IsTaxable,
                        IsTakeWith = d.DeliveryOption.IsTakeWith,
                        IsDefault = d.IsDefault,
                        HasOwnSale = d.HasOwnSale,
                        SaleDiscountPercent = d.SaleDiscountPercent,
                        SaleDiscountAmount = d.SaleDiscountAmount,
                        OptionSaleDiscountPercent = d.DeliveryOption.SaleDiscountPercent,
                        OptionSaleDiscountAmount = d.DeliveryOption.SaleDiscountAmount,
                    })
                    .ToList(),
            };
        }

        #endregion
    }
}
