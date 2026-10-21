export type UserRole = "Sales" | "Checkout" | "SalesCheckout" | "Manager" | "Admin" | "SystemAdmin";

/** How each role is named on screen. */
export const UserRoleLabels: Record<UserRole, string> = {
    Sales: "Sales",
    Checkout: "Checkout",
    SalesCheckout: "Sales & Checkout",
    Manager: "Manager",
    Admin: "Admin",
    SystemAdmin: "System Admin",
};

/** Seniority, matching the API: a role can do everything a lower one can. */
export const RoleRank: Record<UserRole, number> = {
    Sales: 1,
    Checkout: 1,
    SalesCheckout: 2,
    Manager: 3,
    Admin: 4,
    SystemAdmin: 5,
};

/** System admins and administrators work across every territory; everyone else belongs to one or more. */
export const IsCompanyWide = (role?: UserRole | null): boolean =>
    role === "SystemAdmin" || role === "Admin";

export type User = {
    id?: number;
    name?: string;
    username?: string;
    email?: string;
    role?: UserRole;
    /** The territories they work in, one or several; empty for system admins and administrators. */
    territoryIds?: number[];
    /** Their names, in the same order. */
    territoryNames?: string[];
    /** The first of territoryIds (for older apps). */
    territoryId?: number | null;
    territoryName?: string | null;
    isActive?: boolean;
    /** Only ever sent, never returned: a new password set by a manager or above. */
    password?: string;
    /** They have to choose their own password at their next sign-in. */
    mustChangePassword?: boolean;
    /** Signed out by too many wrong passwords; send false to unlock. */
    isLockedOut?: boolean;
    /** When they last signed in (UTC). Only sent to a system admin. */
    lastLoginAt?: string | null;
};
