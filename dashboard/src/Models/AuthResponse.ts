import type { User } from "./User";

export type AuthResponse = {
    /** Short-lived bearer token, kept in memory only. The session itself is an httpOnly cookie. */
    accessToken?: string;
    /** Seconds until the access token expires. */
    expiresIn?: number;
    user?: User;
};
