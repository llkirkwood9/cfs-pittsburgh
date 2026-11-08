import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { client } from "@host";
import { GetCurrentUser, Login as LoginRequest } from "../Services/AuthServices";
import { HasRole } from "../Models/User";
import type { AuthResponse } from "../Models/AuthResponse";
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

/** How long start-up waits for the server to confirm the session. */
const RESTORE_WAIT_MS = 10000;

const wait = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

/**
 * Holds the signed-in crew member for the whole app. The access token is only ever in memory; the
 * session the host keeps (a cookie on the dashboard, secure storage in the app) renews it when the
 * app opens.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    // Cleared by signing out, so a session check still waiting on the server can't sign back in.
    const restoring = useRef<boolean>(true);

    useEffect(() => {
        const offToken = client.subscribeTokenChanged((token) => {
            if (!token) setUser(null);
        });
        // The API refuses everything but changing the password until a new one is chosen.
        const offPassword = client.subscribePasswordRequired(() =>
            setUser((current) => (current ? { ...current, mustChangePassword: true } : current))
        );

        return () => {
            offToken();
            offPassword();
        };
    }, []);

    useEffect(() => {
        const restore = async () => {
            if (!client.hasStoredSession()) {
                restoring.current = false;
                setLoading(false);
                return;
            }

            // A server that can't be reached would otherwise hold the loading screen for the whole
            // request timeout; past this the crew member goes to the sign-in screen.
            let session: AuthResponse | null = null;
            try {
                session = await Promise.race([client.refreshSession(), wait(RESTORE_WAIT_MS)]);
            } catch {
                // Offline at start-up: the sign-in screen, with the session still kept.
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

        client.startSession(result);
        setUser(result.user ?? null);
        return result.user ?? null;
    };

    const logout = async (): Promise<void> => {
        restoring.current = false;
        // Tell the server, but don't keep the crew member waiting on one that can't be reached.
        await Promise.race([client.endSession(), wait(LOGOUT_WAIT_MS)]);
        setUser(null);
        setLoading(false);
    };

    const fetchUserProfile = async (): Promise<void> => {
        setUser(await GetCurrentUser());
    };

    const value: AuthState = {
        user,
        loading,
        login,
        logout,
        fetchUserProfile,
        setProfile: setUser,
        hasRole: (...roles) => HasRole(user?.role, ...roles),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
