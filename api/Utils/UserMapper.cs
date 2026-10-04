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
        /// <param name="user">User entity, with Territory loaded when its name is wanted</param>
        /// <param name="includeLastLogin">Whether to include the last sign-in time (owners only)</param>
        /// <returns>The mapped DTO.</returns>
        public static UserDto ToDto(User user, bool includeLastLogin = false)
        {
            return new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role.ToString(),
                TerritoryId = user.TerritoryId,
                TerritoryName = user.Territory?.Name,
                IsActive = user.IsActive,
                // Someone still on their old PIN has to choose a password at their next sign-in too.
                MustChangePassword = user.MustChangePassword || user.PasswordHash == null,
                IsLockedOut = user.LockoutUntil != null && user.LockoutUntil > DateTime.UtcNow,
                LastLoginAt = includeLastLogin ? user.LastLoginAt : null,
            };
        }
    }
}
