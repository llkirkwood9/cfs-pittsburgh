import { NavLink } from "react-router-dom";
import Icon from "../Elements/Icon";
import ThemeToggle from "./ThemeToggle";
import UserProfileDropdown from "./UserProfileDropdown";
import { useAuth } from "../../Context/AuthContext";
import type { UserRole } from "../../Models/User";

type NavItem = {
    to: string;
    label: string;
    icon: string;
    roles?: UserRole[];
};

const items: NavItem[] = [
    { to: "/sales", label: "Sell", icon: "fa-solid fa-cart-plus", roles: ["Sales"] },
    { to: "/checkout", label: "Checkout", icon: "fa-solid fa-cash-register", roles: ["Checkout"] },
    { to: "/orders", label: "Orders", icon: "fa-solid fa-file-lines" },
    {
        to: "/inventory",
        label: "Inventory",
        icon: "fa-solid fa-boxes-stacked",
        roles: ["Checkout"],
    },
    { to: "/dashboard", label: "Dashboard", icon: "fa-solid fa-chart-column" },
    { to: "/catalog", label: "Catalog", icon: "fa-solid fa-tags", roles: ["Admin"] },
    { to: "/events", label: "Events", icon: "fa-solid fa-calendar-days", roles: ["Admin"] },
    { to: "/crew", label: "Crew", icon: "fa-solid fa-users", roles: ["Admin"] },
];

/**
 * Top bar on a tablet, bottom tab bar on a phone. Nothing here is more than a thumb-reach away
 * from where the rep's hand already is.
 */
const Navbar = () => {
    const { hasRole } = useAuth();
    const visible = items.filter((item) => !item.roles || hasRole(...item.roles));

    const linkClass = (isActive: boolean, stacked: boolean) =>
        `flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold
        transition-colors ${stacked ? "flex-col gap-0.5 text-xs" : ""} ${
            isActive
                ? "bg-white/15 text-white"
                : "text-zinc-300 hover:bg-white/10 hover:text-white"
        }`;

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-40 bg-zinc-900 shadow-lg dark:bg-black">
                <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-3">
                    <div className="flex items-center gap-2 text-white">
                        <Icon icon="fa-solid fa-bed" className="text-xl text-sky-400" />
                        <span className="hidden text-base font-bold tracking-tight sm:block">
                            CFS Pittsburgh
                        </span>
                    </div>

                    <nav className="ml-2 hidden flex-1 items-center gap-1 md:flex">
                        {visible.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) => linkClass(isActive, false)}
                            >
                                <Icon icon={item.icon} />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-1">
                        <ThemeToggle />
                        <UserProfileDropdown />
                    </div>
                </div>
            </header>

            {/* An admin has more tabs than fit across a phone, so the bar scrolls sideways. */}
            <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around gap-1 overflow-x-auto border-t
                border-zinc-800 bg-zinc-900 px-2 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden dark:bg-black">
                {visible.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `${linkClass(isActive, true)} min-w-[4.25rem] flex-1 shrink-0`}
                    >
                        <Icon icon={item.icon} className="text-base" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </>
    );
};

export default Navbar;
