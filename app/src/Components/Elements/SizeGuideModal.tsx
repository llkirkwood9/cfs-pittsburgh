import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Modal from "./Modal";
import Text from "./Text";

type Props = {
    onClose: () => void;
};

/** The standard mattress sizes, width by length in inches, as the chart shows them. */
const sizes: { name: string; width: number; length: number }[] = [
    { name: "Twin", width: 38, length: 75 },
    { name: "Twin XL", width: 38, length: 80 },
    { name: "Full", width: 53, length: 75 },
    { name: "Queen", width: 60, length: 80 },
    { name: "King", width: 76, length: 80 },
    { name: "California King", width: 72, length: 84 },
];

const chart = require("../../../assets/images/mattress_sizes.png");

/**
 * A quick reference for the mattress sizes: the chart drawing them to scale against each other,
 * with the same measurements listed underneath. Tap the chart to see it full screen.
 */
const SizeGuideModal = ({ onClose }: Props) => {
    const { width } = useWindowDimensions();
    const [full, setFull] = useState<boolean>(false);
    const sideBySide = width >= 768;

    if (full) {
        return (
            <Modal title="Mattress sizes" onClose={() => setFull(false)} wide>
                <Pressable onPress={() => setFull(false)} accessibilityLabel="Close the full-size chart">
                    <View className="rounded-xl bg-white p-2">
                        <Image
                            source={chart}
                            contentFit="contain"
                            style={{ width: "100%", aspectRatio: 1869 / 1999 }}
                        />
                    </View>
                </Pressable>
            </Modal>
        );
    }

    return (
        <Modal title="Mattress sizes" onClose={onClose} wide>
            <View className={sideBySide ? "flex-row items-start gap-4" : "gap-4"}>
                {/* The chart is drawn on white, so it keeps a white card in dark mode too. */}
                <Pressable
                    onPress={() => setFull(true)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="Mattress sizes drawn to scale. Tap to open the chart full size."
                    className={sideBySide ? "flex-[3]" : ""}
                >
                    <View className="rounded-xl bg-white p-2 raised-sm">
                        <Image
                            source={chart}
                            contentFit="contain"
                            style={{ width: "100%", aspectRatio: 1869 / 1999 }}
                        />
                    </View>
                </Pressable>

                <View className={sideBySide ? "flex-[2]" : ""}>
                    <View className="flex-row border-b border-zinc-200 py-2 dark:border-zinc-700">
                        <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Size
                        </Text>
                        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Width x length
                        </Text>
                    </View>
                    {sizes.map((size, i) => (
                        <View
                            key={size.name}
                            className={
                                i < sizes.length - 1
                                    ? "flex-row border-b border-zinc-100 py-2 dark:border-zinc-700/60"
                                    : "flex-row py-2"
                            }
                        >
                            <Text className="flex-1 font-semibold">{size.name}</Text>
                            <Text className="tabular-nums">
                                {size.width}&quot; x {size.length}&quot;
                            </Text>
                        </View>
                    ))}
                    <Text className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                        Inches, width by length. A Split King is two Twin XLs side by side -
                        together the size of a King (76&quot; x 80&quot;). Tap the chart to see it
                        full size.
                    </Text>
                </View>
            </View>
        </Modal>
    );
};

export default SizeGuideModal;
