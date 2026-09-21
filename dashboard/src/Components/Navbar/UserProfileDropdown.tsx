import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../Elements/Icon";
import { useAuth } from "../../Context/AuthContext";
import { DASHBOARD_VERSION } from "../../Lib/Version";

/**
 * Shows who is signed in on this tablet and offers sign-out. The crew shares devices, so the
 * current name stays visible rather than being buried in a settings screen.
 */
const UserProfileDropdown = () => {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, []);

    const handleLogout = async () => {
        setOpen(false);
        await logout();
        navigate("/login", { replace: true });
    };

    const initials = (user?.name ?? "?")
        .split(" ")
        .map((part) => part.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex h-11 items-center gap-2 rounded-xl px-2 text-zinc-200 hover:bg-white/10"
            >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                    {initials}
                </span>
                <span className="hidden text-sm font-medium sm:block">{user?.name}</span>
                <Icon icon="fa-solid fa-chevron-down" className="text-xs" />
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl bg-white p-2 shadow-xl dark:bg-zinc-800">
                    <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {user?.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {user?.role} &middot; v{DASHBOARD_VERSION}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left
                            text-sm font-medium text-red-700 hover:bg-red-50
                            dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                        <Icon icon="fa-solid fa-right-from-bracket" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserProfileDropdown;
