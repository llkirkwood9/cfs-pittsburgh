import { Redirect } from "expo-router";
import { Fragment } from "react";
import type { ReactNode } from "react";
import RequireTerritory from "./RequireTerritory";
import LoadingPage from "../Components/Elements/LoadingPage";
import { useAuth } from "@shared/Context/AuthContext";
import { useTerritory } from "@shared/Context/TerritoryContext";
import { CanOpen, Screens } from "@shared/Lib/Screens";
import type { ScreenKey } from "@shared/Lib/Screens";

type Props = {
    children: ReactNode;
    /** The screen, as the screen table names it; leave out for one any signed-in user may open. */
    screen?: ScreenKey;
};

/**
 * Blocks a screen until the session is restored, then sends anyone unauthenticated to the sign-in
 * screen and anyone the screen isn't for to the unauthorized screen. A screen that works in one
 * territory at a time asks someone viewing all of theirs to pick one. Switching territory starts
 * the screen afresh with that territory's data.
 */
const ProtectedRoute = ({ children, screen }: Props) => {
    const { user, loading, logout } = useAuth();
    const { territoryId } = useTerritory();

    if (loading) return <LoadingPage onSignOut={logout} />;
    if (!user) return <Redirect href="/login" />;
    if (screen && !CanOpen(screen, user.role)) return <Redirect href="/unauthorized" />;

    const content = <Fragment key={territoryId ?? "all"}>{children}</Fragment>;
    const purpose = screen ? Screens[screen].territoryPurpose : undefined;
    return purpose ? <RequireTerritory purpose={purpose}>{content}</RequireTerritory> : content;
};

export default ProtectedRoute;
