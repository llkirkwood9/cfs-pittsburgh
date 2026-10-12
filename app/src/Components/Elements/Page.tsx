import type { ReactNode, Ref } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Edge } from "react-native-safe-area-context";
import KeyboardAvoider from "./KeyboardAvoider";
import Navbar from "../Navbar/Navbar";
import { cx } from "../../Lib/ClassNames";

type Props = {
    children: ReactNode;
    /** Classes for the content area, like the dashboard page's outer div. */
    className?: string;
    /** Pull down to refresh, when the page has something to reload. */
    onRefresh?: () => void;
    refreshing?: boolean;
    /** False for a page that lays out its own scrolling areas (the sales floor). */
    scroll?: boolean;
    /** Safe-area edges to pad; a tab screen pads the top, a pushed screen has a header there. */
    edges?: Edge[];
    /** Drawn over the page, outside the scroll view - a floating totals bar. */
    overlay?: ReactNode;
    /** A tab's own screen: the menu bar across the top, as on every dashboard screen. */
    navbar?: boolean;
    /** The scroll view, for a page that scrolls to a section of itself. */
    scrollRef?: Ref<ScrollView>;
};

/**
 * The screen a page sits on: the dashboard's grey background, safe areas kept clear, and a
 * centred column on a wide tablet. Scrolls by default, with pull-to-refresh when the page offers
 * a reload.
 */
const Page = ({
    children,
    className = "",
    onRefresh,
    refreshing = false,
    scroll = true,
    edges,
    overlay,
    navbar = false,
    scrollRef,
}: Props) => {
    // The menu bar keeps the top clear itself.
    const safeEdges: Edge[] = edges ?? (navbar ? ["left", "right"] : ["top", "left", "right"]);

    return (
        <SafeAreaView edges={safeEdges} className="flex-1 bg-zinc-100 dark:bg-zinc-900">
            {navbar && <Navbar />}
            {/* Android doesn't reliably shrink the screen for the keyboard, so the page makes room
                for it; on iOS the scroll views below do that themselves. */}
            <KeyboardAvoider>
                {scroll ? (
                    <ScrollView
                        ref={scrollRef}
                        className="flex-1"
                        contentContainerClassName={cx(
                            "mx-auto w-full max-w-screen-2xl p-4 pb-28",
                            className
                        )}
                        keyboardShouldPersistTaps="handled"
                        automaticallyAdjustKeyboardInsets
                        contentInsetAdjustmentBehavior="automatic"
                        refreshControl={
                            onRefresh ? (
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                            ) : undefined
                        }
                    >
                        {children}
                    </ScrollView>
                ) : (
                    <View className={cx("mx-auto w-full max-w-screen-2xl flex-1", className)}>
                        {children}
                    </View>
                )}
                {overlay}
            </KeyboardAvoider>
        </SafeAreaView>
    );
};

export default Page;
