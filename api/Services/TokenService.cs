using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace api.Services
{
    /// <summary>
    /// Issues short-lived JWT access tokens and long-lived opaque refresh tokens, and hashes
    /// passwords. Refresh tokens are only ever stored as a SHA-256 hash. The old PIN hashing is
    /// kept solely to let an account from before passwords sign in once and choose a password.
    /// </summary>
    public class TokenService(IConfiguration config)
    {
        #region Internal Fields

        /// <summary>
        /// Application configuration, source of the Jwt section
        /// </summary>
        private readonly IConfiguration _config = config;

        /// <summary>
        /// PBKDF2 with HMAC-SHA512 and a per-password salt, in ASP.NET Core Identity's versioned
        /// format, so a stronger setting later rehashes passwords as people sign in.
        /// </summary>
        private readonly PasswordHasher<User> _hasher = new();

        #endregion

        #region Public Methods

        /// <summary>
        /// Builds a signed access token carrying the user id, name and role. Territories aren't in it:
        /// they're read from the database on every request.
        /// </summary>
        /// <param name="user">User signing in</param>
        /// <returns>The encoded JWT.</returns>
        public string CreateAccessToken(User user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(GetSigningKey()));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.Name),
                new(ClaimTypes.Role, user.Role.ToString()),
            };


            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(AccessTokenMinutes()),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// How long an access token lasts. Short, because it can't be revoked; the refresh cookie
        /// renews it quietly, and a deactivated account stops working at its next request anyway.
        /// </summary>
        /// <returns>Minutes.</returns>
        public int AccessTokenMinutes()
        {
            var minutes = int.TryParse(_config["Jwt:AccessTokenMinutes"], out var parsed) ? parsed : 15;
            return Math.Clamp(minutes, 1, 60);
        }

        /// <summary>
        /// Generates a 64 byte opaque refresh token, URL-safe so it travels cleanly in a cookie.
        /// </summary>
        /// <returns>The token.</returns>
        public string CreateRefreshToken()
        {
            return Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));
        }

        /// <summary>
        /// The SHA-256 of a refresh token, which is all the database keeps.
        /// </summary>
        /// <param name="token">The refresh token</param>
        /// <returns>Lower-case hex.</returns>
        public static string HashRefreshToken(string token)
        {
            return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        }

        /// <summary>
        /// Reads the configured refresh token lifetime.
        /// </summary>
        /// <returns>Expiry timestamp for a newly issued refresh token.</returns>
        public DateTime GetRefreshTokenExpiry()
        {
            var days = int.TryParse(_config["Jwt:RefreshTokenDays"], out var parsed) ? parsed : 7;
            return DateTime.UtcNow.AddDays(Math.Clamp(days, 1, 30));
        }

        /// <summary>
        /// Hashes a password for storing.
        /// </summary>
        /// <param name="user">The account (part of Identity's hashing API; not mixed into the hash)</param>
        /// <param name="password">Plain text password</param>
        /// <returns>The hash.</returns>
        public string HashPassword(User user, string password)
        {
            return _hasher.HashPassword(user, password);
        }

        /// <summary>
        /// Checks a password against the account's hash.
        /// </summary>
        /// <param name="user">The account</param>
        /// <param name="password">Plain text password</param>
        /// <param name="rehash">Set when the hash was made with older settings and should be replaced</param>
        /// <returns>True when the password matches.</returns>
        public bool VerifyPassword(User user, string password, out bool rehash)
        {
            rehash = false;
            if (string.IsNullOrEmpty(user.PasswordHash))
                return false;

            var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
            rehash = result == PasswordVerificationResult.SuccessRehashNeeded;
            return result != PasswordVerificationResult.Failed;
        }

        /// <summary>
        /// Constant-time check of a PIN against an account's old PIN hash, for an account that has
        /// not chosen a password yet.
        /// </summary>
        /// <param name="pin">What was typed</param>
        /// <param name="salt">Base64 salt</param>
        /// <param name="expectedHash">Stored hash</param>
        /// <returns>True when it matches.</returns>
        public bool VerifyLegacyPin(string pin, string salt, string expectedHash)
        {
            if (string.IsNullOrEmpty(salt) || string.IsNullOrEmpty(expectedHash))
                return false;

            try
            {
                var actual = Rfc2898DeriveBytes.Pbkdf2(
                    Encoding.UTF8.GetBytes(pin),
                    Convert.FromBase64String(salt),
                    100_000,
                    HashAlgorithmName.SHA256,
                    32);

                return CryptographicOperations.FixedTimeEquals(actual, Convert.FromBase64String(expectedHash));
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// A random password for a first sign-in, e.g. the seeded system admin's when none is configured:
        /// 20 characters from an alphabet without look-alikes.
        /// </summary>
        /// <returns>The password.</returns>
        public static string GeneratePassword()
        {
            const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
            return string.Create(20, alphabet, (span, chars) =>
            {
                for (var i = 0; i < span.Length; i++)
                    span[i] = chars[RandomNumberGenerator.GetInt32(chars.Length)];
            });
        }

        /// <summary>
        /// Resolves the symmetric signing key from configuration.
        /// </summary>
        /// <returns>The signing key.</returns>
        public string GetSigningKey()
        {
            var key = _config["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(key))
                throw new InvalidOperationException("Jwt:Key is not configured.");

            return key;
        }

        #endregion
    }
}
