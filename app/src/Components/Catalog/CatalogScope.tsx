import { View } from "react-native";
import Icon from "../Elements/Icon";
import SelectField from "../Elements/SelectField";
import Text from "../Elements/Text";
import type { Territory } from "../../Models/Territory";

/**
 * Whether a catalog item or delivery option is global or one territory's own, as a small badge.
 */
export const ScopeBadge = ({ territoryName }: { territoryName?: string | null }) =>
    territoryName ? (
        <View className="flex-row items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 dark:bg-sky-900/50">
            <Icon icon="fa-solid fa-location-dot" className="text-[10px] text-sky-800 dark:text-sky-300" />
            <Text className="text-xs font-semibold text-sky-800 dark:text-sky-300">{territoryName}</Text>
        </View>
    ) : (
        <View className="flex-row items-center gap-1 rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-700">
            <Icon icon="fa-solid fa-globe" className="text-[10px] text-zinc-700 dark:text-zinc-300" />
            <Text className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Global</Text>
        </View>
    );

type FieldProps = {
    value: number | null;
    onChange: (territoryId: number | null) => void;
    territories: Territory[];
    /** System Admins and administrators choose; a manager's items always go in their own territory. */
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
}: FieldProps) =>
    canChoose ? (
        <SelectField<number | null>
            label="Sold in"
            value={value}
            options={[
                { value: null, label: "Every territory (global)" },
                ...territories
                    .filter((t) => t.isActive !== false || t.id === value)
                    .map((t) => ({ value: t.id ?? null, label: `${t.name} only` })),
            ]}
            onChange={onChange}
            className={className}
        />
    ) : (
        <View className={`gap-1 ${className}`}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Sold in
            </Text>
            <View className="min-h-[48px] flex-row items-center gap-2 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                <Icon icon="fa-solid fa-location-dot" className="text-sky-600 dark:text-sky-400" />
                <Text className="text-sm font-medium">
                    {fixedName ? `${fixedName} only` : "Your territory only"}
                </Text>
            </View>
        </View>
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
