import type { ReactNode } from "react";
import Icon from "./Icon";

type Props = {
    label: string;
    value: string | number;
    sublabel?: string;
    icon?: any;
    accent?: "sky" | "green" | "amber" | "zinc" | "violet";
    /** Shown at the right of the label row, e.g. milestone stars. */
    badge?: ReactNode;
};

const accents: Record<string, string> = {
    sky: "text-sky-700 dark:text-sky-400",
    green: "text-green-700 dark:text-green-400",
    amber: "text-amber-700 dark:text-amber-400",
    violet: "text-violet-700 dark:text-violet-400",
    zinc: "text-zinc-700 dark:text-zinc-300",
};

/**
 * One box of the stat sheet. Value is set large so a manager can read the day's numbers from
 * across the table.
 */
const StatCard = ({ label, value, sublabel, icon, accent = "zinc", badge }: Props) => {
    return (
        <div className="rounded-xl bg-white p-4 shadow-sm transition-colors dark:bg-zinc-800">
            <div className="flex items-center gap-2">
                {icon && <Icon icon={icon} className={`text-sm ${accents[accent]}`} />}
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {label}
                </p>
                {badge && <div className="ml-auto">{badge}</div>}
            </div>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${accents[accent]}`}>{value}</p>
            {sublabel && (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sublabel}</p>
            )}
        </div>
    );
};

export default StatCard;
