import Spinner from "./Spinner";

/**
 * Full-screen loading state, shown while the session is being restored on app start.
 */
const LoadingPage = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
            <div className="flex flex-col items-center gap-3">
                <Spinner className="text-3xl" />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
            </div>
        </div>
    );
};

export default LoadingPage;
