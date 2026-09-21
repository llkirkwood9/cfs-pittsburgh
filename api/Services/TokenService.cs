using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using api.Models;
using Microsoft.IdentityModel.Tokens;

namespace api.Services
{
    /// <summary>
    /// Issues short-lived JWT access tokens and long-lived opaque refresh tokens,
    /// and hashes the numeric PINs used to sign in on the floor tablets.
    /// </summary>
    public class TokenService(IConfiguration config)
    {
        #region Internal Fields

        /// <summary>
        /// Application configuration, source of the Jwt section
        /// </summary>
        private readonly IConfiguration _config = config;

        #endregion

        #region Public Methods

        /// <summary>
        /// Builds a signed access token carrying the user id, name and role.
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

            if (!string.IsNullOrWhiteSpace(user.Email))
                claims.Add(new Claim(ClaimTypes.Email, user.Email));

            var minutes = int.TryParse(_config["Jwt:ExpiresInMinutes"], out var parsed) ? parsed : 720;

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(minutes),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// Generates a 64 byte opaque refresh token.
        /// </summary>
        /// <returns>Base64 encoded refresh token.</returns>
        public string CreateRefreshToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(64);
            return Convert.ToBase64String(bytes);
        }

        /// <summary>
        /// Generates a random salt for PIN hashing.
        /// </summary>
        /// <returns>Base64 encoded salt.</returns>
        public string CreateSalt()
        {
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        }

        /// <summary>
        /// Hashes a PIN with the supplied salt using PBKDF2.
        /// </summary>
        /// <param name="pin">Plain text PIN</param>
        /// <param name="salt">Base64 salt</param>
        /// <returns>Base64 encoded hash.</returns>
        public string HashPin(string pin, string salt)
        {
            var saltBytes = Convert.FromBase64String(salt);
            var hash = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(pin),
                saltBytes,
                100_000,
                HashAlgorithmName.SHA256,
                32);

            return Convert.ToBase64String(hash);
        }

        /// <summary>
        /// Constant-time comparison of a supplied PIN against a stored hash.
        /// </summary>
        /// <param name="pin">Plain text PIN</param>
        /// <param name="salt">Base64 salt</param>
        /// <param name="expectedHash">Stored hash</param>
        /// <returns>True when the PIN matches.</returns>
        public bool VerifyPin(string pin, string salt, string expectedHash)
        {
            try
            {
                var actual = HashPin(pin, salt);
                return CryptographicOperations.FixedTimeEquals(
                    Convert.FromBase64String(actual),
                    Convert.FromBase64String(expectedHash));
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Reads the configured refresh token lifetime.
        /// </summary>
        /// <returns>Expiry timestamp for a newly issued refresh token.</returns>
        public DateTime GetRefreshTokenExpiry()
        {
            var days = int.TryParse(_config["Jwt:RefreshTokenDays"], out var parsed) ? parsed : 7;
            return DateTime.UtcNow.AddDays(days);
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
