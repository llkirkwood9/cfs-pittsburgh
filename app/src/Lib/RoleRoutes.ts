import type { Href } from "expo-router";
import type { UserRole } from "../Models/User";

/**
 * Where each role lands after signing in. A checkout user dropped on the sales floor would just
 * hit the unauthorized screen, so the landing screen follows the role rather than being fixed.
 * @param role The signed-in user's role.
 * @returns The screen to navigate to.
 */
export const HomePathForRole = (role?: UserRole | null): Href => {
    switch (role) {
        case "Checkout":
            return "/checkout";
        case "Manager":
        case "Admin":
        case "SystemAdmin":
            return "/dashboard";
        default:
            return "/sales";
    }
};
