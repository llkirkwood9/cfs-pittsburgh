import Icon from "../Elements/Icon";
import type { Territory } from "../../Models/Territory";

/**
 * Whether a catalog item or delivery option is global or one territory's own, as a small badge.
 */
export const ScopeBadge = ({ territoryName }: { territoryName?: string | null }) =>
    territoryName ? (
        <span className="ml-2 inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
            <Icon icon="fa-solid fa-location-dot" />
            {territoryName}
        </span>
    ) : (
        <span className="ml-2 inline-flex items-center gap-1 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
            <Icon icon="fa-solid fa-globe" />
            Global
        </span>
    );

type FieldProps = {
    value: number | null;
    onChange: (territoryId: number | null) => void;
    territories: Territory[];
    /** Owners and administrators choose; a manager's items always go in their own territory. */
    canChoose: boolean;
    /** Shown instead of the picker when it can't be chosen. */
    fixedName?: string | null;
    className?: string;
};

/**
 * Where a catalog item or delivery option is sold: everywhere (global) or in one territory.
 */
export const ScopeField = ({
    value,
    onChange,
    territories,
    canChoose,
    fixedName,
    className = "",
}: FieldProps) => (
    <label className={`flex flex-col gap-1 ${className}`}>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Sold in
        </span>
        {canChoose ? (
            <select
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
                className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900
                    outline-none focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
                <option value="">Every territory (global)</option>
                {territories
                    .filter((t) => t.isActive !== false || t.id === value)
                    .map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name} only
                        </option>
                    ))}
            </select>
        ) : (
            <span className="flex min-h-[48px] items-center gap-2 rounded-xl bg-zinc-100 px-3 text-sm font-medium dark:bg-zinc-700">
                <Icon icon="fa-solid fa-location-dot" className="text-sky-600 dark:text-sky-400" />
                {fixedName ? `${fixedName} only` : "Your territory only"}
            </span>
        )}
    </label>
);

/**
 * Whether something from the catalog can be used with an item sold in a territory: global things
 * go with anything; a territory's own only with that territory's items.
 * @param itemTerritoryId The thing's territory (null for global).
 * @param territoryId The item's territory (null for a global item).
 * @returns True when compatible.
 */
export const FitsTerritory = (
    itemTerritoryId: number | null | undefined,
    territoryId: number | null | undefined
): boolean => itemTerritoryId == null || itemTerritoryId === territoryId;
