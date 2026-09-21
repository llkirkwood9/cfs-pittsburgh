export type UserRole = "Sales" | "Checkout" | "SalesCheckout" | "Admin";

/** How each role is named on screen. */
export const UserRoleLabels: Record<UserRole, string> = {
    Sales: "Sales",
    Checkout: "Checkout",
    SalesCheckout: "Sales & Checkout",
    Admin: "Admin",
};

export type User = {
    id?: number;
    name?: string;
    username?: string;
    email?: string;
    role?: UserRole;
    isActive?: boolean;
    pin?: string;
};
