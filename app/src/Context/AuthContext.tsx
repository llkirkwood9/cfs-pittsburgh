import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getAccessToken, getRefreshToken, setTokens, subscribeTokenChanged } from "../Lib/api";
import { GetServerUrl } from "../Lib/Server";
import {
    GetCurrentUser,
    Login as LoginRequest,
    Logout as LogoutRequest,
} from "../Services/AuthServices";
import type { User, UserRole } from "../Models/User";

type AuthState = {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    loading: boolean;
    login: (username: string, pin: string) => Promise<User | null>;
    logout: () => Promise<void>;
    fetchUserProfile: () => Promise<void>;
    hasRole: (...roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

/** How long signing out waits for the server before carrying on without it. */
const LOGOUT_WAIT_MS = 2000;

/** How long the app waits at start for the server to confirm the session. */
const RESTORE_WAIT_MS = 10000;

const wait = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

type Props = {
    children: ReactNode;
};

/**
 * Holds the signed-in crew member for the whole app and keeps itself in sync with the token
 * store, so a refresh that happens inside an interceptor is reflected here too.
 */
export const AuthProvider = ({ children }: Props) => {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(getAccessToken());
    const [refreshToken, setRefreshToken] = useState<string | null>(getRefreshToken());
    const [loading, setLoading] = useState<boolean>(true);
    // Cleared by signing out, so a session check still waiting on the server can't sign back in.
    const restoring = useRef<boolean>(true);

    useEffect(() => {
        const unsubscribe = subscribeTokenChanged((access, refresh) => {
            setAccessToken(access);
            setRefreshToken(refresh);
            if (!access) setUser(null);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        const restore = async () => {
            if (!getAccessToken() || !GetServerUrl()) {
                restoring.current = false;
                setLoading(false);
                return;
            }

            // A server that can't be reached would otherwise hold the app on its loading screen for
            // the whole request timeout; past this the crew member goes to the sign-in screen.
            const profile = await Promise.race([GetCurrentUser(), wait(RESTORE_WAIT_MS)]);
            if (!restoring.current) return;
            restoring.current = false;
            setUser(profile);
            setLoading(false);
        };

        restore();
    }, []);

    const login = async (username: string, pin: string): Promise<User | null> => {
        const result = await LoginRequest(username, pin);
        if (!result?.accessToken || !result.refreshToken) return null;

        setTokens(result.accessToken, result.refreshToken);
        setUser(result.user ?? null);
        return result.user ?? null;
    };

    const logout = async (): Promise<void> => {
        restoring.current = false;
        // Tell the server, but don't keep the crew member waiting on one that can't be reached.
        await Promise.race([LogoutRequest(), wait(LOGOUT_WAIT_MS)]);
        setTokens(null, null);
        setUser(null);
        setLoading(false);
    };

    const fetchUserProfile = async (): Promise<void> => {
        const profile = await GetCurrentUser();
        setUser(profile);
    };

    // Admin is deliberately a superset. Sales & Checkout covers both tables but never the admin
    // screens, for a crew member working the whole cart at a small event.
    const hasRole = (...roles: UserRole[]): boolean => {
        if (!user?.role) return false;
        // A system admin can do everything; an administrator everything but the system-admin-only deletes.
        if (user.role === "SystemAdmin") return true;
        if (user.role === "Admin") return !roles.every((r) => r === "SystemAdmin");
        if (
            user.role === "SalesCheckout" &&
            (roles.includes("Sales") || roles.includes("Checkout"))
        )
            return true;
        return roles.includes(user.role);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                refreshToken,
                loading,
                login,
                logout,
                fetchUserProfile,
                hasRole,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

/**
 * Reads the auth state.
 * @returns The auth context value.
 */
export const useAuth = (): AuthState => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside an AuthProvider.");
    return context;
};
