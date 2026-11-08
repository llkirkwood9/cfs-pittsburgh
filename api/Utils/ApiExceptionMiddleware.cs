using System.Diagnostics;

namespace api.Utils
{
    /// <summary>
    /// Turns any exception an endpoint doesn't handle itself into a 500 with one message for the
    /// user, and traces it. The exception's own text is only included when running in Development -
    /// in production it could reveal how the server is put together.
    /// </summary>
    public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger, IWebHostEnvironment environment)
    {
        /// <summary>The message every unhandled failure answers with.</summary>
        public const string Message = "Internal error occurred.";

        /// <summary>
        /// Runs the rest of the pipeline, answering 500 if it throws before the response has started.
        /// </summary>
        /// <param name="context">The request</param>
        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await next(context);
            }
            catch (Exception exception) when (!context.Response.HasStarted)
            {
                TraceControl.Trace(TraceControlSource.Api, TraceEventType.Critical, logger, exception.ToString());

                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                if (environment.IsDevelopment())
                    await context.Response.WriteAsJsonAsync(new { error = Message, exception = exception.Message });
                else
                    await context.Response.WriteAsJsonAsync(new { error = Message });
            }
        }
    }
}
