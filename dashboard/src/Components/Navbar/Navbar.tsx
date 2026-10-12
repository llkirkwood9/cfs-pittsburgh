import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import Icon from "../Elements/Icon";
import SizeGuideButton from "./SizeGuideButton";
import TerritoryPicker from "./TerritoryPicker";
import ThemeToggle from "./ThemeToggle";
import UserProfileDropdown from "./UserProfileDropdown";
import { useAuth } from "../../Context/AuthContext";
import { useSettings } from "../../Context/SettingsContext";
import type { UserRole } from "../../Models/User";

type NavItem = {
    to: string;
    label: string;
    icon: string;
    roles?: UserRole[];
};

// Ordered by how often the screen is used, so the first four are the ones that stay on the bar
// when an administrator's menu is too long for the screen.
const items: NavItem[] = [
    { to: "/sales", label: "Sell", icon: "fa-solid fa-cart-plus", roles: ["Sales"] },
    { to: "/checkout", label: "Checkout", icon: "fa-solid fa-cash-register", roles: ["Checkout"] },
    { to: "/orders", label: "Orders", icon: "fa-solid fa-file-lines" },
    { to: "/dashboard", label: "Dashboard", icon: "fa-solid fa-chart-column" },
    {
        to: "/inventory",
        label: "Inventory",
        icon: "fa-solid fa-boxes-stacked",
        roles: ["Checkout"],
    },
    { to: "/catalog", label: "Catalog", icon: "fa-solid fa-tags", roles: ["Manager"] },
    { to: "/events", label: "Events", icon: "fa-solid fa-calendar-days", roles: ["Manager"] },
    { to: "/crew", label: "Crew", icon: "fa-solid fa-users", roles: ["Manager"] },
    { to: "/settings", label: "Settings", icon: "fa-solid fa-gear", roles: ["Manager"] },
    {
        to: "/territories",
        label: "Territories",
        icon: "fa-solid fa-map-location-dot",
        roles: ["Admin"],
    },
];

/** A bar holds at most this many tabs; past that the last slot becomes More. */
const MAX_TABS = 5;
const PRIMARY_TABS = MAX_TABS - 1;

const tabClass = (isActive: boolean) =>
    `flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px]
    font-semibold leading-tight whitespace-nowrap transition-colors xl:min-h-[48px] xl:flex-row
    xl:gap-2 xl:px-3 xl:text-sm ${
        isActive ? "bg-white/15 text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"
    }`;

type MoreProps = {
    overflow: NavItem[];
    placement: "above" | "below";
    className?: string;
};

/**
 * The More tab: the screens that do not fit on the bar, in a small menu. Closes on a tap outside
 * or when a screen is chosen.
 */
const MoreMenu = ({ overflow, placement, className = "" }: MoreProps) => {
    const [open, setOpen] = useState<boolean>(false);
    const ref = useRef<HTMLDivElement>(null);
    const location = useLocation();

    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent | TouchEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("touchstart", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("touchstart", close);
        };
    }, [open]);

    const activeInside = overflow.some((item) => location.pathname.startsWith(item.to));

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className={`${tabClass(activeInside || open)} w-full`}
            >
                <Icon icon="fa-solid fa-ellipsis" className="text-base xl:text-sm" />
                More
            </button>

            {open && (
                <div
                    className={`absolute right-0 z-50 w-52 rounded-xl bg-white p-2 shadow-xl dark:bg-zinc-800 ${
                        placement === "above" ? "bottom-full mb-2" : "top-full mt-2"
                    }`}
                >
                    {overflow.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
                                    isActive
                                        ? "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                                        : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
                                }`
                            }
                        >
                            <Icon icon={item.icon} className="w-5" />
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Top bar on a tablet or computer, bottom tab bar on a phone. Nothing here is more than a thumb
 * reach away. A menu longer than a bar can hold - an administrator's - keeps its first four
 * screens on the bar and puts the rest behind More, so nothing is ever pushed off the edge.
 */
const Navbar = () => {
    const { hasRole } = useAuth();
    const { settings } = useSettings();
    const visible = items.filter((item) => !item.roles || hasRole(...item.roles));

    const crowded = visible.length > MAX_TABS;
    const primary = crowded ? visible.slice(0, PRIMARY_TABS) : visible;
    const overflow = crowded ? visible.slice(PRIMARY_TABS) : [];

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-40 bg-zinc-900 shadow-lg dark:bg-black">
                <div className="mx-auto flex h-16 max-w-(--breakpoint-2xl) items-center gap-2 px-3">
                    <div className="flex shrink-0 items-center gap-2 text-white">
                        <Icon icon="fa-solid fa-bed" className="text-xl text-sky-400" />
                        {/* A manager's or administrator's full row of tabs, with the territory picker, needs the room. */}
                        <span
                            className={`hidden max-w-56 truncate whitespace-nowrap text-base font-bold tracking-tight ${
                                crowded ? "min-[1800px]:block" : "xl:block"
                            }`}
                        >
                            {settings.appName}
                        </span>
                    </div>

                    <nav className="ml-1 hidden min-w-0 flex-1 items-center gap-1 md:flex">
                        {primary.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) => tabClass(isActive)}
                            >
                                <Icon icon={item.icon} className="text-base xl:text-sm" />
                                {item.label}
                            </NavLink>
                        ))}

                        {/* On a wide screen there is room for every tab, so More goes away. */}
                        {overflow.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `${tabClass(isActive)} hidden 2xl:flex`
                                }
                            >
                                <Icon icon={item.icon} className="text-base xl:text-sm" />
                                {item.label}
                            </NavLink>
                        ))}
                        {crowded && (
                            <MoreMenu
                                overflow={overflow}
                                placement="below"
                                className="2xl:hidden"
                            />
                        )}
                    </nav>

                    <div className="ml-auto flex shrink-0 items-center gap-1">
                        <TerritoryPicker />
                        <SizeGuideButton />
                        <ThemeToggle />
                        <UserProfileDropdown />
                    </div>
                </div>
            </header>

            <nav
                className="fixed inset-x-0 bottom-0 z-40 grid gap-1 border-t border-zinc-800 bg-zinc-900 px-2
                    pb-[env(safe-area-inset-bottom)] pt-1 md:hidden dark:bg-black"
                style={{
                    gridTemplateColumns: `repeat(${primary.length + (crowded ? 1 : 0)}, minmax(0, 1fr))`,
                }}
            >
                {primary.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => tabClass(isActive)}
                    >
                        <Icon icon={item.icon} className="text-base" />
                        {item.label}
                    </NavLink>
                ))}
                {crowded && <MoreMenu overflow={overflow} placement="above" />}
            </nav>
        </>
    );
};

export default Navbar;
