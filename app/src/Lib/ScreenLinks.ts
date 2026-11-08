import type { Href } from "expo-router";
import { HomeScreenFor } from "@shared/Lib/Screens";
import type { MenuScreenKey } from "@shared/Lib/Screens";
import type { UserRole } from "@shared/Models/User";

/**
 * Where each menu screen lives in the app. The first four are tabs
 * on the native tab bar; the rest open from More, with their own header.
 */
export const ScreenLinks: Record<MenuScreenKey, { href: Href; inMore: boolean }> = {
    sales: { href: "/sales", inMore: false },
    checkout: { href: "/checkout", inMore: false },
    orders: { href: "/orders", inMore: false },
    dashboard: { href: "/dashboard", inMore: false },
    inventory: { href: "/more/inventory", inMore: true },
    catalog: { href: "/more/catalog", inMore: true },
    events: { href: "/more/events", inMore: true },
    crew: { href: "/more/crew", inMore: true },
    settings: { href: "/more/settings", inMore: true },
    territories: { href: "/more/territories", inMore: true },
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
