import Icon from "../Elements/Icon";
import { useTerritory } from "../../Context/TerritoryContext";

/**
 * The territory in view, in the menu bar. Owners and administrators switch between territories -
 * or all of them - here; everyone else just sees which territory they're in.
 */
const TerritoryPicker = () => {
    const { territories, territoryId, territoryName, canSwitch, setTerritoryId } = useTerritory();

    if (!canSwitch) {
        if (!territoryName) return null;
        return (
            <span
                className="hidden max-w-[10rem] items-center gap-1.5 truncate rounded-lg px-2 text-sm
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
                className="h-11 max-w-[9.5rem] appearance-none truncate rounded-xl bg-white/10 pl-7 pr-7 text-sm
                    font-medium text-white outline-none hover:bg-white/15 focus:ring-2 focus:ring-sky-500
                    sm:max-w-[13rem] [&>option]:text-zinc-900"
            >
                <option value="">All territories</option>
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
