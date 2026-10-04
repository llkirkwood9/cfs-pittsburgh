using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Data
{
    /// <summary>
    /// Single EF Core context for the CFS fundraiser database.
    /// </summary>
    public class ApplicationDbContext(DbContextOptions options) : DbContext(options)
    {
        #region Sets

        /// <summary>
        /// Fundraiser events
        /// </summary>
        public DbSet<Event> Events => Set<Event>();

        /// <summary>
        /// Catalog products
        /// </summary>
        public DbSet<Product> Products => Set<Product>();

        /// <summary>
        /// Priced size/configuration rows
        /// </summary>
        public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();

        /// <summary>
        /// Items bundled with a variant at no extra charge
        /// </summary>
        public DbSet<ProductVariantComponent> ProductVariantComponents => Set<ProductVariantComponent>();

        /// <summary>
        /// Delivery and in-home service options
        /// </summary>
        public DbSet<DeliveryOption> DeliveryOptions => Set<DeliveryOption>();

        /// <summary>
        /// Per-product delivery availability and price overrides
        /// </summary>
        public DbSet<ProductDeliveryOption> ProductDeliveryOptions => Set<ProductDeliveryOption>();

        /// <summary>
        /// Customer orders
        /// </summary>
        public DbSet<Order> Orders => Set<Order>();

        /// <summary>
        /// Order line items
        /// </summary>
        public DbSet<OrderLine> OrderLines => Set<OrderLine>();

        /// <summary>
        /// Order payment rows
        /// </summary>
        public DbSet<OrderPayment> OrderPayments => Set<OrderPayment>();

        /// <summary>
        /// Crew accounts
        /// </summary>
        public DbSet<User> Users => Set<User>();

        /// <summary>
        /// Every change to an on-hand count, for the audit trail and the event inventory sheet
        /// </summary>
        public DbSet<InventoryAdjustment> InventoryAdjustments => Set<InventoryAdjustment>();

        /// <summary>
        /// Selections a product offers beyond size, such as Color
        /// </summary>
        public DbSet<ProductOption> ProductOptions => Set<ProductOption>();

        /// <summary>
        /// The choices for each selection
        /// </summary>
        public DbSet<ProductOptionChoice> ProductOptionChoices => Set<ProductOptionChoice>();

        /// <summary>
        /// Settings an administrator can change from the dashboard
        /// </summary>
        public DbSet<AppSetting> AppSettings => Set<AppSetting>();

        /// <summary>
        /// Sales territories
        /// </summary>
        public DbSet<Territory> Territories => Set<Territory>();

        /// <summary>
        /// On-hand counts, per territory and size
        /// </summary>
        public DbSet<InventoryStock> InventoryStocks => Set<InventoryStock>();

        /// <summary>
        /// Settings a territory has changed from the company-wide value
        /// </summary>
        public DbSet<TerritorySetting> TerritorySettings => Set<TerritorySetting>();

        /// <summary>
        /// Signed-in devices, by hashed refresh token
        /// </summary>
        public DbSet<UserSession> UserSessions => Set<UserSession>();

        #endregion

        #region Public Methods

        /// <summary>
        /// Configures relationships, delete behavior, decimal precision and indexes.
        /// </summary>
        /// <param name="modelBuilder">EF model builder</param>
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Money is stored as decimal(18,2) everywhere so totals never drift.
            foreach (var property in modelBuilder.Model.GetEntityTypes()
                         .SelectMany(t => t.GetProperties())
                         .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            {
                property.SetColumnType("decimal(18,4)");
            }

            modelBuilder.Entity<Territory>(entity =>
            {
                entity.HasIndex(t => t.Name).IsUnique();
            });

            modelBuilder.Entity<Event>(entity =>
            {
                entity.HasIndex(e => e.EventDate);
                entity.HasIndex(e => new { e.TerritoryId, e.IsActive });

                // A territory with events can't be deleted - it's deactivated instead.
                entity.HasOne(e => e.Territory)
                    .WithMany()
                    .HasForeignKey(e => e.TerritoryId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Product>(entity =>
            {
                entity.HasIndex(p => new { p.Category, p.SortOrder });
                entity.HasIndex(p => p.TerritoryId);

                entity.HasOne(p => p.Territory)
                    .WithMany()
                    .HasForeignKey(p => p.TerritoryId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasMany(p => p.Variants)
                    .WithOne(v => v.Product)
                    .HasForeignKey(v => v.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasMany(p => p.DeliveryOptions)
                    .WithOne(d => d.Product)
                    .HasForeignKey(d => d.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ProductOption>(entity =>
            {
                entity.HasIndex(o => new { o.ProductId, o.SortOrder });

                entity.HasOne(o => o.Product)
                    .WithMany(p => p.Options)
                    .HasForeignKey(o => o.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasMany(o => o.Choices)
                    .WithOne(c => c.ProductOption)
                    .HasForeignKey(c => c.ProductOptionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ProductVariantComponent>(entity =>
            {
                entity.HasIndex(c => new { c.BundleVariantId, c.ComponentVariantId }).IsUnique();

                // Removing a bundle variant removes its component list with it.
                entity.HasOne(c => c.BundleVariant)
                    .WithMany(v => v.Components)
                    .HasForeignKey(c => c.BundleVariantId)
                    .OnDelete(DeleteBehavior.Cascade);

                // A second cascade path into ProductVariants is refused by SQL Server, and a
                // component still in use by a bundle should not vanish silently anyway.
                entity.HasOne(c => c.ComponentVariant)
                    .WithMany()
                    .HasForeignKey(c => c.ComponentVariantId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<DeliveryOption>(entity =>
            {
                entity.HasOne(d => d.Territory)
                    .WithMany()
                    .HasForeignKey(d => d.TerritoryId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<InventoryStock>(entity =>
            {
                entity.HasIndex(s => new { s.TerritoryId, s.ProductVariantId, s.StockKey }).IsUnique();

                entity.HasOne(s => s.ProductVariant)
                    .WithMany(v => v.Stock)
                    .HasForeignKey(s => s.ProductVariantId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(s => s.Territory)
                    .WithMany()
                    .HasForeignKey(s => s.TerritoryId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<TerritorySetting>(entity =>
            {
                entity.HasIndex(s => new { s.TerritoryId, s.Key }).IsUnique();

                entity.HasOne(s => s.Territory)
                    .WithMany()
                    .HasForeignKey(s => s.TerritoryId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<UserSession>(entity =>
            {
                entity.HasIndex(s => s.TokenHash).IsUnique();
                entity.HasIndex(s => s.UserId);

                entity.HasOne(s => s.User)
                    .WithMany()
                    .HasForeignKey(s => s.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ProductDeliveryOption>(entity =>
            {
                entity.HasIndex(p => new { p.ProductId, p.DeliveryOptionId }).IsUnique();

                entity.HasOne(p => p.DeliveryOption)
                    .WithMany(d => d.Products)
                    .HasForeignKey(p => p.DeliveryOptionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Order>(entity =>
            {
                entity.HasIndex(o => new { o.EventId, o.OrderNumber }).IsUnique();
                entity.HasIndex(o => o.Status);

                entity.HasOne(o => o.Event)
                    .WithMany(e => e.Orders)
                    .HasForeignKey(o => o.EventId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasMany(o => o.Lines)
                    .WithOne(l => l.Order)
                    .HasForeignKey(l => l.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasMany(o => o.Payments)
                    .WithOne(p => p.Order)
                    .HasForeignKey(p => p.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Restrict rather than SetNull: SQL Server refuses two nullable FKs from Orders
                // to Users as separate cascade paths, and accounts are deactivated, never deleted.
                entity.HasOne(o => o.CreatedByUser)
                    .WithMany()
                    .HasForeignKey(o => o.CreatedByUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(o => o.CompletedByUser)
                    .WithMany()
                    .HasForeignKey(o => o.CompletedByUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<OrderLine>(entity =>
            {
                // Catalog rows must survive a product being retired, so these are Restrict rather
                // than Cascade - deleting a product never deletes sales history. The catalog
                // controllers archive anything that has already been sold instead of removing it.
                entity.HasOne(l => l.ProductVariant)
                    .WithMany()
                    .HasForeignKey(l => l.ProductVariantId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(l => l.DeliveryOption)
                    .WithMany()
                    .HasForeignKey(l => l.DeliveryOptionId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<InventoryAdjustment>(entity =>
            {
                entity.HasIndex(a => new { a.ProductVariantId, a.CreatedAt });
                entity.HasIndex(a => a.EventId);
                entity.HasIndex(a => new { a.TerritoryId, a.ProductVariantId });

                entity.HasOne(a => a.ProductVariant)
                    .WithMany()
                    .HasForeignKey(a => a.ProductVariantId)
                    .OnDelete(DeleteBehavior.Cascade);

                // A discarded draft never has adjustments, but keep the history if an order row
                // is ever removed.
                entity.HasOne(a => a.Order)
                    .WithMany()
                    .HasForeignKey(a => a.OrderId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(a => a.User)
                    .WithMany()
                    .HasForeignKey(a => a.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(u => u.Username).IsUnique();

                entity.HasOne(u => u.Territory)
                    .WithMany()
                    .HasForeignKey(u => u.TerritoryId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
        }

        #endregion
    }
}
