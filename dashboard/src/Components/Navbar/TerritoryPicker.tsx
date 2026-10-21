import Icon from "../Elements/Icon";
import { useTerritory } from "../../Context/TerritoryContext";

/**
 * The territory in view, in the menu bar. Anyone with more than one territory - system admins and
 * administrators have every one - switches between them, or all of theirs, here; someone in one
 * territory just sees which it is.
 */
const TerritoryPicker = () => {
    const { territories, territoryId, territoryName, canSwitch, allLabel, setTerritoryId } = useTerritory();

    if (!canSwitch) {
        if (!territoryName) return null;
        return (
            <span
                className="hidden max-w-40 items-center gap-1.5 truncate rounded-lg px-2 text-sm
                    font-medium text-zinc-300 sm:flex"
                title="Your territory"
            >
                <Icon icon="fa-solid fa-location-dot" className="text-sky-400" />
                {territoryName}
            </span>
        );
    }

    const active = territories.filter((t) => t.isActive !== false);

    return (
        <label className="relative flex items-center" title="Territory in view">
            <span className="sr-only">Territory</span>
            <Icon
                icon="fa-solid fa-location-dot"
                className="pointer-events-none absolute left-2.5 text-sm text-sky-400"
            />
            <select
                value={territoryId ?? ""}
                onChange={(e) => setTerritoryId(e.target.value ? Number(e.target.value) : null)}
                className="h-11 max-w-38 appearance-none truncate rounded-xl bg-white/10 pl-7 pr-7 text-sm
                    font-medium text-white outline-hidden hover:bg-white/15 focus:ring-2 focus:ring-sky-500
                    sm:max-w-52 [&>option]:text-zinc-900"
            >
                <option value="">{allLabel}</option>
                {active.map((t) => (
                    <option key={t.id} value={t.id}>
                        {t.name}
                    </option>
                ))}
            </select>
            <Icon
                icon="fa-solid fa-chevron-down"
                className="pointer-events-none absolute right-2.5 text-[10px] text-zinc-300"
            />
        </label>
    );
};

export default TerritoryPicker;
