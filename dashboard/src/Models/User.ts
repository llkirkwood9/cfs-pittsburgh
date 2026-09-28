export type UserRole = "Sales" | "Checkout" | "SalesCheckout" | "Admin" | "Owner";

/** How each role is named on screen. */
export const UserRoleLabels: Record<UserRole, string> = {
    Sales: "Sales",
    Checkout: "Checkout",
    SalesCheckout: "Sales & Checkout",
    Admin: "Admin",
    Owner: "Owner",
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
