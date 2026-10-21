using System.Diagnostics;
using api.Data;
using api.Dtos;
using api.Services;
using api.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    /// <summary>
    /// Saving the whole catalog to a file and restoring it, for system admins only. See CatalogTransfer
    /// for how a file is matched against the catalog.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class CatalogController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        private const string SystemAdminOnly = "Only a system admin can export or restore the catalog.";

        #endregion

        #region GET Methods

        /// <summary>
        /// The whole catalog as a file: products (archived ones included) with their sizes,
        /// prices, sales, selections, bundles and delivery choices, plus the delivery options list.
        /// </summary>
        /// <returns>The catalog file.</returns>
        [HttpGet("export")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ExportCatalog()
        {
            try
            {
                if (!IsSystemAdmin())
                    return StatusCode(403, new { error = SystemAdminOnly });

                return Ok(await CatalogTransfer.ExportAsync(DB));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while exporting the catalog.", exception = e.Message });
            }
        }

        #endregion

        #region POST Methods

        /// <summary>
        /// Restores a catalog file. "update" brings matching products and delivery options in line
        /// with the file and adds the rest, leaving anything not in the file alone; "replace"
        /// permanently deletes the whole catalog first - sold items included - and rebuilds it
        /// from the file.
        /// </summary>
        /// <param name="request">The mode and the file's contents</param>
        /// <returns>What changed, with anything that couldn't be brought in.</returns>
        [HttpPost("import")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        [RequestSizeLimit(20_000_000)]
        public async Task<IActionResult> ImportCatalog([FromBody] CatalogImportDto request)
        {
            try
            {
                if (!IsSystemAdmin())
                    return StatusCode(403, new { error = SystemAdminOnly });

                if (request.Catalog == null || request.Mode is not ("update" or "replace"))
                    return BadRequest(new { error = "Missing parameter." });

                var result = await CatalogTransfer.ImportAsync(DB, request.Catalog, request.Mode == "replace", Scope.TerritoryId);

                Trace(TraceEventType.Information,
                    $"Catalog {request.Mode} by {GetCurrentUserName()}: {result.ProductsAdded} added, {result.ProductsUpdated} updated, {result.ProductsRemoved} removed.");

                return Ok(result);
            }
            catch (CatalogImportException e)
            {
                return BadRequest(new { error = e.Message });
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while restoring the catalog. Nothing was changed.", exception = e.Message });
            }
        }

        #endregion
    }
}
