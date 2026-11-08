import type { Href } from "expo-router";
import { HomeScreenFor } from "@shared/Lib/Screens";
import type { MenuScreenKey } from "@shared/Lib/Screens";
import type { UserRole } from "@shared/Models/User";

/**
 * Where each menu screen lives in the app, and its icon in the More menu. The first four are tabs
 * on the native tab bar; the rest open from More, with their own header.
 */
export const ScreenLinks: Record<MenuScreenKey, { href: Href; icon: string; inMore: boolean }> = {
    sales: { href: "/sales", icon: "fa-solid fa-cart-plus", inMore: false },
    checkout: { href: "/checkout", icon: "fa-solid fa-cash-register", inMore: false },
    orders: { href: "/orders", icon: "fa-solid fa-file-lines", inMore: false },
    dashboard: { href: "/dashboard", icon: "fa-solid fa-chart-column", inMore: false },
    inventory: { href: "/more/inventory", icon: "fa-solid fa-boxes-stacked", inMore: true },
    catalog: { href: "/more/catalog", icon: "fa-solid fa-tags", inMore: true },
    events: { href: "/more/events", icon: "fa-solid fa-calendar-days", inMore: true },
    crew: { href: "/more/crew", icon: "fa-solid fa-users", inMore: true },
    settings: { href: "/more/settings", icon: "fa-solid fa-gear", inMore: true },
    territories: { href: "/more/territories", icon: "fa-solid fa-map-location-dot", inMore: true },
};

/** The app's screens that open on one order or event, by the routes under src/app. */
export const Paths = {
    /** The checkout tab, open on one order. */
    checkoutOrder: (orderId: number | string): Href => ({
        pathname: "/checkout",
        params: { orderId: String(orderId) },
    }),
    receipt: (orderId: number | string): Href => ({
        pathname: "/receipt/[orderId]",
        params: { orderId: String(orderId) },
    }),
    inventoryCount: (phase: string): Href => ({
        pathname: "/more/inventory/count/[phase]",
        params: { phase },
    }),
    eventClose: (eventId: number | string): Href => ({
        pathname: "/more/events/[eventId]/close",
        params: { eventId: String(eventId) },
    }),
    eventSheets: (eventId: number | string): Href => ({
        pathname: "/events/[eventId]/sheets",
        params: { eventId: String(eventId) },
    }),
};

/**
 * Where a role lands after signing in.
 * @param role The signed-in user's role.
 * @returns The screen to navigate to.
 */
export const HomePathForRole = (role?: UserRole | null): Href =>
    ScreenLinks[HomeScreenFor(role)].href;
