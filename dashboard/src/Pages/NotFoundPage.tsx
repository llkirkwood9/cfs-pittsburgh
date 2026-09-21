import { useNavigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";

/**
 * Catch-all for an unknown path.
 */
const NotFoundPage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-[70vh] items-center justify-center p-6">
            <div className="max-w-sm text-center">
                <Icon icon="fa-solid fa-compass" className="text-4xl text-zinc-400" />
                <h1 className="mt-4 text-xl font-bold">Nothing here</h1>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    That page does not exist.
                </p>
                <Button
                    text="Back to selling"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => navigate("/sales")}
                    className="mt-5"
                />
            </div>
        </div>
    );
};

export default NotFoundPage;
