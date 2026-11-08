namespace api.Utils
{
    /// <summary>
    /// The key stock is kept under for a combination of counted choices: "selection:choice" pairs
    /// by selection id, in selection id order, joined with "|" - e.g. "4:12|7:30". A size counted
    /// on its own uses the empty key.
    /// </summary>
    public static class StockKeys
    {
        /// <summary>
        /// The key for some selection and choice pairs.
        /// </summary>
        /// <param name="pairs">Selection id and choice id pairs, in any order</param>
        /// <returns>The key; empty for none.</returns>
        public static string Build(IEnumerable<(int OptionId, int ChoiceId)> pairs) =>
            string.Join("|", pairs.OrderBy(p => p.OptionId).Select(p => $"{p.OptionId}:{p.ChoiceId}"));

        /// <summary>
        /// The pairs in a key, one per part; a part that isn't a valid pair comes back null.
        /// </summary>
        /// <param name="key">A non-empty key</param>
        /// <returns>Each part's selection and choice ids, or null.</returns>
        public static IEnumerable<(int OptionId, int ChoiceId)?> Parts(string key) =>
            key.Split('|').Select(part =>
            {
                var bits = part.Split(':');
                return bits.Length == 2 && int.TryParse(bits[0], out var optionId) && int.TryParse(bits[1], out var choiceId)
                    ? ((int, int)?)(optionId, choiceId)
                    : null;
            });

        /// <summary>
        /// Whether a key counts one of a selection's choices.
        /// </summary>
        /// <param name="key">The key</param>
        /// <param name="optionId">The selection</param>
        /// <returns>True when a part of the key is for that selection.</returns>
        public static bool Mentions(string key, int optionId)
        {
            var marker = $"{optionId}:";
            return key.Split('|').Any(part => part.StartsWith(marker));
        }
    }
}
