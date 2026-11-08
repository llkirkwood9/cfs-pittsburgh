import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import RequireTerritory from "./RequireTerritory";
import LoadingPage from "../Components/Elements/LoadingPage";
import { useAuth } from "@shared/Context/AuthContext";
import { CanOpen, Screens } from "@shared/Lib/Screens";
import type { ScreenKey } from "@shared/Lib/Screens";
import { Paths } from "../Lib/ScreenLinks";

type Props = {
    children: ReactNode;
    screen: ScreenKey;
};

/**
 * Blocks a screen until the session is restored, then sends anyone unauthenticated to the sign-in
 * screen and anyone the screen isn't for to the unauthorized page. A screen that works in one
 * territory at a time asks someone viewing all of theirs to pick one.
 */
const ProtectedRoute = ({ children, screen }: Props) => {
    const { user, loading } = useAuth();

    if (loading) return <LoadingPage />;
    if (!user) return <Navigate to={Paths.login} replace />;
    if (!CanOpen(screen, user.role)) return <Navigate to={Paths.unauthorized} replace />;

    const purpose = Screens[screen].territoryPurpose;
    return purpose ? <RequireTerritory purpose={purpose}>{children}</RequireTerritory> : children;
};

export default ProtectedRoute;
