import Icon from "../Elements/Icon";
import { useSettings } from "@shared/Context/SettingsContext";
import { SalesStarsOf } from "@shared/Lib/Dashboard";

type Props = {
    net: number;
};

/**
 * Milestone stars for the Net sales tile. Nothing shows until the first star is earned; the
 * tooltip says which milestone was passed and where the next one is.
 */
const SalesStars = ({ net }: Props) => {
    const { settings } = useSettings();
    const { starsFirstAt, starsEvery } = settings;
    const stars = SalesStarsOf(net, starsFirstAt, starsEvery);
    if (!stars) return null;
    const { drawn, extra, label } = stars;

    return (
        <span
            className="inline-flex items-center gap-0.5 text-amber-500"
            title={label}
            aria-label={label}
            role="img"
        >
            {Array.from({ length: drawn }).map((_, i) => (
                <Icon key={i} icon="fa-solid fa-star" className="text-sm drop-shadow-xs" />
            ))}
            {extra > 0 && (
                <span className="ml-0.5 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    +{extra}
                </span>
            )}
        </span>
    );
};

export default SalesStars;
