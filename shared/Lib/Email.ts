/** What the email buttons say when the server has no email settings. */
export const EMAIL_NOT_SET_UP =
    "Email isn't set up on this server yet. Ask whoever runs the app to add the email settings.";

/** The most addresses one email goes to. */
const MAX_ADDRESSES = 10;

/**
 * A loose check of a comma- or semicolon-separated list of addresses, so an obvious typo is caught
 * before the server is asked; the server checks properly.
 * @param value The addresses as typed.
 * @returns True when every address looks like one, and there are 1 to 10 of them.
 */
export const LooksLikeAddresses = (value: string): boolean => {
    const parts = value
        .split(/[,;]/)
        .map((p) => p.trim())
        .filter(Boolean);
    return (
        parts.length > 0 &&
        parts.length <= MAX_ADDRESSES &&
        parts.every((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p))
    );
};
