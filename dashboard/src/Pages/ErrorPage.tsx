import { useLocation, useNavigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";

type ErrorState = {
    code?: number;
    errorMessage?: string;
    exception?: string;
};

/**
 * Where a 500 lands. The detail is kept on screen rather than in a toast so the crew has
 * something they can read out when they call it in.
 */
const ErrorPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = (location.state ?? {}) as ErrorState;

    return (
        <div className="flex min-h-[70vh] items-center justify-center p-6">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 text-center shadow-sm dark:bg-zinc-800">
                <Icon
                    icon="fa-solid fa-triangle-exclamation"
                    className="text-4xl text-red-600 dark:text-red-400"
                />
                <h1 className="mt-4 text-xl font-bold">Something broke on the server</h1>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {state.errorMessage ?? "An internal error occurred."}
                </p>

                {state.exception && (
                    <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-zinc-100 p-3 text-left text-xs
                        text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {state.exception}
                    </pre>
                )}

                <div className="mt-5 flex justify-center gap-2">
                    <Button
                        text="Back to selling"
                        icon="fa-solid fa-arrow-left"
                        onClick={() => navigate("/sales")}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <Button
                        text="Try again"
                        icon="fa-solid fa-rotate"
                        onClick={() => navigate(-1)}
                    />
                </div>
            </div>
        </div>
    );
};

export default ErrorPage;
