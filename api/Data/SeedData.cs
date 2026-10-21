using System.Text.Json;
using api.Models;
using api.Services;
using api.Utils;
using Microsoft.EntityFrameworkCore;

namespace api.Data
{
    /// <summary>
    /// Loads the starting territory, catalog, delivery options, crew accounts and opening event from
    /// CatalogSeed.json. Runs on every startup but only fills gaps, so an event in progress is
    /// never overwritten. With Seed:Skip set (SKIP_SEED_DATA in the Docker .env) only the first
    /// sign-in account is created, and only into an empty database - nothing else is loaded, so
    /// catalog items and events deleted on purpose stay deleted.
    /// </summary>
    public static class SeedData
    {
        #region Public Methods

        /// <summary>
        /// Seeds anything that is missing.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="tokenService">Used to hash the first account's password</param>
        /// <param name="initialPassword">The first account's password (Seed:AdminPassword); when
        /// blank a random one is made and returned so it can be written to the log once</param>
        /// <param name="accountsOnly">Skip the catalog, delivery options and opening event; still
        /// create the first sign-in account when there are no accounts at all, so nobody is
        /// locked out of a new database</param>
        /// <returns>The generated password when one was made, otherwise null.</returns>
        public static async Task<string?> SeedAsync(
            ApplicationDbContext db, TokenService tokenService, string? initialPassword, bool accountsOnly = false)
        {
            var path = Path.Combine(AppContext.BaseDirectory, "Data", "CatalogSeed.json");
            if (!File.Exists(path))
                return null;

            await using var stream = File.OpenRead(path);
            var seed = await JsonSerializer.DeserializeAsync<SeedFile>(stream, JsonOptions);
            if (seed == null)
                return null;

            var generated = await SeedUsersAsync(db, tokenService, seed, initialPassword);
            if (accountsOnly)
                return generated;

            // The sample catalog belongs to the first territory; every territory has its own.
            var territoryId = await SeedTerritoryAsync(db, seed);
            await SeedEventAsync(db, seed);
            var deliveryByName = await SeedDeliveryOptionsAsync(db, seed, territoryId);
            var created = await SeedProductsAsync(db, seed, deliveryByName, territoryId);
            await SeedBundlesAsync(db, created, territoryId);
            return generated;
        }

        /// <summary>
        /// Makes sure someone can do system-admin-only work. When no active system admin exists - an existing
        /// database from before the role, or a fresh one seeded with an administrator - the longest-
        /// standing active administrator becomes the system admin.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <returns>The promoted user's username, or null when nothing changed.</returns>
        public static async Task<string?> EnsureSystemAdminAsync(ApplicationDbContext db)
        {
            if (await db.Users.AnyAsync(u => u.Role == UserRole.SystemAdmin && u.IsActive))
                return null;

            var admin = await db.Users
                .Where(u => u.Role == UserRole.Admin && u.IsActive)
                .OrderBy(u => u.Id)
                .FirstOrDefaultAsync();

            if (admin == null)
                return null;

            admin.Role = UserRole.SystemAdmin;
            await db.SaveChangesAsync();
            return admin.Username;
        }

        #endregion

        #region Private Fields

        /// <summary>
        /// Case-insensitive options matching the camelCase seed file
        /// </summary>
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        #endregion

        #region Private Methods

        /// <summary>
        /// Creates the pre-provisioned accounts when none exist. They are company-wide (system admin or
        /// administrator), all share the one starting password, and each has to choose their own
        /// at first sign-in.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="tokenService">Password hashing</param>
        /// <param name="seed">Parsed seed file</param>
        /// <param name="initialPassword">The configured starting password, or blank to make one</param>
        /// <returns>The generated password when one was made, otherwise null.</returns>
        private static async Task<string?> SeedUsersAsync(
            ApplicationDbContext db, TokenService tokenService, SeedFile seed, string? initialPassword)
        {
            if (await db.Users.AnyAsync() || seed.Users == null)
                return null;

            var generated = string.IsNullOrWhiteSpace(initialPassword) ? TokenService.GeneratePassword() : null;
            var password = generated ?? initialPassword!;

            foreach (var u in seed.Users)
            {
                if (string.IsNullOrWhiteSpace(u.Username))
                    continue;

                // Anyone below administrator would need a territory, which a new database doesn't have yet.
                var role = Enum.TryParse<UserRole>(u.Role, true, out var parsed) && parsed is UserRole.SystemAdmin or UserRole.Admin
                    ? parsed
                    : UserRole.Admin;

                var user = new User
                {
                    Name = u.Name ?? u.Username,
                    Username = u.Username,
                    Role = role,
                    IsActive = true,
                };
                Passwords.Set(tokenService, user, password, mustChange: true);
                db.Users.Add(user);
            }

            await db.SaveChangesAsync();
            return generated;
        }

