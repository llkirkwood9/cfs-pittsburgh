type Props = {
    text: string;
    active: boolean;
    onClick: () => void;
    badge?: number;
    /** A short word shown in a small pill after the text, e.g. "Past". */
    tag?: string;
    className?: string;
};

/**
 * Segmented-control style tab, used for the draft switcher and the catalog category filter.
 */
const TabButton = ({ text, active, onClick, badge, tag, className = "" }: Props) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm
                font-semibold transition-colors select-none
                ${
                    active
                        ? "bg-sky-700 text-white dark:bg-sky-600"
                        : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                } ${className}`}
        >
            <span>{text}</span>
            {tag && (
                <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        active
                            ? "bg-white/25 text-white"
                            : "bg-zinc-300 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300"
                    }`}
                >
                    {tag}
                </span>
            )}
            {badge !== undefined && badge > 0 && (
                <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                        active
                            ? "bg-white/25 text-white"
                            : "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-100"
                    }`}
                >
                    {badge}
                </span>
            )}
        </button>
    );
};

export default TabButton;
