export type UserRole = "Sales" | "Checkout" | "Admin";

export type User = {
    id?: number;
    name?: string;
    username?: string;
    email?: string;
    role?: UserRole;
    isActive?: boolean;
    pin?: string;
};
