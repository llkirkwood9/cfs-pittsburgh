import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Keyboard, LayoutAnimation, Platform, View } from "react-native";
import type { KeyboardEvent, StyleProp, ViewStyle } from "react-native";
import { cx } from "../../Lib/ClassNames";

type Props = {
    children: ReactNode;
    className?: string;
    style?: StyleProp<ViewStyle>;
    /**
     * Also make room on iOS. Off by default, because scroll views there move their own content
     * clear of the keyboard (automaticallyAdjustKeyboardInsets); turn it on where content doesn't
     * scroll with it, such as a sheet's footer buttons.
     */
    ios?: boolean;
};

/**
 * Keeps what it holds clear of the on-screen keyboard by padding its bottom by however much of it
 * the keyboard covers. It measures where it sits on the screen, so it works anywhere - under a
 * header, above a tab bar, inside a modal - and on Android it works whether or not the system
 * shrinks the window for the keyboard, which an edge-to-edge app can't rely on. When the window
 * does shrink, nothing is covered and it adds nothing. A scroll view inside gets shorter, so the
 * field being typed in stays in view.
 */
const KeyboardAvoider = ({ children, className = "", style, ios = false }: Props) => {
    const ref = useRef<View>(null);
    const [covered, setCovered] = useState<number>(0);
    const enabled = Platform.OS === "android" || (ios && Platform.OS === "ios");

    useEffect(() => {
        if (!enabled) return;

        // iOS says where the keyboard is going before it moves, so the space can open with it.
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const animate = (event: KeyboardEvent) => {
            if (Platform.OS === "ios" && event.duration)
                LayoutAnimation.configureNext({
                    duration: event.duration,
                    update: { type: LayoutAnimation.Types.keyboard },
                });
        };

        const show = Keyboard.addListener(showEvent, (event) => {
            ref.current?.measureInWindow((_x, y, _width, height) => {
                animate(event);
                setCovered(Math.max(0, y + height - event.endCoordinates.screenY));
            });
        });
        const hide = Keyboard.addListener(hideEvent, (event) => {
            animate(event);
            setCovered(0);
        });

        return () => {
            show.remove();
            hide.remove();
        };
    }, [enabled]);

    return (
        <View
            ref={ref}
            className={cx("flex-1", className)}
            style={[style, { paddingBottom: covered }]}
        >
            {children}
        </View>
    );
};

export default KeyboardAvoider;
