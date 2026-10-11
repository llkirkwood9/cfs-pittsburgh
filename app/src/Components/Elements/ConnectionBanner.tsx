import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import Text from "./Text";
import api from "../../Lib/api";
import { IsOnline, OnConnectionChange, SetOnline } from "../../Lib/Connection";
import { Toast } from "../../Lib/Toast";

/** How often to check whether the server is back. */
const RETRY_MS = 5000;

/**
 * A strip across the top of the screen while the server cannot be reached - usually the cart's
 * Wi-Fi dropping out. It checks every few seconds, and again when the app comes back to the front,
 * and disappears on its own once the server answers again.
 */
const ConnectionBanner = () => {
    const [online, setOnline] = useState<boolean>(IsOnline());
    const insets = useSafeAreaInsets();

    useEffect(() => OnConnectionChange(setOnline), []);

    useEffect(() => {
        if (online) return;

        const check = () => {
            api.get("/health", { timeout: 4000 })
                .then(() => {
                    SetOnline(true);
                    Toast.Success("Reconnected to the server.");
                })
                .catch(() => undefined);
        };

        const timer = setInterval(check, RETRY_MS);
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") check();
        });
        return () => {
            clearInterval(timer);
            subscription.remove();
        };
    }, [online]);

    if (online) return null;

    return (
        <View
            accessibilityRole="alert"
            // Lets taps through, so the crew can still move between screens while it waits.
            pointerEvents="none"
            className="absolute inset-x-0 top-0 z-40 flex-row items-center justify-center gap-2 bg-amber-500 px-3 pb-2 shadow-lg"
            style={{ paddingTop: insets.top + 4 }}
        >
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
