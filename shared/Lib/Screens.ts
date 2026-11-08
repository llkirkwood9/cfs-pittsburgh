import { HasRole } from "../Models/User";
import type { UserRole } from "../Models/User";

/**
 * Every screen behind sign-in, with who may open it. The dashboard's routes, menu and tab titles,
 * and the app's tabs, More menu, headers and route guards are all built from this, so a screen's
 * name, roles and territory rule are written once.
 */
export type ScreenKey =
    | "sales"
    | "checkout"
    | "orders"
    | "dashboard"
    | "inventory"
    | "inventoryCount"
    | "catalog"
    | "events"
    | "closeOut"
    | "eventSheets"
    | "crew"
    | "settings"
    | "territories"
    | "receipt";

export type Screen = {
    /** Its name in a menu, a header or the browser tab. */
    title: string;
    /** Who may open it; anyone signed in when left out. */
    roles?: UserRole[];
    /**
     * For a screen that works in one territory at a time, what it's for ("take orders"): someone
     * viewing every territory is asked to pick one first.
     */
    territoryPurpose?: string;
};

export const Screens: Record<ScreenKey, Screen> = {
    sales: { title: "Sell", roles: ["Sales"], territoryPurpose: "take orders" },
    checkout: {
        title: "Checkout",
        roles: ["Checkout"],
        territoryPurpose: "work the checkout table",
    },
    orders: { title: "Orders" },
    dashboard: { title: "Dashboard" },
    // Checkout, Sales & Checkout and managers up keep the counts; floor-only reps do not.
    inventory: { title: "Inventory", roles: ["Checkout"], territoryPurpose: "see and count stock" },
    inventoryCount: {
        title: "Inventory count",
        roles: ["Checkout"],
        territoryPurpose: "count stock",
    },
    catalog: { title: "Catalog", roles: ["Manager"], territoryPurpose: "look after the catalog" },
    events: { title: "Events", roles: ["Manager"] },
    closeOut: { title: "Close out event", roles: ["Manager"] },
    eventSheets: { title: "Event sheets", roles: ["Manager"] },
    crew: { title: "Crew", roles: ["Manager"] },
    settings: { title: "Settings", roles: ["Manager"] },
    territories: { title: "Territories", roles: ["Admin"] },
    receipt: { title: "Sales sheet" },
};

/** The menu, ordered by how often each screen is used. */
export const MenuScreens = [
    "sales",
    "checkout",
    "orders",
    "dashboard",
    "inventory",
    "catalog",
    "events",
    "crew",
    "settings",
    "territories",
] as const satisfies readonly ScreenKey[];

/** A screen in the menu. */
export type MenuScreenKey = (typeof MenuScreens)[number];

/**
 * Whether someone in this role may open a screen.
 * @param key The screen.
 * @param role Their role.
 * @returns True when allowed.
 */
export const CanOpen = (key: ScreenKey, role: UserRole | null | undefined): boolean => {
    const roles = Screens[key].roles;
    return Boolean(role) && (!roles || HasRole(role, ...roles));
};

/**
 * Where each role lands after signing in. A checkout user dropped on the sales floor would just
 * hit the unauthorized screen, so the landing screen follows the role rather than being fixed.
 * @param role The signed-in user's role.
 * @returns The screen.
 */
export const HomeScreenFor = (role?: UserRole | null): MenuScreenKey => {
    switch (role) {
        case "Checkout":
            return "checkout";
        case "Manager":
        case "Admin":
        case "SystemAdmin":
            return "dashboard";
        default:
            return "sales";
    }
};

/**
 * Whether the screens that work in one territory have one to work in: someone with a single
 * territory is always in it; someone who can switch must have picked one.
 * @param territoryId The territory in view, or null for all of them.
 * @param canSwitch Whether they can view more than one.
 * @returns True when there is one territory in view.
 */
export const HasOneTerritory = (territoryId: number | null, canSwitch: boolean): boolean =>
    territoryId != null || !canSwitch;
