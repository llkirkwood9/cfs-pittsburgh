export type UserRole = "Sales" | "Checkout" | "SalesCheckout" | "Admin" | "SystemAdmin";

/** How each role is named on screen. */
export const UserRoleLabels: Record<UserRole, string> = {
    Sales: "Sales",
    Checkout: "Checkout",
    SalesCheckout: "Sales & Checkout",
    Admin: "Admin",
    SystemAdmin: "System Admin",
};

export type User = {
    id?: number;
    name?: string;
    username?: string;
    email?: string;
    role?: UserRole;
    isActive?: boolean;
    pin?: string;
    /** When they last signed in (UTC). Only sent to a system admin. */
    lastLoginAt?: string | null;
};
