/** The shortest password the server accepts, until its own rules have loaded. */
export const MIN_PASSWORD_LENGTH = 8;

/** The rules in words, until the server's own description has loaded. */
export const DEFAULT_PASSWORD_POLICY = `At least ${MIN_PASSWORD_LENGTH} characters.`;

/**
 * What is wrong with a starting password a manager sets, if anything.
 * @param password The password.
 * @returns A message for the user, or null when it will do.
 */
export const NewPasswordProblem = (password: string): string | null =>
    password.length < MIN_PASSWORD_LENGTH
        ? `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        : null;

/**
 * What is wrong with a password change, if anything.
 * @param current The current password.
 * @param next The new one.
 * @param confirm The new one typed again.
 * @param minLength The shortest password the server accepts, once its rules have loaded.
 * @returns A message for the user, or null when the change can be sent.
 */
export const PasswordChangeProblem = (
    current: string,
    next: string,
    confirm: string,
    minLength: number = MIN_PASSWORD_LENGTH
): string | null => {
    if (!current) return "Enter your current password.";
    if (next.length < minLength)
        return `The new password must be at least ${minLength} characters.`;
    if (next !== confirm) return "The new password and its confirmation don't match.";
    if (next === current) return "Choose a password different from your current one.";
    return null;
};
