using api.Dtos.Authentication;
using api.Models;

namespace api.Utils
{
    /// <summary>
    /// Maps user accounts for the API. Never includes a password or PIN hash.
    /// </summary>
    public static class UserMapper
    {
        /// <summary>
        /// Maps a user entity to its DTO.
        /// </summary>
        /// <param name="user">User entity, with Territories and their Territory loaded</param>
        /// <param name="includeLastLogin">Whether to include the last sign-in time (system admins only)</param>
        /// <returns>The mapped DTO.</returns>
        public static UserDto ToDto(User user, bool includeLastLogin = false)
        {
            var territories = user.Territories
                .OrderBy(t => t.Territory?.Name ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                .ToList();
            return new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role.ToString(),
                TerritoryIds = territories.Select(t => t.TerritoryId).ToList(),
                TerritoryNames = territories.Select(t => t.Territory?.Name ?? string.Empty).ToList(),
                TerritoryId = territories.FirstOrDefault()?.TerritoryId,
                TerritoryName = territories.FirstOrDefault()?.Territory?.Name,
                IsActive = user.IsActive,
                // Someone still on their old PIN has to choose a password at their next sign-in too.
                MustChangePassword = user.MustChangePassword || user.PasswordHash == null,
                IsLockedOut = user.LockoutUntil != null && user.LockoutUntil > DateTime.UtcNow,
                LastLoginAt = includeLastLogin ? user.LastLoginAt : null,
            };
        }
    }
}
