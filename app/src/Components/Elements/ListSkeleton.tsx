import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

type Props = {
    rows?: number;
};

/**
 * Placeholder rows shown while a list loads, so the layout does not jump on slow cart Wi-Fi.
 */
const ListSkeleton = ({ rows = 4 }: Props) => {
    const pulse = useSharedValue(1);

    useEffect(() => {
        pulse.value = withRepeat(withTiming(0.5, { duration: 900 }), -1, true);
    }, [pulse]);

    const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

    return (
        <Animated.View style={style} className="gap-2">
            {Array.from({ length: rows }).map((_, index) => (
                <View key={index} className="h-16 rounded-xl bg-zinc-200 dark:bg-zinc-700" />
            ))}
        </Animated.View>
    );
};

export default ListSkeleton;
