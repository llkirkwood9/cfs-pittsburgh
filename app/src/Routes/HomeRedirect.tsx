import { Redirect } from "expo-router";
import LoadingPage from "../Components/Elements/LoadingPage";
import { useAuth } from "../Context/AuthContext";
import { HomePathForRole } from "../Lib/RoleRoutes";

/**
 * The app's opening screen sends each crew member to the screen their role actually uses, rather
 * than dropping everyone on the sales floor.
 */
const HomeRedirect = () => {
    const { user, loading, logout } = useAuth();

    if (loading) return <LoadingPage onSignOut={logout} />;
    if (!user) return <Redirect href="/login" />;

    return <Redirect href={HomePathForRole(user.role)} />;
};

export default HomeRedirect;
