import type { ReactNode } from "react";
import Icon from "../Components/Elements/Icon";
import { useTerritory } from "../Context/TerritoryContext";

type Props = {
    children: ReactNode;
    /** What the screen is for, e.g. "take orders". */
    purpose: string;
};

/**
 * For screens that work in one territory at a time - selling, checkout, stock counts, the catalog.
 * Someone with one territory is always in it; anyone viewing all of theirs is asked to pick one.
 */
const RequireTerritory = ({ children, purpose }: Props) => {
    const { territoryId, territories, canSwitch, allLabel, setTerritoryId } = useTerritory();

    if (territoryId != null || !canSwitch) return <>{children}</>;

    const active = territories.filter((t) => t.isActive !== false);

    return (
        <div className="mx-auto max-w-lg p-4">
            <div className="rounded-2xl bg-white p-6 text-center shadow-xs dark:bg-zinc-800">
                <Icon
                    icon="fa-solid fa-map-location-dot"
                    className="mb-3 text-3xl text-sky-600 dark:text-sky-400"
                />
                <h1 className="mb-1 text-lg font-bold">Pick a territory</h1>
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                    You&apos;re viewing {allLabel.toLowerCase()}. To {purpose}, choose which territory
                    you&apos;re working in - you can switch any time from the menu bar.
                </p>
                {active.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        There are no territories yet. Add one on the Territories screen.
                    </p>
                ) : (
                    <div className="flex flex-wrap justify-center gap-2">
                        {active.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTerritoryId(t.id ?? null)}
                                className="min-h-[48px] rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white
                                    hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-700"
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequireTerritory;
