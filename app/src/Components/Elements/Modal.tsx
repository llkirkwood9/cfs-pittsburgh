import type { ReactNode } from "react";
import {
    Modal as NativeModal,
    Platform,
    Pressable,
    ScrollView,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import KeyboardAvoider from "./KeyboardAvoider";
import Text from "./Text";
import ToastHost from "./ToastHost";
import { cx } from "../../Lib/ClassNames";

type Props = {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
    /** Leaves out the scroll view, for content that scrolls itself (a long list). */
    scroll?: boolean;
};

/**
 * Overlay sheet. On iOS it's the system sheet - a card centred over the screen on an iPad, sliding
 * up from the bottom on an iPhone, swiped down to close. On Android it's drawn the way the
 * dashboard draws it: full width from the bottom on a phone, a centred card on a tablet.
 */
const Modal = ({ title, onClose, children, footer, wide = false, scroll = true }: Props) => {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const ios = Platform.OS === "ios";
    const tablet = width >= 640;

    const body = (
        <>
            <View className="flex-row items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-700">
                <Text
                    className="flex-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100"
                    numberOfLines={2}
                    accessibilityRole="header"
                >
                    {title}
                </Text>
                <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={8}
                    className="h-11 w-11 items-center justify-center rounded-xl active:bg-zinc-100 dark:active:bg-zinc-700"
                >
                    <Icon
                        icon="fa-solid fa-xmark"
                        className="text-xl text-zinc-500 dark:text-zinc-400"
                    />
                </Pressable>
            </View>

            {scroll ? (
                <ScrollView
                    // A system sheet has a fixed height to fill; the Android card grows with its
                    // content up to its limit, then scrolls.
                    className={ios ? "flex-1" : "shrink grow-0"}
                    contentContainerClassName="px-5 py-4"
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets={ios}
                >
                    {children}
                </ScrollView>
            ) : (
                <View className="flex-1 px-5 py-4">{children}</View>
            )}

            {footer && (
                <View
                    className="flex-row flex-wrap justify-end gap-2 border-t border-zinc-200 px-5 pt-3 dark:border-zinc-700"
                    style={{ paddingBottom: Math.max(12, ios && !tablet ? insets.bottom : 12) }}
                >
                    {footer}
                </View>
            )}
        </>
    );

    if (ios) {
        return (
            <NativeModal
                visible
                animationType="slide"
                presentationStyle={wide ? "pageSheet" : "formSheet"}
                onRequestClose={onClose}
            >
                <View className="flex-1 bg-white dark:bg-zinc-800">{body}</View>
                <ToastHost />
            </NativeModal>
        );
    }

    return (
        <NativeModal
            visible
            transparent
            animationType={tablet ? "fade" : "slide"}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            {/* The sheet rises above the keyboard, shrinking to fit if it has to. */}
            <KeyboardAvoider
                className={cx(
                    "bg-black/50",
                    tablet ? "items-center justify-center" : "justify-end"
                )}
            >
                <Pressable className="absolute inset-0" onPress={onClose} accessible={false} />
                <View
                    className={cx(
                        "w-full bg-white dark:bg-zinc-800",
                        tablet ? "rounded-2xl" : "rounded-t-2xl",
                        tablet && (wide ? "max-w-4xl" : "max-w-lg")
                    )}
                    style={{
                        maxHeight: height * 0.92,
                        // Content that scrolls itself needs a height to scroll within.
                        height: scroll ? undefined : height * 0.85,
                        paddingBottom: tablet ? 0 : insets.bottom,
                        flexShrink: 1,
                    }}
                >
                    {body}
                </View>
            </KeyboardAvoider>
            <ToastHost />
        </NativeModal>
    );
};

export default Modal;
