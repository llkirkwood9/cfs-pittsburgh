import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import LoadingPage from "../Components/Elements/LoadingPage";
import { useAuth } from "../Context/AuthContext";
import type { UserRole } from "../Models/User";

type Props = {
    children: ReactNode;
    roles?: UserRole[];
};

/**
 * Blocks a screen until the session is restored, then sends anyone unauthenticated to the sign-in
 * screen and anyone lacking the required role to the unauthorized screen.
 */
const ProtectedRoute = ({ children, roles }: Props) => {
    const { user, loading, hasRole } = useAuth();

    if (loading) return <LoadingPage />;
    if (!user) return <Redirect href="/login" />;
    if (roles && !hasRole(...roles)) return <Redirect href="/unauthorized" />;

    return <>{children}</>;
};

export default ProtectedRoute;
