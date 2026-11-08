import { HomeScreenFor } from "@shared/Lib/Screens";
import type { MenuScreenKey } from "@shared/Lib/Screens";
import type { UserRole } from "@shared/Models/User";

/** Where each menu screen lives in the dashboard. */
export const ScreenLinks: Record<MenuScreenKey, { path: string }> = {
    sales: { path: "/sales" },
    checkout: { path: "/checkout" },
    orders: { path: "/orders" },
    dashboard: { path: "/dashboard" },
    inventory: { path: "/inventory" },
    catalog: { path: "/catalog" },
    events: { path: "/events" },
    crew: { path: "/crew" },
    settings: { path: "/settings" },
    territories: { path: "/territories" },
};

/** The dashboard's other routes; Routes.tsx declares each one. */
export const Paths = {
    home: "/",
    login: "/login",
    error: "/error",
    unauthorized: "/unauthorized",
    /** The checkout screen, open on one order. */
    checkoutOrder: (orderId: number | string) => `/checkout/${orderId}`,
    receipt: (orderId: number | string) => `/receipt/${orderId}`,
    inventoryCount: (phase: string) => `/inventory/count/${phase}`,
    eventClose: (eventId: number | string) => `/events/${eventId}/close`,
    eventSheets: (eventId: number | string) => `/events/${eventId}/sheets`,
} as const;

/**
 * Where a role lands after signing in.
 * @param role The signed-in user's role.
 * @returns The path to navigate to.
 */
export const HomePathForRole = (role?: UserRole | null): string =>
    ScreenLinks[HomeScreenFor(role)].path;
