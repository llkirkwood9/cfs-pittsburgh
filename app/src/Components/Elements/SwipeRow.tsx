import { useRef } from "react";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Icon from "./Icon";
import Text from "./Text";
import { useTheme } from "../../Hooks/UseTheme";
import { cx } from "../../Lib/ClassNames";

export type SwipeAction = {
    label: string;
    icon: string;
    onPress: () => void;
    /** The button's colour: red for anything that deletes or removes. */
    tone?: "danger" | "neutral" | "sky" | "orange" | "amber";
};

type Props = {
    children: ReactNode;
    /** What tapping the row does, usually opening its editor. Leave out for a row you can't open. */
    onPress?: () => void;
    /** The buttons a swipe to the left uncovers, from left to right. */
    actions?: SwipeAction[];
    /** What a screen reader says for the row. */
    accessibilityLabel?: string;
    /**
     * More actions for screen readers only, for what sighted users do by gesture - moving a row
     * that is otherwise dragged into place.
     */
    accessibilityOnlyActions?: { label: string; onPress: () => void }[];
    /** Classes for the inside of the card: padding, layout, a coloured edge. */
    className?: string;
    /** Classes for the card itself, such as an indent. */
    containerClassName?: string;
    /**
     * "card", the default, is a rounded, raised card of its own; "row" is a plain row inside a
     * card, such as one size of a product.
     */
    variant?: "card" | "row";
};

const tones: Record<NonNullable<SwipeAction["tone"]>, string> = {
    danger: "bg-red-700 dark:bg-red-600",
    neutral: "bg-zinc-500 dark:bg-zinc-600",
    sky: "bg-sky-700 dark:bg-sky-600",
    orange: "bg-orange-700 dark:bg-orange-600",
    amber: "bg-amber-600",
};

/** The row whose actions are showing, so opening another one closes it. */
let openRow: SwipeableMethods | null = null;

/**
 * A list row that keeps its buttons out of the way: tap it to open it, swipe it to the left to
 * uncover its other actions - add a service, remove, delete. Screen readers get the same actions
 * from the row's actions menu, since a swipe isn't something they can see.
 */
const SwipeRow = ({
    children,
    onPress,
    actions = [],
    accessibilityLabel,
    accessibilityOnlyActions = [],
    className = "",
    containerClassName = "",
    variant = "card",
}: Props) => {
    const isCard = variant === "card";
    const { isDark } = useTheme();
    // Every action, for the screen reader's actions menu.
    const spoken = [...actions, ...accessibilityOnlyActions];
    const accessibility = {
        accessibilityActions: spoken.map((a) => ({ name: a.label, label: a.label })),
        onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) =>
            spoken.find((a) => a.label === event.nativeEvent.actionName)?.onPress(),
    };
    const swipeable = useRef<SwipeableMethods>(null);
    // Whether the row's actions are showing, and when a swipe last started.
    const open = useRef<boolean>(false);
    const lastSwipe = useRef<number>(0);

    // A tap on an open row closes it, as in iOS lists, and the end of a swipe isn't a tap.
    const press = () => {
        if (Date.now() - lastSwipe.current < 400) return;
        if (open.current) return swipeable.current?.close();
        onPress?.();
    };

    // The card's background is on the row too, so it covers the buttons until it slides away.
    const inner = cx(isCard && "rounded-xl", "bg-white dark:bg-zinc-800", className);

    const content = onPress ? (
        <Pressable
            onPress={press}
            // Holding a row is the start of a drag in a list that can be reordered, so a press that
            // long isn't a tap. It matches SortableList's drag delay.
            onLongPress={() => {}}
            delayLongPress={300}
            // In a browser a button can't hold the row's own buttons, such as a quantity stepper.
            accessibilityRole={Platform.OS === "web" ? undefined : "button"}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={actions.length ? "Swipe left for more actions" : undefined}
            {...accessibility}
            // Wait a moment before showing the press, so a touch that turns into a swipe doesn't
            // flash it, as iOS lists do.
            unstable_pressDelay={120}
            className={inner}
        >
            {({ pressed }) => (
                <>
                    {children}
                    {/* The press is a shade over the row rather than fading it: a see-through row
                        would show the buttons behind it as a swipe begins. */}
                    {pressed && (
                        <View
                            pointerEvents="none"
                            style={[
                                StyleSheet.absoluteFill,
                                {
                                    borderRadius: isCard ? 12 : 0,
                                    backgroundColor: isDark
                                        ? "rgba(255, 255, 255, 0.06)"
                                        : "rgba(0, 0, 0, 0.05)",
                                },
                            ]}
                        />
                    )}
                </>
            )}
        </Pressable>
    ) : (
        <View
            accessibilityLabel={accessibilityLabel}
            {...accessibility}
            className={inner}
        >
            {children}
        </View>
    );

    // The shadow and rounding are on a card around the swipeable, which clips what it holds.
    const card = cx(isCard && "rounded-xl bg-white raised-sm dark:bg-zinc-800", containerClassName);

    if (actions.length === 0) return <View className={card}>{content}</View>;

    return (
        <View className={card}>
            <ReanimatedSwipeable
                ref={swipeable}
                friction={1.5}
                rightThreshold={40}
                overshootRight={false}
                // Rounded like the card, so the buttons sit inside its shape.
                containerStyle={{ borderRadius: isCard ? 12 : 0, overflow: "hidden" }}
                onSwipeableOpenStartDrag={() => (lastSwipe.current = Date.now())}
                onSwipeableCloseStartDrag={() => (lastSwipe.current = Date.now())}
                onSwipeableWillOpen={() => {
                    if (openRow && openRow !== swipeable.current) openRow.close();
                    openRow = swipeable.current;
                }}
                onSwipeableOpen={() => (open.current = true)}
                onSwipeableClose={() => {
                    open.current = false;
                    if (openRow === swipeable.current) openRow = null;
                }}
                renderRightActions={(_progress, _translation, methods) => (
                    <View className="flex-row">
                        {actions.map((action) => (
                            <Pressable
                                key={action.label}
                                onPress={() => {
                                    methods.close();
                                    action.onPress();
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={action.label}
                                className={cx(
                                    "w-20 items-center justify-center gap-1 px-1 active:opacity-80",
                                    tones[action.tone ?? "neutral"]
                                )}
                            >
                                <Icon icon={action.icon} className="text-lg text-white" />
                                <Text
                                    className="text-center text-xs font-semibold text-white"
                                    numberOfLines={2}
                                >
                                    {action.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            >
                {content}
            </ReanimatedSwipeable>
        </View>
    );
};

export default SwipeRow;
