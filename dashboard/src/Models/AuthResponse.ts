import type { User } from "./User";

export type AuthResponse = {
    /** Short-lived bearer token, kept in memory only. The session itself is an httpOnly cookie. */
    accessToken?: string;
    /** Seconds until the access token expires. */
    expiresIn?: number;
    user?: User;
    /**
     * The rotating refresh token - only for the phone app, which keeps it in the phone's secure
     * storage. The dashboard's lives in its httpOnly cookie instead.
     */
    refreshToken?: string | null;
};