        /// <summary>
        /// The territory the opening event goes in: the first one there is, or a new one named in
        /// the seed file.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="seed">Parsed seed file</param>
        /// <returns>The territory id.</returns>
        private static async Task<int> SeedTerritoryAsync(ApplicationDbContext db, SeedFile seed)
        {
            var existing = await db.Territories.OrderBy(t => t.Id).Select(t => (int?)t.Id).FirstOrDefaultAsync();
            if (existing != null)
                return existing.Value;

            var territory = new Territory
            {
                Name = string.IsNullOrWhiteSpace(seed.Territory) ? "Pittsburgh" : seed.Territory.Trim(),
                IsActive = true,
            };
            db.Territories.Add(territory);
            await db.SaveChangesAsync();
            return territory.Id;
        }

        /// <summary>
        /// Creates an opening event, in the first territory, so the floor app has somewhere to write
        /// orders.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="seed">Parsed seed file</param>
        private static async Task SeedEventAsync(ApplicationDbContext db, SeedFile seed)
        {
            if (await db.Events.AnyAsync() || seed.Event == null)
                return;

            var territoryId = await SeedTerritoryAsync(db, seed);

            db.Events.Add(new Event
            {
                TerritoryId = territoryId,
                Organization = seed.Event.Organization ?? "New Fundraiser",
                CartName = seed.Event.CartName,
                EventDate = DateTime.Today,
                SalesTaxRate = seed.Event.SalesTaxRate ?? 0.07m,
                CcProcessingFeeRate = seed.Event.CcProcessingFeeRate ?? 0.02m,
                NextOrderNumber = seed.Event.NextOrderNumber ?? 1001,
                IsActive = true,
            });

            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Creates any delivery option that is not already in the territory's catalog.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="seed">Parsed seed file</param>
        /// <param name="territoryId">The territory the sample catalog belongs to</param>
        /// <returns>Lookup of delivery option by name.</returns>
        private static async Task<Dictionary<string, DeliveryOption>> SeedDeliveryOptionsAsync(
            ApplicationDbContext db, SeedFile seed, int territoryId)
        {
            var existing = await db.DeliveryOptions
                .Where(d => d.TerritoryId == territoryId)
                .ToDictionaryAsync(d => d.Name, StringComparer.OrdinalIgnoreCase);

            if (seed.DeliveryOptions != null)
            {
                foreach (var d in seed.DeliveryOptions)
                {
                    if (string.IsNullOrWhiteSpace(d.Name) || existing.ContainsKey(d.Name))
                        continue;

                    var option = new DeliveryOption
                    {
                        TerritoryId = territoryId,
                        Name = d.Name,
                        Price = d.Price ?? 0m,
                        IsTaxable = d.IsTaxable ?? true,
                        IsTakeWith = d.IsTakeWith ?? false,
                        ShowOnSalesSheet = d.ShowOnSalesSheet ?? true,
                        SortOrder = d.SortOrder ?? 0,
                        IsActive = true,
                    };

                    db.DeliveryOptions.Add(option);
                    existing[d.Name] = option;
                }

                await db.SaveChangesAsync();
            }

            return existing;
        }

        /// <summary>
        /// Creates any product that is not already present, along with its variants and
        /// delivery availability.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="seed">Parsed seed file</param>
        /// <param name="deliveryByName">Delivery option lookup</param>
        /// <param name="territoryId">The territory the sample catalog belongs to</param>
        private static async Task<List<(SeedProduct Seed, Product Entity)>> SeedProductsAsync(
            ApplicationDbContext db, SeedFile seed, Dictionary<string, DeliveryOption> deliveryByName, int territoryId)
        {
            var created = new List<(SeedProduct Seed, Product Entity)>();

            if (seed.Products == null)
                return created;

            var existingNames = await db.Products
                .Where(p => p.TerritoryId == territoryId)
                .Select(p => p.Name + "|" + p.Brand)
                .ToListAsync();

            var known = new HashSet<string>(existingNames, StringComparer.OrdinalIgnoreCase);

            foreach (var p in seed.Products)
            {
                if (string.IsNullOrWhiteSpace(p.Name))
                    continue;

                var key = p.Name + "|" + (p.Brand ?? string.Empty);
                if (!known.Add(key))
                    continue;

                var product = new Product
                {
                    TerritoryId = territoryId,
                    Name = p.Name,
                    Brand = p.Brand ?? string.Empty,
                    Category = Enum.TryParse<ProductCategory>(p.Category, true, out var category)
                        ? category
                        : ProductCategory.Misc,
                    Notes = p.Notes,
                    SortOrder = p.SortOrder ?? 0,
                    IsActive = true,
                    TrackInventory = p.TrackInventory ?? false,
                    HasWarranty = p.HasWarranty ?? api.Controllers.ProductController.WarrantyByDefault(category),
                    WarrantyLength = p.WarrantyLength,
                };

                if (p.Variants != null)
                {
                    foreach (var v in p.Variants)
                    {
                        product.Variants.Add(new ProductVariant
                        {
                            Size = v.Size ?? string.Empty,
                            Configuration = v.Configuration,
                            Price = v.Price,
                            SortOrder = v.SortOrder ?? 0,
                            IsActive = true,
                            Notes = v.Notes,
                        });
                    }
                }

                if (p.DeliveryOptions != null)
                {
                    foreach (var name in p.DeliveryOptions)
                    {
                        if (!deliveryByName.TryGetValue(name, out var option))
                            continue;

                        product.DeliveryOptions.Add(new ProductDeliveryOption
                        {
                            DeliveryOption = option,
                            IsDefault = string.Equals(name, p.DefaultDelivery, StringComparison.OrdinalIgnoreCase),
                        });
                    }
                }

                db.Products.Add(product);
                created.Add((p, product));
            }

            await db.SaveChangesAsync();
            return created;
        }

        /// <summary>
        /// Links each newly seeded bundle variant to the items it includes, matched by product
        /// name and size. Only products created in this run are touched, so a catalog an admin
        /// has already edited is never rewritten.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="created">Seed products created in this run, with their entities</param>
        /// <param name="territoryId">The territory the sample catalog belongs to</param>
        private static async Task SeedBundlesAsync(ApplicationDbContext db, List<(SeedProduct Seed, Product Entity)> created, int territoryId)
        {
            var wanted = created
                .SelectMany(c => (c.Seed.Variants ?? new List<SeedVariant>())
                    .Where(v => v.Includes is { Count: > 0 })
                    .Select(v => (Entity: c.Entity, Seed: v)))
                .ToList();

            if (wanted.Count == 0)
                return;

            var names = wanted.SelectMany(w => w.Seed.Includes!).Select(i => i.Product).Distinct().ToList();
            var components = await db.ProductVariants
                .Include(v => v.Product)
                .Where(v => v.Product != null && v.Product.TerritoryId == territoryId && names.Contains(v.Product.Name))
                .ToListAsync();

            foreach (var (entity, seedVariant) in wanted)
            {
                var bundle = entity.Variants.FirstOrDefault(v =>
                    v.Size == (seedVariant.Size ?? string.Empty)
                    && v.Configuration == seedVariant.Configuration);

                if (bundle == null)
                    continue;

                foreach (var include in seedVariant.Includes!)
                {
                    var component = components.FirstOrDefault(v =>
                        string.Equals(v.Product!.Name, include.Product, StringComparison.OrdinalIgnoreCase)
                        && string.Equals(v.Size, include.Size, StringComparison.OrdinalIgnoreCase));

                    if (component == null || component.ProductId == entity.Id)
                        continue;

                    bundle.Components.Add(new ProductVariantComponent
                    {
                        ComponentVariantId = component.Id,
                        Quantity = Math.Max(1, include.Quantity ?? 1),
                    });
                }
            }

            await db.SaveChangesAsync();
        }

        #endregion

        #region Private Class

        /// <summary>
        /// Root of CatalogSeed.json.
        /// </summary>
        private class SeedFile
        {
            /// <summary>Delivery and service options.</summary>
            public List<SeedDelivery>? DeliveryOptions { get; set; }

            /// <summary>Catalog products.</summary>
            public List<SeedProduct>? Products { get; set; }

            /// <summary>Opening event.</summary>
            public SeedEvent? Event { get; set; }

            /// <summary>Name of the first territory, used when the database has none.</summary>
            public string? Territory { get; set; }

            /// <summary>Pre-provisioned crew accounts.</summary>
            public List<SeedUser>? Users { get; set; }
        }

        /// <summary>
        /// A delivery option in the seed file.
        /// </summary>
        private class SeedDelivery
        {
            /// <summary>Option name.</summary>
            public string? Name { get; set; }

            /// <summary>Default charge.</summary>
            public decimal? Price { get; set; }

            /// <summary>Whether the charge is taxable.</summary>
            public bool? IsTaxable { get; set; }

            /// <summary>Whether the option ticks Take With.</summary>
            public bool? IsTakeWith { get; set; }

            /// <summary>Whether its row prints on the sales sheet.</summary>
            public bool? ShowOnSalesSheet { get; set; }

            /// <summary>Display order.</summary>
            public int? SortOrder { get; set; }
        }

        /// <summary>
        /// A product in the seed file.
        /// </summary>
        private class SeedProduct
        {
            /// <summary>Model name.</summary>
            public string? Name { get; set; }

            /// <summary>Manufacturer.</summary>
            public string? Brand { get; set; }

            /// <summary>Category enum name.</summary>
            public string? Category { get; set; }

            /// <summary>Sales notes.</summary>
            public string? Notes { get; set; }

            /// <summary>Display order.</summary>
            public int? SortOrder { get; set; }

            /// <summary>Priced size/configuration rows.</summary>
            public List<SeedVariant>? Variants { get; set; }

            /// <summary>Names of the delivery options offered.</summary>
            public List<string>? DeliveryOptions { get; set; }

            /// <summary>Name of the preselected delivery option.</summary>
            public string? DefaultDelivery { get; set; }

            /// <summary>Whether on-hand stock is counted for this product.</summary>
            public bool? TrackInventory { get; set; }

            /// <summary>Whether the product has a manufacturer warranty; by category when left out.</summary>
            public bool? HasWarranty { get; set; }

            /// <summary>How long the warranty lasts.</summary>
            public string? WarrantyLength { get; set; }
        }

        /// <summary>
        /// A priced variant in the seed file.
        /// </summary>
        private class SeedVariant
        {
            /// <summary>Size label.</summary>
            public string? Size { get; set; }

            /// <summary>Configuration label.</summary>
            public string? Configuration { get; set; }

            /// <summary>Price, null when the card says Inquire.</summary>
            public decimal? Price { get; set; }

            /// <summary>Items bundled with this variant, by product name and size.</summary>
            public List<SeedComponent>? Includes { get; set; }

            /// <summary>Display order.</summary>
            public int? SortOrder { get; set; }

            /// <summary>A note shown to the rep when this size is picked.</summary>
            public string? Notes { get; set; }
        }

        /// <summary>
        /// One bundled item in the seed file.
        /// </summary>
        private class SeedComponent
        {
            /// <summary>Name of the product that comes with the bundle.</summary>
            public string? Product { get; set; }

            /// <summary>Which size of it.</summary>
            public string? Size { get; set; }

            /// <summary>How many come with one bundle.</summary>
            public int? Quantity { get; set; }
        }

        /// <summary>
        /// The opening event in the seed file.
        /// </summary>
        private class SeedEvent
        {
            /// <summary>Organization.</summary>
            public string? Organization { get; set; }

            /// <summary>Cart name.</summary>
            public string? CartName { get; set; }

            /// <summary>Sales tax rate.</summary>
            public decimal? SalesTaxRate { get; set; }

            /// <summary>Card processing fee rate.</summary>
            public decimal? CcProcessingFeeRate { get; set; }

            /// <summary>First order number.</summary>
            public int? NextOrderNumber { get; set; }
        }

        /// <summary>
        /// A crew account in the seed file.
        /// </summary>
        private class SeedUser
        {
            /// <summary>Display name.</summary>
            public string? Name { get; set; }

            /// <summary>Login handle.</summary>
            public string? Username { get; set; }

            /// <summary>Role name.</summary>
            public string? Role { get; set; }
        }

        #endregion
    }
}
