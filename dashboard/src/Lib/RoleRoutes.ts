import type { UserRole } from "../Models/User";

/**
 * Where each role lands after signing in. A checkout user dropped on the sales floor would just
 * hit the unauthorized page, so the landing screen follows the role rather than being fixed.
 * @param role The signed-in user's role.
 * @returns The path to navigate to.
 */
export const HomePathForRole = (role?: UserRole | null): string => {
    switch (role) {
        case "Checkout":
            return "/checkout";
        case "Admin":
            return "/dashboard";
        default:
            return "/sales";
    }
};
