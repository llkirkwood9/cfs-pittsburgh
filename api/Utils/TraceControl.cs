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

        /// <summary>
        /// How many distinct messages are remembered before old ones are forgotten.
        /// </summary>
        private const int PruneAbove = 1000;

        /// <summary>
        /// How long a message with repeats still to report is remembered, so the count isn't lost
        /// to an early prune.
        /// </summary>
        private static readonly TimeSpan KeepSuppressedFor = TimeSpan.FromHours(1);

        /// <summary>
        /// When old messages were last forgotten, as ticks.
        /// </summary>
        private static long _lastPruneTicks;

        /// <summary>
        /// The logger for code that has none of its own, set at startup.
        /// </summary>
        private static ILogger? _defaultLogger;

        #endregion

        #region Public Methods

        /// <summary>
        /// Sets the logger used by Trace calls that don't pass one. Called once at startup.
        /// </summary>
        /// <param name="logger">The logger</param>
        public static void UseDefaultLogger(ILogger logger) => _defaultLogger = logger;

        /// <summary>
        /// Writes a trace through the default logger (see UseDefaultLogger); does nothing before
        /// one is set.
        /// </summary>
        /// <param name="source">Which component is tracing</param>
        /// <param name="eventType">Severity</param>
        /// <param name="message">Message to trace</param>
        public static void Trace(TraceControlSource source, TraceEventType eventType, string message)
        {
            if (_defaultLogger is { } logger)
                Trace(source, eventType, logger, message);
        }

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
            Prune(now);
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Forgets messages last written longer ago than the suppression window once too many are
        /// remembered, at most once a window. One with repeats still to report is kept a while longer.
        /// </summary>
        /// <param name="now">The current time</param>
        private static void Prune(DateTime now)
        {
            if (Duplicates.Count <= PruneAbove)
                return;

            var last = Interlocked.Read(ref _lastPruneTicks);
            if (now.Ticks - last < SuppressionWindow.Ticks
                || Interlocked.CompareExchange(ref _lastPruneTicks, now.Ticks, last) != last)
                return;

            foreach (var (key, state) in Duplicates)
            {
                var age = now - state.LastWritten;
                if (age > SuppressionWindow && (state.SuppressedCount == 0 || age > KeepSuppressedFor))
                    Duplicates.TryRemove(key, out _);
            }
        }

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
