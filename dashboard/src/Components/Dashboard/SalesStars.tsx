import Icon from "../Elements/Icon";
import { useSettings } from "../../Context/SettingsContext";
import { FormatCurrency } from "../../Lib/ModelHelpers";

/** Past this many, the rest are shown as a number so the card never overflows. */
const MAX_DRAWN = 8;

/**
 * How many stars a net sales figure has earned: one at the first milestone (normally $30,000),
 * and another for every step after that (normally $10,000). Both are set under Settings.
 * @param net Net sales.
 * @param firstAt Net sales that earn the first star.
 * @param every Net sales between each star after the first.
 * @returns The number of stars.
 */
export const StarsFor = (net: number, firstAt: number, every: number): number =>
    every > 0 && net >= firstAt ? Math.floor((net - firstAt) / every) + 1 : 0;

type Props = {
    net: number;
};

/**
 * Milestone stars for the Net sales tile. Nothing shows until the first star is earned; the
 * tooltip says which milestone was passed and where the next one is.
 */
const SalesStars = ({ net }: Props) => {
    const { settings } = useSettings();
    const { starsFirstAt: firstAt, starsEvery: every } = settings;
    const stars = StarsFor(net, firstAt, every);
    if (stars === 0) return null;

    const passed = firstAt + (stars - 1) * every;
    const label = `${stars} star${stars === 1 ? "" : "s"}: net sales passed ${FormatCurrency(passed)}. Next star at ${FormatCurrency(passed + every)}.`;

    return (
        <span
            className="inline-flex items-center gap-0.5 text-amber-500"
            title={label}
            aria-label={label}
            role="img"
        >
            {Array.from({ length: Math.min(stars, MAX_DRAWN) }).map((_, i) => (
                <Icon key={i} icon="fa-solid fa-star" className="text-sm drop-shadow-sm" />
            ))}
            {stars > MAX_DRAWN && (
                <span className="ml-0.5 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    +{stars - MAX_DRAWN}
                </span>
            )}
        </span>
    );
};

export default SalesStars;
