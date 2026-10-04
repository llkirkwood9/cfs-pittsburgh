using api.Models;
using api.Services;

namespace api.Utils
{
    /// <summary>
    /// Setting a user's password, shared by the sign-in, crew and seeding code.
    /// </summary>
    public static class Passwords
    {
        /// <summary>
        /// Sets a user's password. One set by someone else must be changed at the next sign-in.
        /// Any old PIN is wiped, and a lockout cleared. The caller ends sessions as appropriate and
        /// saves.
        /// </summary>
        /// <param name="tokens">Hashing</param>
        /// <param name="user">The account</param>
        /// <param name="password">The new password, already checked against the policy</param>
        /// <param name="mustChange">Whether they must choose their own at the next sign-in</param>
        public static void Set(TokenService tokens, User user, string password, bool mustChange)
        {
            user.PasswordHash = tokens.HashPassword(user, password);
            user.PasswordChangedAt = DateTime.UtcNow;
            user.MustChangePassword = mustChange;
            user.FailedLoginCount = 0;
            user.LockoutUntil = null;
            user.PinHash = string.Empty;
            user.PinSalt = string.Empty;
        }
    }
}
