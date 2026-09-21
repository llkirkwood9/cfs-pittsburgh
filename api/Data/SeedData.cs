using System.Text.Json;
using api.Models;
using api.Services;
using Microsoft.EntityFrameworkCore;

namespace api.Data
{
    /// <summary>
    /// Loads the starting catalog, delivery options, crew accounts and opening event from
    /// CatalogSeed.json. Runs on every startup but only fills gaps, so an event in progress is
    /// never overwritten.
    /// </summary>
    public static class SeedData
    {
        #region Public Methods

        /// <summary>
        /// Seeds anything that is missing.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="tokenService">Used to hash the seeded PINs</param>
        public static async Task SeedAsync(ApplicationDbContext db, TokenService tokenService)
        {
            var path = Path.Combine(AppContext.BaseDirectory, "Data", "CatalogSeed.json");
            if (!File.Exists(path))
                return;

            await using var stream = File.OpenRead(path);
            var seed = await JsonSerializer.DeserializeAsync<SeedFile>(stream, JsonOptions);
            if (seed == null)
                return;

            await SeedUsersAsync(db, tokenService, seed);
            await SeedEventAsync(db, seed);
            var deliveryByName = await SeedDeliveryOptionsAsync(db, seed);
            await SeedProductsAsync(db, seed, deliveryByName);
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
        /// Creates the pre-provisioned crew accounts when none exist.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="tokenService">PIN hashing</param>
        /// <param name="seed">Parsed seed file</param>
        private static async Task SeedUsersAsync(ApplicationDbContext db, TokenService tokenService, SeedFile seed)
        {
            if (await db.Users.AnyAsync() || seed.Users == null)
                return;

            foreach (var u in seed.Users)
            {
                if (string.IsNullOrWhiteSpace(u.Username) || string.IsNullOrWhiteSpace(u.Pin))
                    continue;

                var salt = tokenService.CreateSalt();
                db.Users.Add(new User
                {
                    Name = u.Name ?? u.Username,
                    Username = u.Username,
                    PinSalt = salt,
                    PinHash = tokenService.HashPin(u.Pin, salt),
                    Role = Enum.TryParse<UserRole>(u.Role, true, out var role) ? role : UserRole.Sales,
                    IsActive = true,
                });
            }

            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Creates an opening event so the floor app has somewhere to write orders.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="seed">Parsed seed file</param>
        private static async Task SeedEventAsync(ApplicationDbContext db, SeedFile seed)
        {
            if (await db.Events.AnyAsync() || seed.Event == null)
                return;

            db.Events.Add(new Event
            {
                SchoolName = seed.Event.SchoolName ?? "New Event",
                Organization = seed.Event.Organization ?? string.Empty,
                CartName = seed.Event.CartName,
                EventDate = DateTime.Today,
                SalesTaxRate = seed.Event.SalesTaxRate ?? 0.07m,
                CcProcessingFeeRate = seed.Event.CcProcessingFeeRate ?? 0m,
                NextOrderNumber = seed.Event.NextOrderNumber ?? 1001,
                IsActive = true,
            });

            await db.SaveChangesAsync();
        }

        /// <summary>
        /// Creates any delivery option that is not already present.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="seed">Parsed seed file</param>
        /// <returns>Lookup of delivery option by name.</returns>
        private static async Task<Dictionary<string, DeliveryOption>> SeedDeliveryOptionsAsync(
            ApplicationDbContext db, SeedFile seed)
        {
            var existing = await db.DeliveryOptions.ToDictionaryAsync(d => d.Name, StringComparer.OrdinalIgnoreCase);

            if (seed.DeliveryOptions != null)
            {
                foreach (var d in seed.DeliveryOptions)
                {
                    if (string.IsNullOrWhiteSpace(d.Name) || existing.ContainsKey(d.Name))
                        continue;

                    var option = new DeliveryOption
                    {
                        Name = d.Name,
                        Price = d.Price ?? 0m,
                        IsTaxable = d.IsTaxable ?? true,
                        IsTakeWith = d.IsTakeWith ?? false,
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
        private static async Task SeedProductsAsync(
            ApplicationDbContext db, SeedFile seed, Dictionary<string, DeliveryOption> deliveryByName)
        {
            if (seed.Products == null)
                return;

            var existingNames = await db.Products
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
                    Name = p.Name,
                    Brand = p.Brand ?? string.Empty,
                    Category = Enum.TryParse<ProductCategory>(p.Category, true, out var category)
                        ? category
                        : ProductCategory.Misc,
                    Notes = p.Notes,
                    SortOrder = p.SortOrder ?? 0,
                    IsActive = true,
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
                            IncludesAdjustableBase = v.IncludesAdjustableBase ?? false,
                            SortOrder = v.SortOrder ?? 0,
                            IsActive = true,
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

            /// <summary>Whether the price includes an adjustable base.</summary>
            public bool? IncludesAdjustableBase { get; set; }

            /// <summary>Display order.</summary>
            public int? SortOrder { get; set; }
        }

        /// <summary>
        /// The opening event in the seed file.
        /// </summary>
        private class SeedEvent
        {
            /// <summary>School name.</summary>
            public string? SchoolName { get; set; }

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

            /// <summary>Starting PIN.</summary>
            public string? Pin { get; set; }

            /// <summary>Role name.</summary>
            public string? Role { get; set; }
        }

        #endregion
    }
}
