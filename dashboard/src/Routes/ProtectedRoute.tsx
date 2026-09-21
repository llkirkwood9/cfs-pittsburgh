import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import LoadingPage from "../Components/Elements/LoadingPage";
import { useAuth } from "../Context/AuthContext";
import type { UserRole } from "../Models/User";

type Props = {
    children: ReactNode;
    roles?: UserRole[];
};

/**
 * Blocks a route until the session is restored, then sends anyone unauthenticated to the sign-in
 * screen and anyone lacking the required role to the unauthorized page.
 */
const ProtectedRoute = ({ children, roles }: Props) => {
    const { user, loading, hasRole } = useAuth();

    if (loading) return <LoadingPage />;
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !hasRole(...roles)) return <Navigate to="/unauthorized" replace />;

    return <>{children}</>;
};

export default ProtectedRoute;
