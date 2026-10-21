import { Redirect } from "expo-router";
import { Fragment } from "react";
import type { ReactNode } from "react";
import RequireTerritory from "./RequireTerritory";
import LoadingPage from "../Components/Elements/LoadingPage";
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import type { UserRole } from "../Models/User";

type Props = {
    children: ReactNode;
    roles?: UserRole[];
    /**
     * For a screen that works in one territory at a time, what it's for ("take orders"): someone
     * viewing every territory is asked to pick one first.
     */
    territory?: string;
    /** A screen opened within More, with its own header. */
    inStack?: boolean;
};

/**
 * Blocks a screen until the session is restored, then sends anyone unauthenticated to the sign-in
 * screen and anyone lacking the required role to the unauthorized screen. Switching territory
 * starts the screen afresh with that territory's data.
 */
const ProtectedRoute = ({ children, roles, territory, inStack = false }: Props) => {
    const { user, loading, hasRole, logout } = useAuth();
    const { territoryId } = useTerritory();

    if (loading) return <LoadingPage onSignOut={logout} />;
    if (!user) return <Redirect href="/login" />;
    if (roles && !hasRole(...roles)) return <Redirect href="/unauthorized" />;

    const screen = <Fragment key={territoryId ?? "all"}>{children}</Fragment>;
    return territory ? (
        <RequireTerritory purpose={territory} inStack={inStack}>
            {screen}
        </RequireTerritory>
    ) : (
        screen
    );
};

export default ProtectedRoute;
