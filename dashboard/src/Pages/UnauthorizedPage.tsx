import { useNavigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import { useAuth } from "../Context/AuthContext";
import { HomePathForRole } from "../Lib/RoleRoutes";

/**
 * Shown when a signed-in crew member reaches a screen their role does not cover.
 */
const UnauthorizedPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="flex min-h-[70vh] items-center justify-center p-6">
            <div className="max-w-sm text-center">
                <Icon icon="fa-solid fa-lock" className="text-4xl text-amber-600 dark:text-amber-400" />
                <h1 className="mt-4 text-xl font-bold">Not your table</h1>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Your account does not cover this screen. Ask an administrator if you need access.
                </p>
                <Button
                    text="Back to your screen"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => navigate(HomePathForRole(user?.role))}
                    className="mt-5"
                />
            </div>
        </div>
    );
};

export default UnauthorizedPage;
