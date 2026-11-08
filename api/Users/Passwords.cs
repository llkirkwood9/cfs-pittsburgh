using api.Data;
using api.Models;
using api.Services;
using Microsoft.EntityFrameworkCore;

namespace api.Users
{
    /// <summary>
    /// Setting a user's password: checked against the policy, stored, and every other session
    /// signed out.
    /// </summary>
    public static class Passwords
    {
        /// <summary>
        /// Gives a user a new password. It must meet the policy. One set by someone else must be
        /// changed at the next sign-in. Any old PIN is wiped and a lockout cleared, and the user's
        /// sessions are ended - all of them, or all but the one given. The caller saves.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="tokens">Hashing</param>
        /// <param name="user">The account, tracked (a new one has no sessions to end)</param>
        /// <param name="password">The new password</param>
        /// <param name="mustChange">Whether they must choose their own at the next sign-in</param>
        /// <param name="keepSessionHash">The hash of a session to keep - the device making the
        /// change - or null to end every session</param>
        /// <returns>Why the password isn't acceptable, or null once it is set.</returns>
        public static async Task<string?> ChangeAsync(ApplicationDbContext db, TokenService tokens, User user, string? password,
            bool mustChange, string? keepSessionHash = null)
        {
            var weak = PasswordPolicy.Check(password, user.Username, user.Name);
            if (weak != null)
                return weak;

            Set(tokens, user, password!, mustChange);

            if (user.Id != 0)
                await db.UserSessions
                    .Where(s => s.UserId == user.Id && (keepSessionHash == null || s.TokenHash != keepSessionHash))
                    .ExecuteDeleteAsync();

            return null;
        }

        /// <summary>
        /// Stores a password without the policy check, for the first account created on an empty
        /// database (seeding), whose password comes from configuration or is generated. Everything
        /// else uses ChangeAsync. The caller saves.
        /// </summary>
        /// <param name="tokens">Hashing</param>
        /// <param name="user">The account</param>
        /// <param name="password">The password</param>
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
