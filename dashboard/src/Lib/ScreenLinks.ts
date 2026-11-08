import { HomeScreenFor } from "@shared/Lib/Screens";
import type { MenuScreenKey } from "@shared/Lib/Screens";
import type { UserRole } from "@shared/Models/User";

/** Where each menu screen lives in the dashboard, and its menu icon. */
export const ScreenLinks: Record<MenuScreenKey, { path: string; icon: string }> = {
    sales: { path: "/sales", icon: "fa-solid fa-cart-plus" },
    checkout: { path: "/checkout", icon: "fa-solid fa-cash-register" },
    orders: { path: "/orders", icon: "fa-solid fa-file-lines" },
    dashboard: { path: "/dashboard", icon: "fa-solid fa-chart-column" },
    inventory: { path: "/inventory", icon: "fa-solid fa-boxes-stacked" },
    catalog: { path: "/catalog", icon: "fa-solid fa-tags" },
    events: { path: "/events", icon: "fa-solid fa-calendar-days" },
    crew: { path: "/crew", icon: "fa-solid fa-users" },
    settings: { path: "/settings", icon: "fa-solid fa-gear" },
    territories: { path: "/territories", icon: "fa-solid fa-map-location-dot" },
};

/**
 * Where a role lands after signing in.
 * @param role The signed-in user's role.
 * @returns The path to navigate to.
 */
export const HomePathForRole = (role?: UserRole | null): string =>
    ScreenLinks[HomeScreenFor(role)].path;
