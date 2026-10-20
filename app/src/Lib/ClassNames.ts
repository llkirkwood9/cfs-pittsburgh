/**
 * Joins class names, skipping empty ones.
 * @param parts Class strings, or false/null/undefined to skip.
 * @returns The joined classes.
 */
export const cx = (...parts: (string | false | null | undefined)[]): string =>
    parts.filter(Boolean).join(" ");

/**
 * Whether a caller's classes already set a text colour. NativeWind, like Tailwind on the
 * dashboard, orders colours by the stylesheet rather than by class order, so a default colour
 * would win over the caller's; a component leaves its default off when this is true.
 * @param className The caller's classes.
 * @returns True when a text colour is given.
 */
export const HasTextColor = (className = ""): boolean =>
    /(^|\s)text-(white|black|transparent|current|[a-z]+-\d{2,3})(\/\d+)?(\s|$)/.test(className);

/**
 * Whether a caller's classes already set a background colour (see HasTextColor).
 * @param className The caller's classes.
 * @returns True when a background colour is given.
 */
export const HasBackground = (className = ""): boolean => /(^|\s)bg-/.test(className);

/**
 * Whether a caller's classes already set a font size.
 * @param className The caller's classes.
 * @returns True when a size is given.
 */
export const HasTextSize = (className = ""): boolean =>
    /(^|\s)text-(xs|sm|base|lg|xl|\d?xl|\[[^\]]+\])(\s|$)/.test(className);
