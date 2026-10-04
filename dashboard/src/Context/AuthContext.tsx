import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
    endSession,
    refreshSession,
    setAccessToken,
    subscribePasswordRequired,
    subscribeTokenChanged,
} from "../Lib/api";
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

type Props = {
    children: ReactNode;
};

/**
 * Holds the signed-in crew member for the whole app. The access token is only ever in memory,
 * so a reload restores the session from the httpOnly session cookie instead.
 */
export const AuthProvider = ({ children }: Props) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

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
            try {
                const session = await refreshSession();
                setUser(session?.user ?? null);
            } catch {
                // Offline at start-up: stay signed out until the connection is back.
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        restore();
    }, []);

    const login = async (username: string, password: string): Promise<User | null> => {
        const result = await LoginRequest(username, password);
        if (!result?.accessToken) return null;

        setAccessToken(result.accessToken);
        setUser(result.user ?? null);
        return result.user ?? null;
    };

    const logout = async (): Promise<void> => {
        await endSession();
        setUser(null);
    };

    const fetchUserProfile = async (): Promise<void> => {
        const profile = await GetCurrentUser();
        setUser(profile);
    };

    // Each role can do everything a less senior one can: a manager also works the floor and
    // checkout, an administrator everything a manager can, an owner everything. Sales & Checkout
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
