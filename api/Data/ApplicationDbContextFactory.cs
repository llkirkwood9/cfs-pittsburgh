using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace api.Data
{
    /// <summary>
    /// Lets "dotnet ef" build the context without starting the app or reaching a live server, so
    /// migrations can be created anywhere:
    ///
    ///   dotnet ef migrations add Name
    ///
    /// Set CFS_POSTGRES_CONNECTION to point "dotnet ef database update" at a particular server.
    /// </summary>
    public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        #region Public Methods

        /// <summary>
        /// Builds a context pointed at the design-time connection string.
        /// </summary>
        /// <param name="args">Unused</param>
        /// <returns>The context.</returns>
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

            var connection = Environment.GetEnvironmentVariable("CFS_POSTGRES_CONNECTION")
                             ?? "Host=localhost;Port=5432;Database=CfsFundraiser;Username=cfs;Password=cfs-dev";

            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(connection)
                .Options;

            return new ApplicationDbContext(options);
        }

        #endregion
    }
}
