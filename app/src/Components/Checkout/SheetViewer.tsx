import { useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import { SHEET_WIDTH } from "../../Lib/SheetPdf";

type Props = {
    children: ReactNode;
};

/**
 * Shows a paper-width sheet scaled to fit the screen - the whole page at once on a phone, full
 * size on a tablet wide enough for it - while the sheet itself stays laid out at paper width, so
 * the PDF made from it is the same on every device.
 */
const SheetViewer = ({ children }: Props) => {
    const [available, setAvailable] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);
    const scale = available > 0 ? Math.min(1, available / SHEET_WIDTH) : 1;

    return (
        <View
            onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}
            style={{ width: "100%", alignItems: "center" }}
        >
            <View
                style={{
                    width: SHEET_WIDTH * scale,
                    height: height > 0 ? height * scale : undefined,
                    overflow: "hidden",
                }}
            >
                <View
                    onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
                    style={{
                        width: SHEET_WIDTH,
                        transform: [{ scale }],
                        transformOrigin: "top left",
                        shadowColor: "#000",
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 2 },
                    }}
                >
                    {children}
                </View>
            </View>
        </View>
    );
};

export default SheetViewer;
