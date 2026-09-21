using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Data
{
    /// <summary>
    /// Single EF Core context for the CFS fundraiser database.
    /// </summary>
    public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
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

            modelBuilder.Entity<Event>(entity =>
            {
                entity.HasIndex(e => e.EventDate);
            });

            modelBuilder.Entity<Product>(entity =>
            {
                entity.HasIndex(p => new { p.Category, p.SortOrder });

                entity.HasMany(p => p.Variants)
                    .WithOne(v => v.Product)
                    .HasForeignKey(v => v.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasMany(p => p.DeliveryOptions)
                    .WithOne(d => d.Product)
                    .HasForeignKey(d => d.ProductId)
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

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(u => u.Username).IsUnique();
            });
        }

        #endregion
    }
}
