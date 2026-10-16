import type { ReactNode } from "react";
import { Modal, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KeyboardAvoider from "./KeyboardAvoider";
import LightStatusBar from "./LightStatusBar";
import ToastHost from "./ToastHost";

type Props = {
    /** The blue band across the top. */
    header: ReactNode;
    /** The buttons along the bottom. */
    footer: ReactNode;
    /** The content between them, which scrolls itself. */
    children: ReactNode;
    onClose: () => void;
};

/**
 * A screen handed to the customer - their details, their acknowledgements - covering the whole
 * app. The band and the buttons are kept clear of the notch, the Dynamic Island and the home
 * indicator using the app's own safe-area measurements, which are settled before the sheet slides
 * in; a safe-area view measuring itself inside the modal could catch it mid-animation and leave
 * the band under the Dynamic Island. The content makes room for the keyboard on both platforms.
 */
const FullScreenSheet = ({ header, footer, children, onClose }: Props) => {
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            {/* A modal is outside the app's gesture root on Android, so it needs its own. Its
                colours go on the view inside: NativeWind doesn't style the gesture root. */}
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View className="flex-1 bg-zinc-50 dark:bg-zinc-900">
                    <LightStatusBar />
                    <View
                        className="bg-sky-700 dark:bg-sky-800"
                        style={{
                            paddingTop: insets.top,
                            paddingLeft: insets.left,
                            paddingRight: insets.right,
                        }}
                    >
                        {header}
                    </View>

                    <KeyboardAvoider ios>
                        <View
                            className="flex-1"
                            style={{ paddingLeft: insets.left, paddingRight: insets.right }}
                        >
                            {children}
                        </View>

                        <View
                            className="border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                            style={{
                                paddingBottom: insets.bottom,
                                paddingLeft: insets.left,
                                paddingRight: insets.right,
                            }}
                        >
                            {footer}
                        </View>
                    </KeyboardAvoider>
                </View>
            </GestureHandlerRootView>
            <ToastHost />
        </Modal>
    );
};

export default FullScreenSheet;
