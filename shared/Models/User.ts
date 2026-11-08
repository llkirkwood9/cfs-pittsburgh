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

/**
 * Whether someone in a role may do what any of the given roles may. Each role can do everything a
 * less senior one can: a manager also works the floor and checkout, an administrator everything a
 * manager can, a system admin everything. Sales & Checkout covers both tables but never the
 * management screens.
 * @param role Their role.
 * @param roles Any of these will do.
 * @returns True when allowed.
 */
export const HasRole = (role: UserRole | null | undefined, ...roles: UserRole[]): boolean => {
    if (!role) return false;
    if (roles.includes(role)) return true;
    if (role === "SalesCheckout") return roles.includes("Sales") || roles.includes("Checkout");
    return roles.some((r) => RoleRank[role] > RoleRank[r]);
};

/**
 * The letters on someone's avatar: the first letters of their first two names.
 * @param name Their name.
 * @returns Up to two capitals, or "?" with no name.
 */
export const Initials = (name?: string | null): string =>
    (name ?? "?")
        .split(" ")
        .map((part) => part.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();

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
    /** Whether the signed-in user may change this account. Only on the crew list. */
    canEdit?: boolean;
};
