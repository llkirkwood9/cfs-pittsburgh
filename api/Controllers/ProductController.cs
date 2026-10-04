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

                var saleError = ValidateSales(request);
                if (saleError != null)
                    return BadRequest(new { error = saleError });

                var optionError = ValidateOptions(request.Options);
                if (optionError != null)
                    return BadRequest(new { error = optionError });

                (product.SaleDiscountPercent, product.SaleDiscountAmount) = CleanSale(request.SaleDiscountPercent, request.SaleDiscountAmount);
                ApplyVariants(product, request.Variants);
                ApplyDeliveryOptions(product, request.DeliveryOptions);
                SyncOptions(product, request.Options);

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
                    .Include(p => p.Options)
                    .ThenInclude(o => o.Choices)
                    .AsSplitQuery()
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
                    .Include(p => p.Options)
                    .ThenInclude(o => o.Choices)
                    .AsSplitQuery()
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

                var saleError = ValidateSales(request);
                if (saleError != null)
                    return BadRequest(new { error = saleError });

                var optionError = ValidateOptions(request.Options);
                if (optionError != null)
                    return BadRequest(new { error = optionError });

                // The editor always sends the whole sale; 0 or nothing clears it.
                if (request.SaleDiscountPercent != null || request.SaleDiscountAmount != null)
                    (product.SaleDiscountPercent, product.SaleDiscountAmount) = CleanSale(request.SaleDiscountPercent, request.SaleDiscountAmount);

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
                        variant.HasOwnSale = dto.HasOwnSale ?? false;
                        (variant.SaleDiscountPercent, variant.SaleDiscountAmount) = variant.HasOwnSale
                            ? CleanSale(dto.SaleDiscountPercent, dto.SaleDiscountAmount)
                            : (null, null);

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
                    await ReplaceOptionsAsync(DB, product, request.Options);

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
                    HasOwnSale = dto.HasOwnSale ?? false,
                };
                if (variant.HasOwnSale)
                    (variant.SaleDiscountPercent, variant.SaleDiscountAmount) = CleanSale(dto.SaleDiscountPercent, dto.SaleDiscountAmount);

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
        /// A sale as stored: a percent, or else an amount, or nothing. Zero clears it.
        /// </summary>
        internal static (decimal? Percent, decimal? Amount) CleanSale(decimal? percent, decimal? amount) =>
            percent is > 0 ? (percent, null) : amount is > 0 ? (null, amount) : (null, null);

        /// <summary>
        /// Checks the product's and each size's sale: percents from 0 to 100, amounts 0 or more.
        /// </summary>
        /// <returns>An error message, or null.</returns>
        private static string? ValidateSales(ProductDto request)
        {
            var sales = new List<(decimal? Percent, decimal? Amount)> { (request.SaleDiscountPercent, request.SaleDiscountAmount) };
            sales.AddRange((request.Variants ?? []).Select(v => (v.SaleDiscountPercent, v.SaleDiscountAmount)));

            if (sales.Any(s => s.Percent is < 0 or > 100))
                return "A sale percent must be between 0 and 100.";
            if (sales.Any(s => s.Amount < 0))
                return "A sale amount can't be negative.";
            return null;
        }

        /// <summary>
        /// Checks the selections in a save request: each needs a name and at least one choice,
        /// every choice a name, and names can't repeat.
        /// </summary>
        /// <returns>An error message, or null.</returns>
        internal static string? ValidateOptions(List<ProductOptionDto>? options)
        {
            if (options == null)
                return null;

            if (options.Count > 10)
                return "A product can have at most 10 selections.";

            foreach (var option in options)
            {
                var name = option.Name?.Trim() ?? "";
                if (name.Length == 0)
                    return "Every selection needs a name, such as Color.";
                if (name.Length > 50)
                    return "A selection's name can be at most 50 characters.";

                var choices = (option.Choices ?? []).Where(c => c.IsActive ?? true).ToList();
                if (choices.Count == 0)
                    return $"Give \"{name}\" at least one choice.";
                if (choices.Count > 50)
                    return $"\"{name}\" can have at most 50 choices.";
                if (choices.Any(c => string.IsNullOrWhiteSpace(c.Name) || c.Name.Trim().Length > 50))
                    return $"Every choice for \"{name}\" needs a name of up to 50 characters.";
                if (choices.GroupBy(c => c.Name!.Trim().ToLowerInvariant()).Any(g => g.Count() > 1))
                    return $"\"{name}\" lists the same choice twice.";
                if (choices.Any(c => c.PriceAdjustment is < -100000 or > 100000))
                    return $"A price change for \"{name}\" is too large.";
            }

            if (options.GroupBy(o => o.Name!.Trim().ToLowerInvariant()).Any(g => g.Count() > 1))
                return "Two selections have the same name.";

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
        /// <returns>(Variant id, stock key) to units on hand, or null.</returns>
        private async Task<Dictionary<(int VariantId, string StockKey), int>?> OnHandAsync(IEnumerable<Product> products)
        {
            if (Scope.TerritoryId is not { } territoryId)
                return null;

            var ids = products.Where(p => p.TrackInventory).SelectMany(p => p.Variants).Select(v => v.Id).ToList();
            return await InventoryRules.OnHandAsync(DB, territoryId, ids);
        }

        /// <summary>
        /// Adds the selections from a save request to a new product.
        /// </summary>
        internal static void SyncOptions(Product product, List<ProductOptionDto>? options)
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
        internal static async Task ReplaceOptionsAsync(ApplicationDbContext db, Product product, List<ProductOptionDto> options)
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

        /// <summary>
        /// Clears the stock counted for a selection's choices, across the product's sizes and in
        /// every territory.
        /// </summary>
        private static async Task RemoveChoiceStockAsync(ApplicationDbContext db, Product product, int optionId)
        {
            var variantIds = product.Variants.Select(v => v.Id).ToList();
            var marker = $"{optionId}:";
            var rows = await db.InventoryStocks
                .Where(s => variantIds.Contains(s.ProductVariantId) && s.StockKey != "")
                .ToListAsync();
            db.InventoryStocks.RemoveRange(rows.Where(r => r.StockKey.Split('|').Any(part => part.StartsWith(marker))));
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
                .Include(p => p.Options)
                .ThenInclude(o => o.Choices)
                .AsSplitQuery()
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
                        HasOwnSale = v.HasOwnSale,
                        SaleDiscountPercent = v.SaleDiscountPercent,
                        SaleDiscountAmount = v.SaleDiscountAmount,
                        Stocks = combinations.Count == 1 && combinations[0].Key == ""
                            ? null
                            : combinations.Select(c => new ChoiceStockDto
                            {
                                StockKey = c.Key,
                                Label = c.Label,
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
