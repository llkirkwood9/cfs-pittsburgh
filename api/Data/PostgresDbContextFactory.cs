using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace api.Data
{
    /// <summary>
    /// Lets "dotnet ef" work with the PostgreSQL context without starting the app or reaching a
    /// live server, so its migrations can be created on a Windows machine:
    ///
    ///   dotnet ef migrations add Name --context PostgresDbContext --output-dir Migrations/Postgres
    /// </summary>
    public class PostgresDbContextFactory : IDesignTimeDbContextFactory<PostgresDbContext>
    {
        #region Public Methods

        /// <summary>
        /// Builds a context pointed at the design-time connection string.
        /// </summary>
        /// <param name="args">Unused</param>
        /// <returns>The context.</returns>
        public PostgresDbContext CreateDbContext(string[] args)
        {
            AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

            var connection = Environment.GetEnvironmentVariable("CFS_POSTGRES_CONNECTION")
                             ?? "Host=localhost;Database=CfsFundraiser;Username=cfs;Password=design-time";

            var options = new DbContextOptionsBuilder<PostgresDbContext>()
                .UseNpgsql(connection)
                .Options;

            return new PostgresDbContext(options);
        }

        #endregion
    }
}
