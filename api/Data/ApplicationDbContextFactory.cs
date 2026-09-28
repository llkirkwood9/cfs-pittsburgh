using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace api.Data
{
    /// <summary>
    /// Lets "dotnet ef" build the SQL Server context directly. Without it, EF resolves
    /// ApplicationDbContext through the PostgreSQL factory (PostgresDbContext derives from it) and
    /// writes PostgreSQL migrations into the SQL Server set:
    ///
    ///   dotnet ef migrations add Name --context ApplicationDbContext
    /// </summary>
    public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        #region Public Methods

        /// <summary>
        /// Builds a SQL Server context pointed at the design-time connection string.
        /// </summary>
        /// <param name="args">Unused</param>
        /// <returns>The context.</returns>
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var connection = Environment.GetEnvironmentVariable("CFS_SQLSERVER_CONNECTION")
                             ?? @"Server=(localdb)\MSSQLLocalDB;Database=CfsFundraiser;Trusted_Connection=True;TrustServerCertificate=True";

            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseSqlServer(connection)
                .Options;

            return new ApplicationDbContext(options);
        }

        #endregion
    }
}
