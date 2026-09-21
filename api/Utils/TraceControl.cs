using System.Collections.Concurrent;
using System.Diagnostics;

namespace api.Utils
{
    /// <summary>
    /// Which part of the solution a trace came from.
    /// </summary>
    public enum TraceControlSource
    {
        /// <summary>The Web API.</summary>
        Api = 0,

        /// <summary>Background or seeding work.</summary>
        Seed = 1,
    }

    /// <summary>
    /// Single static tracing facade over ILogger. Collapses repeated identical messages so a
    /// failing tablet on the floor cannot flood the log, and annotates Error/Critical traces with
    /// the calling stack frame.
    /// </summary>
    public static class TraceControl
    {
        #region Private Fields

        /// <summary>
        /// Last time each distinct message was emitted, plus how many times it has repeated since.
        /// </summary>
        private static readonly ConcurrentDictionary<string, DuplicateState> Duplicates = new();

        /// <summary>
        /// How long identical messages are collapsed for.
        /// </summary>
        private static readonly TimeSpan SuppressionWindow = TimeSpan.FromSeconds(30);

        #endregion

        #region Public Methods

        /// <summary>
        /// Writes a trace, suppressing identical repeats inside the suppression window.
        /// </summary>
        /// <param name="source">Which component is tracing</param>
        /// <param name="eventType">Severity</param>
        /// <param name="logger">Logger to write through</param>
        /// <param name="message">Message to trace</param>
        public static void Trace(TraceControlSource source, TraceEventType eventType, ILogger logger, string message)
        {
            var key = $"{source}|{eventType}|{message}";
            var now = DateTime.UtcNow;

            var state = Duplicates.AddOrUpdate(
                key,
                _ => new DuplicateState { LastWritten = now, SuppressedCount = 0, ShouldWrite = true },
                (_, existing) =>
                {
                    if (now - existing.LastWritten > SuppressionWindow)
                    {
                        return new DuplicateState
                        {
                            LastWritten = now,
                            SuppressedCount = existing.SuppressedCount,
                            ShouldWrite = true,
                        };
                    }

                    return new DuplicateState
                    {
                        LastWritten = existing.LastWritten,
                        SuppressedCount = existing.SuppressedCount + 1,
                        ShouldWrite = false,
                    };
                });

            if (!state.ShouldWrite)
                return;

            var text = state.SuppressedCount > 0
                ? $"[{source}] {message} (repeated {state.SuppressedCount} time(s) while suppressed)"
                : $"[{source}] {message}";

            if (eventType is TraceEventType.Error or TraceEventType.Critical)
                text += $" | at {DescribeCaller()}";

            switch (eventType)
            {
                case TraceEventType.Critical:
                    logger.LogCritical("{Trace}", text);
                    break;
                case TraceEventType.Error:
                    logger.LogError("{Trace}", text);
                    break;
                case TraceEventType.Warning:
                    logger.LogWarning("{Trace}", text);
                    break;
                case TraceEventType.Information:
                    logger.LogInformation("{Trace}", text);
                    break;
                default:
                    logger.LogDebug("{Trace}", text);
                    break;
            }

            Duplicates[key] = new DuplicateState { LastWritten = now, SuppressedCount = 0, ShouldWrite = false };
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Finds the first stack frame outside this class for Error/Critical annotations.
        /// </summary>
        /// <returns>A "Type.Method" description, or "unknown" when no frame is available.</returns>
        private static string DescribeCaller()
        {
            try
            {
                var stack = new StackTrace(2, false);
                foreach (var frame in stack.GetFrames())
                {
                    var method = frame.GetMethod();
                    if (method?.DeclaringType == null)
                        continue;

                    if (method.DeclaringType == typeof(TraceControl))
                        continue;

                    return $"{method.DeclaringType.Name}.{method.Name}";
                }
            }
            catch
            {
                // Tracing must never be the thing that throws.
            }

            return "unknown";
        }

        #endregion

        #region Private Class

        /// <summary>
        /// Duplicate-suppression bookkeeping for a single message.
        /// </summary>
        private class DuplicateState
        {
            /// <summary>
            /// When the message was last actually written
            /// </summary>
            public DateTime LastWritten { get; init; }

            /// <summary>
            /// How many identical messages were swallowed since then
            /// </summary>
            public int SuppressedCount { get; init; }

            /// <summary>
            /// Whether this occurrence should be written out
            /// </summary>
            public bool ShouldWrite { get; init; }
        }

        #endregion
    }
}
