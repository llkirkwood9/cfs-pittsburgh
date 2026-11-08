import { IsCompanyWide } from "../Models/User";
import type { User, UserRole } from "../Models/User";
import type { Territory } from "../Models/Territory";

/** Every role, least senior first, as the Crew screen offers them. */
export const CrewRoles: UserRole[] = [
    "Sales",
    "Checkout",
    "SalesCheckout",
    "Manager",
    "Admin",
    "SystemAdmin",
];

/** One line under each role on the Crew screen, saying what it does. */
export const CrewRoleBlurbs: Record<UserRole, string> = {
    Sales: "Takes orders on the floor",
    Checkout: "Takes payment and prints receipts",
    SalesCheckout: "Both tables, without the admin screens",
    Manager: "Runs their territories: crew, events, catalog and settings",
    Admin: "Every territory, plus the Territories screen",
    SystemAdmin: "Everything, plus permanent deletes",
};

/**
 * Whether someone in a role has to be put in a territory. System admins and administrators work
 * across every territory; every other role works in one or more.
 * @param role The role.
 * @returns True when at least one territory is needed.
 */
export const NeedsTerritory = (role: UserRole): boolean => !IsCompanyWide(role);

/** Fills an array with secure random numbers - crypto.getRandomValues or expo-crypto's. */
export type RandomValues = (bytes: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

/**
 * A random password for a new account or a reset, to hand to the crew member. They choose their
 * own at their first sign-in.
 * @param randomValues The platform's secure random source.
 * @returns 16 characters, avoiding ones that are easy to misread.
 */
export const MakePassword = (randomValues: RandomValues): string => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const bytes = randomValues(new Uint32Array(16));
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

/**
 * Whether the signed-in user may change a crew member's account. Matches the API: system admins
 * manage everyone, administrators everyone but system admins, managers only the Sales and
 * Checkout crew of their own territories (and themselves, for their details).
 * @param user The signed-in user.
 * @param crew The account.
 * @returns True when they may edit it.
 */
export const CanManageCrew = (user: User, crew: User): boolean => {
    if (user.role === "SystemAdmin") return true;
    if (user.role === "Admin") return crew.role !== "SystemAdmin";
    if (crew.id === user.id) return true;
    const own = user.territoryIds ?? [];
    return (
        (crew.territoryIds ?? []).some((id) => own.includes(id)) &&
        (crew.role === "Sales" || crew.role === "Checkout" || crew.role === "SalesCheckout")
    );
};

/**
 * The roles someone can give: never above their own, and a manager can't make managers.
 * @param role The signed-in user's role.
 * @returns The roles, least senior first.
 */
export const AssignableRoles = (role: UserRole | null | undefined): UserRole[] =>
    CrewRoles.filter((r) => {
        if (r === "SystemAdmin") return role === "SystemAdmin";
        if (r === "Admin" || r === "Manager") return IsCompanyWide(role);
        return true;
    });

/**
 * Where a crew member works, as the list shows it after their role, e.g. " · Butler, Erie".
 * @param crew The account.
 * @returns The text, or an empty string.
 */
export const CrewTerritoryText = (crew: User): string =>
    crew.territoryNames?.length
        ? ` · ${crew.territoryNames.join(", ")}`
        : crew.role && !NeedsTerritory(crew.role)
          ? " · All territories"
          : "";

/**
 * The territories a crew member works in that the signed-in user can't offer - a manager's view
 * of someone who also works elsewhere. Those stay as they are.
 * @param crew The account being edited.
 * @param offered The territories on offer.
 * @returns Their names.
 */
export const TerritoriesElsewhere = (crew: User, offered: Territory[]): string[] =>
    (crew.territoryNames ?? []).filter(
        (_, i) => !offered.some((t) => t.id === crew.territoryIds?.[i])
    );

/**
 * The territories a new account starts in: the one in view, or the only one on offer.
 * @param territoryInView The territory picked in the menu bar, or null for all of them.
 * @param offered The territories on offer.
 * @returns The territory ids.
 */
export const NewCrewTerritoryIds = (
    territoryInView: number | null,
    offered: Territory[]
): number[] =>
    territoryInView != null
        ? [territoryInView]
        : offered.length === 1 && offered[0].id != null
          ? [offered[0].id]
          : [];

/** What the crew form holds while it's open. */
export type CrewForm = {
    name: string;
    username: string;
    email: string;
    role: UserRole;
    password: string;
    territoryIds: number[];
    isActive: boolean;
    unlock: boolean;
};

/**
 * Checks the crew form and builds the account to save.
 * @param form What was entered.
 * @param id The account's id, or undefined for a new one.
 * @param offered The territories on offer.
 * @param chooseTerritories Whether territories were picked on the form; when not, the person is
 *     put in every territory on offer, keeping any others they work in.
 * @returns The account, or the reason it can't be saved.
 */
export const BuildCrewMember = (
    form: CrewForm,
    id: number | undefined,
    offered: Territory[],
    chooseTerritories: boolean
): { user: User } | { problem: string } => {
    if (!form.name.trim()) return { problem: "Enter the crew member's name." };
    if (!form.username.trim()) return { problem: "Enter a username." };
    if (!id && !form.password) return { problem: "Set a starting password." };
    if (form.password && form.password.length < 8)
        return { problem: "The password must be at least 8 characters." };

    // A manager's choices are only their own territories; any others the person works in stay.
    const offeredIds = offered.map((t) => t.id);
    const elsewhere = form.territoryIds.filter((t) => !offeredIds.includes(t));
    const chosen = chooseTerritories
        ? form.territoryIds
        : [...elsewhere, ...offeredIds.filter((t): t is number => t != null)];
    if (NeedsTerritory(form.role) && chosen.length === 0)
        return { problem: "Pick at least one territory this person works in." };

    return {
        user: {
            id,
            name: form.name.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            role: form.role,
            territoryIds: NeedsTerritory(form.role) ? chosen : [],
            isActive: form.isActive,
            password: form.password || undefined,
            isLockedOut: form.unlock ? false : undefined,
        },
    };
};
