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
    /// The product catalog. A product owns its priced size/configuration variants and the set of
    /// delivery options offered for it, so delivery types can differ from one mattress to the next.
    /// An item is either global - sold in every territory - or one territory's own. Managers look
    /// after their territory's items; only owners and administrators change global ones.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ProductController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        private const string ManagersOnly = "Only a manager, administrator or owner may change the catalog.";
        private const string GlobalReadOnly = "Global items can only be changed by an owner or administrator.";

        #endregion

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
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(ManagersOnly);

                if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Category))
                    return BadRequest(new { error = "Missing parameter." });

                if (request.Name.Length > 150 || (request.Brand?.Length ?? 0) > 100)
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
                };

                var componentError = await ValidateComponentsAsync(null, territoryId, request.Variants)
                                     ?? await ValidateDeliveryOptionsAsync(territoryId, request.DeliveryOptions);
                if (componentError != null)
                    return BadRequest(new { error = componentError });

                ApplyVariants(product, request.Variants);
                ApplyDeliveryOptions(product, request.DeliveryOptions);

                DB.Products.Add(product);
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(product.Id));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while adding the product.", e);
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the catalog of the territory being worked - global items and its own - or every
        /// item for an owner or administrator viewing every territory. Defaults to active products
        /// only, which is what the floor needs.
        /// </summary>
        /// <param name="includeInactive">Pass true from the catalog admin screen</param>
        /// <returns>Products with their variants and delivery options.</returns>
        [HttpGet("products")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetProducts([FromQuery] bool includeInactive = false)
        {
            try
            {
                var territoryId = Scope.TerritoryId;
                var query = DB.Products
                    .Where(p => territoryId == null || p.TerritoryId == null || p.TerritoryId == territoryId)
                    .Include(p => p.Territory)
                    .Include(p => p.Variants)
                    .ThenInclude(v => v.Components)
                    .ThenInclude(c => c.ComponentVariant)
                    .ThenInclude(cv => cv!.Product)
                    .Include(p => p.DeliveryOptions)
                    .ThenInclude(d => d.DeliveryOption)
                    .AsNoTracking()
                    .AsQueryable();

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
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting products.", e);
            }
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
            try
            {
                var dto = await LoadDtoAsync(id);
                if (dto == null || !Visible(dto.TerritoryId))
                    return NotFound(new { error = "Product not found." });

                return Ok(dto);
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting the product.", e);
            }
        }

        /// <summary>
        /// Lists the category names, so the admin screen never hardcodes the enum.
        /// </summary>
        /// <returns>Category names.</returns>
        [HttpGet("categories")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public IActionResult GetCategories()
        {
            try
            {
                return Ok(Enum.GetNames<ProductCategory>());
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting categories.", e);
            }
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
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(ManagersOnly);

                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var product = await DB.Products
                    .Include(p => p.Variants)
                    .ThenInclude(v => v.Components)
                    .Include(p => p.DeliveryOptions)
                    .FirstOrDefaultAsync(p => p.Id == request.Id.Value);

                if (product == null || !Visible(product.TerritoryId))
                    return NotFound(new { error = "Product not found." });

                if (!CanEditCatalog(product.TerritoryId))
                    return Forbidden(GlobalReadOnly);

                // The edit form always sends the name and the territory, null meaning global. Only an
                // owner or administrator can move an item; a partial update leaves it where it is.
                if (Scope.IsCompanyWide && request.Name != null && request.TerritoryId != product.TerritoryId)
                {
                    var (territoryId, problem) = await CatalogTerritoryAsync(request.TerritoryId);
                    if (problem != null)
                        return problem;

                    var moveError = await ValidateMoveAsync(product, territoryId, request);
                    if (moveError != null)
                        return BadRequest(new { error = moveError });

                    product.TerritoryId = territoryId;
                }

                var componentError = await ValidateComponentsAsync(product.Id, product.TerritoryId, request.Variants)
                                     ?? await ValidateDeliveryOptionsAsync(product.TerritoryId, request.DeliveryOptions);
                if (componentError != null)
                    return BadRequest(new { error = componentError });

                if (request.Name != null)
                {
                    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 150)
                        return BadRequest(new { error = "Invalid parameter." });

                    product.Name = request.Name;
                }

                if (request.Brand != null)
                {
                    if (request.Brand.Length > 100)
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

                        variant.Size = dto.Size ?? string.Empty;
                        variant.Configuration = string.IsNullOrWhiteSpace(dto.Configuration) ? null : dto.Configuration;
                        variant.Price = dto.Price;
                        variant.SortOrder = dto.SortOrder ?? 0;
                        variant.IsActive = dto.IsActive ?? true;

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

                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(product.Id));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while updating the product.", e);
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Removes a product, or deactivates it when it already appears on an order. An owner can pass
        /// permanent=true to delete it even then; past sales keep the item as printed.
        /// </summary>
        /// <param name="id">Product id</param>
        /// <param name="permanent">True to delete even a product that has been sold (owner only)</param>
        /// <returns>200, with a flag saying whether the row was archived instead of deleted.</returns>
        [HttpDelete("product/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteProduct(int id, [FromQuery] bool permanent = false)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(ManagersOnly);

                var product = await DB.Products
                    .Include(p => p.Variants)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (product == null || !Visible(product.TerritoryId))
                    return NotFound(new { error = "Product not found." });

                if (!CanEditCatalog(product.TerritoryId))
                    return Forbidden(GlobalReadOnly);

                if (permanent)
                {
                    if (!IsOwner())
                        return Forbidden("Only an owner can delete a product permanently.");

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
            catch (Exception e)
            {
                return ServerError("Internal error occurred while deleting the product.", e);
            }
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
                var variant = new ProductVariant
                {
                    Size = dto.Size ?? string.Empty,
                    Configuration = string.IsNullOrWhiteSpace(dto.Configuration) ? null : dto.Configuration,
                    Price = dto.Price,
                    SortOrder = dto.SortOrder ?? 0,
                    IsActive = dto.IsActive ?? true,
                };

                SetComponents(variant, dto.Components);
                product.Variants.Add(variant);
            }
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
        /// Whether the signed-in user can see a catalog item at all: owners and administrators see
        /// everything; everyone else sees global items and their own territory's.
        /// </summary>
        /// <param name="itemTerritoryId">The item's territory, null for global</param>
        /// <returns>True when visible.</returns>
        private bool Visible(int? itemTerritoryId) =>
            InCatalog(itemTerritoryId, Scope.IsCompanyWide ? null : Scope.HomeTerritoryId);

        /// <summary>
        /// Checks every bundle component in a save request. A product cannot include itself, a
        /// bundle cannot include another bundle - one level keeps the sheet and the stat tallies
        /// predictable - and everything in it has to be sold where the bundle is: a global bundle
        /// only includes global items; a territory's bundle global items or that territory's own.
        /// </summary>
        /// <param name="productId">The product being saved, or null when it is new</param>
        /// <param name="territoryId">The product's territory, null for global</param>
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

            if (requested.Any(c => c.Quantity is < 1 or > 20))
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

            if (found.Any(v => v.TerritoryId != null && v.TerritoryId != territoryId))
                return territoryId == null
                    ? "A global item can only include other global items."
                    : "A bundle can only include global items and items from its own territory.";

            return null;
        }

        /// <summary>
        /// Checks the delivery options in a save request are offered where the product is sold:
        /// global options, or the product's own territory's.
        /// </summary>
        /// <param name="territoryId">The product's territory, null for global</param>
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

            if (found.Any(t => t != null && t != territoryId))
                return territoryId == null
                    ? "A global item can only offer global delivery options."
                    : "An item can only offer global delivery options and its own territory's.";

            return null;
        }

        /// <summary>
        /// Checks an item can move to another territory, or become global: what it includes and
        /// offers must be available there, and no bundle sold elsewhere may include it.
        /// </summary>
        /// <param name="product">The product, with variants, components and delivery options loaded</param>
        /// <param name="territoryId">Where it's going, null for global</param>
        /// <param name="request">The save request; lists it replaces are checked later instead</param>
        /// <returns>An error message, or null when the move is fine.</returns>
        private async Task<string?> ValidateMoveAsync(Product product, int? territoryId, ProductDto request)
        {
            var variantIds = product.Variants.Select(v => v.Id).ToList();

            if (territoryId != null)
            {
                var usedElsewhere = await DB.ProductVariantComponents
                    .AnyAsync(c => variantIds.Contains(c.ComponentVariantId)
                                   && !variantIds.Contains(c.BundleVariantId)
                                   && (c.BundleVariant!.Product!.TerritoryId == null || c.BundleVariant.Product.TerritoryId != territoryId));
                if (usedElsewhere)
                    return "A bundle outside that territory includes this item. Take it out of the bundle first.";
            }

            if (request.Variants == null)
            {
                var componentIds = product.Variants.SelectMany(v => v.Components).Select(c => c.ComponentVariantId).Distinct().ToList();
                if (await DB.ProductVariants.AnyAsync(v => componentIds.Contains(v.Id)
                                                           && v.Product!.TerritoryId != null
                                                           && v.Product.TerritoryId != territoryId))
                    return "This bundle includes items that aren't sold there.";
            }

            if (request.DeliveryOptions == null)
            {
                var optionIds = product.DeliveryOptions.Select(d => d.DeliveryOptionId).ToList();
                if (await DB.DeliveryOptions.AnyAsync(d => optionIds.Contains(d.Id)
                                                           && d.TerritoryId != null
                                                           && d.TerritoryId != territoryId))
                    return "This item offers delivery options that aren't available there.";
            }

            return null;
        }

        /// <summary>
        /// Units on hand of each tracked size in the territory being worked, or nothing when
        /// viewing every territory.
        /// </summary>
        /// <param name="products">Products with their variants loaded</param>
        /// <returns>Variant id to units on hand, or null.</returns>
        private async Task<Dictionary<int, int>?> OnHandAsync(IEnumerable<Product> products)
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

                product.DeliveryOptions.Add(new ProductDeliveryOption
                {
                    DeliveryOptionId = dto.DeliveryOptionId.Value,
                    PriceOverride = dto.PriceOverride,
                    IsDefault = dto.IsDefault ?? false,
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
                .Include(p => p.Territory)
                .Include(p => p.Variants)
                .ThenInclude(v => v.Components)
                .ThenInclude(c => c.ComponentVariant)
                .ThenInclude(cv => cv!.Product)
                .Include(p => p.DeliveryOptions)
                .ThenInclude(d => d.DeliveryOption)
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
        private ProductDto ToDto(Product product, bool includeInactive, Dictionary<int, int>? onHand)
        {
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
                        QuantityOnHand = product.TrackInventory && onHand != null ? onHand.GetValueOrDefault(v.Id) : null,
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
                        Price = d.PriceOverride ?? d.DeliveryOption.Price,
                        PriceOverride = d.PriceOverride,
                        IsTaxable = d.DeliveryOption.IsTaxable,
                        IsTakeWith = d.DeliveryOption.IsTakeWith,
                        IsDefault = d.IsDefault,
                    })
                    .ToList(),
            };
        }

        #endregion
    }
}
