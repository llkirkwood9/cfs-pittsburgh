using Microsoft.EntityFrameworkCore;

namespace api.Data
{
    /// <summary>
    /// The same model on PostgreSQL, for hosts where SQL Server cannot run - a Raspberry Pi, for
    /// one. It exists so the two providers can keep their own migrations side by side: EF only
    /// applies migrations whose context type matches, so the SQL Server migrations stay with
    /// <see cref="ApplicationDbContext"/> and the PostgreSQL ones with this.
    /// </summary>
    /// <param name="options">Context options built with UseNpgsql</param>
    public class PostgresDbContext(DbContextOptions<PostgresDbContext> options) : ApplicationDbContext(options)
    {
        #region Public Methods

        /// <summary>
        /// Applies the shared model, then the PostgreSQL specifics.
        /// </summary>
        /// <param name="modelBuilder">Model builder</param>
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // The shared model asks for decimal(18,4); numeric is the PostgreSQL spelling and
            // keeps money exact, as it is on SQL Server.
            foreach (var property in modelBuilder.Model.GetEntityTypes()
                         .SelectMany(t => t.GetProperties())
                         .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            {
                property.SetColumnType("numeric(18,4)");
            }
        }

        #endregion
    }
}
