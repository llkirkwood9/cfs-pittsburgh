import { View } from "react-native";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import { useSettings } from "@shared/Context/SettingsContext";
import { SalesStarsOf } from "@shared/Lib/Dashboard";

type Props = {
    net: number;
};

/**
 * Milestone stars for the Net sales tile. Nothing shows until the first star is earned; a screen
 * reader hears which milestone was passed and where the next one is.
 */
const SalesStars = ({ net }: Props) => {
    const { settings } = useSettings();
    const { starsFirstAt, starsEvery } = settings;
    const stars = SalesStarsOf(net, starsFirstAt, starsEvery);
    if (!stars) return null;
    const { drawn, extra, label } = stars;

    return (
        <View
            className="flex-row items-center gap-0.5"
            accessible
            accessibilityRole="image"
            accessibilityLabel={label}
        >
            {Array.from({ length: drawn }).map((_, i) => (
                <Icon key={i} icon="fa-solid fa-star" className="text-sm text-amber-500" />
            ))}
            {extra > 0 && (
                <Text className="ml-0.5 text-xs font-bold text-amber-600 tabular-nums dark:text-amber-400">
                    +{extra}
                </Text>
            )}
        </View>
    );
};

export default SalesStars;
