import { useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import Text from "./Text";
import { DismissToast, SubscribeToasts } from "../../Lib/Toast";
import type { ToastKind, ToastMessage } from "../../Lib/Toast";

const looks: Record<ToastKind, { icon: string; color: string }> = {
    success: { icon: "fa-solid fa-circle-check", color: "text-green-600 dark:text-green-400" },
    error: { icon: "fa-solid fa-circle-exclamation", color: "text-red-600 dark:text-red-400" },
    warning: { icon: "fa-solid fa-triangle-exclamation", color: "text-amber-600 dark:text-amber-400" },
    info: { icon: "fa-solid fa-circle-info", color: "text-sky-600 dark:text-sky-400" },
};

/**
 * Draws the toasts: top right on a tablet, as on the dashboard, and across the top on a phone.
 * Tap one to dismiss it. Every native sheet draws its own host too, so a message about the sheet
 * shows over it rather than behind it.
 */
const ToastHost = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    useEffect(() => SubscribeToasts(setToasts), []);

    if (toasts.length === 0) return null;

    const tablet = width >= 640;

    return (
        <View
            pointerEvents="box-none"
            className="absolute inset-x-0 top-0 z-50 gap-2 px-3"
            style={{ paddingTop: insets.top + 8, alignItems: tablet ? "flex-end" : "stretch" }}
        >
            {toasts.map((toast) => (
                <Animated.View
                    key={toast.id}
                    entering={FadeInUp.duration(180)}
                    exiting={FadeOutUp.duration(180)}
                    layout={LinearTransition}
                    style={{ width: tablet ? 360 : undefined }}
                >
                    <Pressable
                        onPress={() => DismissToast(toast.id)}
                        accessibilityRole="alert"
                        className="flex-row items-center gap-3 rounded-xl bg-white px-4 py-3 raised-lg dark:bg-zinc-800"
                    >
                        <Icon icon={looks[toast.kind].icon} className={`text-lg ${looks[toast.kind].color}`} />
                        <Text className="flex-1 text-sm text-zinc-800 dark:text-zinc-100">
                            {toast.message}
                        </Text>
                    </Pressable>
                </Animated.View>
            ))}
        </View>
    );
};

export default ToastHost;
