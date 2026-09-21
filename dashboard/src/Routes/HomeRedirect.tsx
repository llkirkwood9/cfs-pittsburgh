import { Navigate } from "react-router-dom";
import LoadingPage from "../Components/Elements/LoadingPage";
import { useAuth } from "../Context/AuthContext";
import { HomePathForRole } from "../Lib/RoleRoutes";

/**
 * The root path sends each crew member to the screen their role actually uses, rather than
 * dropping everyone on the sales floor.
 */
const HomeRedirect = () => {
    const { user, loading } = useAuth();

    if (loading) return <LoadingPage />;
    if (!user) return <Navigate to="/login" replace />;

    return <Navigate to={HomePathForRole(user.role)} replace />;
};

export default HomeRedirect;
