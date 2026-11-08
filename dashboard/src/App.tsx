import { useEffect } from "react";
import { Outlet, useLocation, useMatches, useNavigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConnectionBanner from "./Components/Elements/ConnectionBanner";
import ChangePasswordModal from "./Components/Navbar/ChangePasswordModal";
import Navbar from "./Components/Navbar/Navbar";
import { useAuth } from "@shared/Context/AuthContext";
import { useTerritory } from "@shared/Context/TerritoryContext";
import { useSettings } from "@shared/Context/SettingsContext";
import { setNavigateFunction } from "./Lib/Host";
import { Screens } from "@shared/Lib/Screens";
import type { RouteHandle } from "./Routes/Routes";

/**
 * Layout shell. The navbar is hidden on the sign-in screen and on the printable receipt so the
 * paper copy comes out clean.
 */
const App = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { territoryId } = useTerritory();
    const { settings } = useSettings();

    useEffect(() => {
        setNavigateFunction(navigate);
    }, [navigate]);

    // Each screen's name on the browser tab, so several open tabs can be told apart.
    const handle = (useMatches().at(-1)?.handle ?? {}) as RouteHandle;
    const page = handle.screen ? Screens[handle.screen].title : handle.title;
    useEffect(() => {
        document.title = page ? `${page} · ${settings.appName}` : settings.appName;
    }, [page, settings.appName]);

    const chromeless = Boolean(handle.chromeless);

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
