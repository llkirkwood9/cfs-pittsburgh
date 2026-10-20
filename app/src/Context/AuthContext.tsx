import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
    endSession,
    hasStoredSession,
    refreshSession,
    startSession,
    subscribePasswordRequired,
    subscribeTokenChanged,
} from "../Lib/api";
import { GetServerUrl } from "../Lib/Server";
import { GetCurrentUser, Login as LoginRequest } from "../Services/AuthServices";
import { RoleRank } from "../Models/User";
import type { User, UserRole } from "../Models/User";

type AuthState = {
    user: User | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<User | null>;
    logout: () => Promise<void>;
    fetchUserProfile: () => Promise<void>;
    /** Replaces the profile, e.g. after the user changes their own password. */
    setProfile: (profile: User | null) => void;
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
 * Holds the signed-in crew member for the whole app. The access token is only ever in memory; the
 * refresh token in the phone's secure storage renews it when the app opens.
 */
export const AuthProvider = ({ children }: Props) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    // Cleared by signing out, so a session check still waiting on the server can't sign back in.
    const restoring = useRef<boolean>(true);

    useEffect(() => {
        const offToken = subscribeTokenChanged((token) => {
            if (!token) setUser(null);
        });
        // The API refuses everything but changing the password until a new one is chosen.
        const offPassword = subscribePasswordRequired(() =>
            setUser((current) => (current ? { ...current, mustChangePassword: true } : current))
        );

        return () => {
            offToken();
            offPassword();
        };
    }, []);

    useEffect(() => {
        const restore = async () => {
            if (!hasStoredSession() || !GetServerUrl()) {
                restoring.current = false;
                setLoading(false);
                return;
            }

            // A server that can't be reached would otherwise hold the app on its loading screen for
            // the whole request timeout; past this the crew member goes to the sign-in screen.
            let session = null;
            try {
                session = await Promise.race([refreshSession(), wait(RESTORE_WAIT_MS)]);
            } catch {
                // Offline at start-up: the sign-in screen, with the session still stored.
            }
            if (!restoring.current) return;
            restoring.current = false;
            setUser(session?.user ?? null);
            setLoading(false);
        };

        restore();
    }, []);

    const login = async (username: string, password: string): Promise<User | null> => {
        const result = await LoginRequest(username, password);
        if (!result?.accessToken) return null;

        startSession(result);
        setUser(result.user ?? null);
        return result.user ?? null;
    };

    const logout = async (): Promise<void> => {
        restoring.current = false;
        // Tell the server, but don't keep the crew member waiting on one that can't be reached.
        await Promise.race([endSession(), wait(LOGOUT_WAIT_MS)]);
        setUser(null);
        setLoading(false);
    };

    const fetchUserProfile = async (): Promise<void> => {
        const profile = await GetCurrentUser();
        setUser(profile);
    };

    // Each role can do everything a less senior one can: a manager also works the floor and
    // checkout, an administrator everything a manager can, a system admin everything. Sales & Checkout
    // covers both tables but never the management screens.
    const hasRole = (...roles: UserRole[]): boolean => {
        if (!user?.role) return false;
        const mine = user.role;
        if (roles.includes(mine)) return true;
        if (mine === "SalesCheckout") return roles.includes("Sales") || roles.includes("Checkout");
        return roles.some((r) => RoleRank[mine] > RoleRank[r]);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                fetchUserProfile,
                setProfile: setUser,
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
