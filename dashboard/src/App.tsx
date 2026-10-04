import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConnectionBanner from "./Components/Elements/ConnectionBanner";
import ChangePasswordModal from "./Components/Navbar/ChangePasswordModal";
import Navbar from "./Components/Navbar/Navbar";
import { useAuth } from "./Context/AuthContext";
import { useTerritory } from "./Context/TerritoryContext";
import { setNavigateFunction } from "./Lib/ErrorHandler";

/**
 * Layout shell. The navbar is hidden on the sign-in screen and on the printable receipt so the
 * paper copy comes out clean.
 */
const App = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { territoryId } = useTerritory();

    useEffect(() => {
        setNavigateFunction(navigate);
    }, [navigate]);

    // Printable pages drop the app chrome so the paper copy is just the sales sheets.
    const chromeless =
        location.pathname === "/login" ||
        location.pathname.startsWith("/receipt/") ||
        /^\/events\/\d+\/sheets$/.test(location.pathname);

    const showNavbar = Boolean(user) && !chromeless;
    // First sign-in, or a password a manager set: nothing else until they choose their own.
    const mustChangePassword = Boolean(user?.mustChangePassword) && location.pathname !== "/login";

    return (
        <div className="min-h-screen bg-zinc-100 text-zinc-900 transition-colors dark:bg-zinc-900 dark:text-zinc-100">
            <ConnectionBanner />
            {showNavbar && <Navbar />}
            <main className={showNavbar ? "pt-16 pb-20 md:pb-0" : ""}>
                {/* Switching territory starts each screen afresh with that territory's data. */}
                {mustChangePassword ? null : <Outlet key={territoryId ?? "all"} />}
            </main>
            {mustChangePassword && <ChangePasswordModal forced onClose={() => undefined} />}
            <ToastContainer className="no-print" />
        </div>
    );
};

export default App;
