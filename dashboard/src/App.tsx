import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "./Components/Navbar/Navbar";
import { useAuth } from "./Context/AuthContext";
import { setNavigateFunction } from "./Lib/ErrorHandler";

/**
 * Layout shell. The navbar is hidden on the sign-in screen and on the printable receipt so the
 * paper copy comes out clean.
 */
const App = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    useEffect(() => {
        setNavigateFunction(navigate);
    }, [navigate]);

    const chromeless =
        location.pathname === "/login" || location.pathname.startsWith("/receipt/");

    const showNavbar = Boolean(user) && !chromeless;

    return (
        <div className="min-h-screen bg-zinc-100 text-zinc-900 transition-colors dark:bg-zinc-900 dark:text-zinc-100">
            {showNavbar && <Navbar />}
            <main className={showNavbar ? "pt-16 pb-20 md:pb-0" : ""}>
                <Outlet />
            </main>
            <ToastContainer className="no-print" />
        </div>
    );
};

export default App;
