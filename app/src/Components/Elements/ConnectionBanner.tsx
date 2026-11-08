import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import Text from "./Text";
import { useReconnect } from "@shared/Hooks/useReconnect";

/**
 * A strip across the top of the screen while the server cannot be reached - usually the cart's
 * Wi-Fi dropping out. It checks every few seconds, and again when the app comes back to the front,
 * and disappears on its own once the server answers again.
 */
const ConnectionBanner = () => {
    const online = useReconnect();
    const insets = useSafeAreaInsets();

    if (online) return null;

    return (
        <View
            accessibilityRole="alert"
            // Lets taps through, so the crew can still move between screens while it waits.
            pointerEvents="none"
            className="absolute inset-x-0 top-0 z-40 flex-row items-center justify-center gap-2 bg-amber-500 px-3 pb-2 raised-lg"
            style={{ paddingTop: insets.top + 4 }}
        >
            {/* Dark status bar text on the amber, whatever the theme. */}
            <StatusBar style="dark" />
            <Icon icon="fa-solid fa-wifi" className="text-sm text-amber-950" />
            <Text className="shrink text-center text-sm font-semibold text-amber-950">
                Can&apos;t reach the server - retrying. Changes won&apos;t save until it&apos;s
                back.
            </Text>
            <Icon icon="fa-solid fa-circle-notch" spin className="text-sm text-amber-950" />
        </View>
    );
};

export default ConnectionBanner;
