import { Image } from "expo-image";
import { useEffect, useEffectEvent, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import Button from "./Button";
import Text from "./Text";

type Props = {
    value?: string | null;
    onChange: (dataUrl: string | null) => void;
    height?: number;
};

/**
 * Finger-drawn signature capture. Each stroke is drawn as a smooth line while the finger moves,
 * and when it lifts the pad is captured as a transparent PNG data URL - the same thing the
 * dashboard hands back, which the receipt prints directly.
 */
const SignaturePad = ({ value, onChange, height = 180 }: Props) => {
    // The captured area, as state rather than a ref so the gesture never reads a ref.
    const [inkView, setInkView] = useState<View | null>(null);
    // The finished strokes, and the one being drawn while the finger is down.
    const [ink, setInk] = useState<{ strokes: string[]; current: string }>({
        strokes: [],
        current: "",
    });
    const [hasInk, setHasInk] = useState<boolean>(Boolean(value));
    // A signature captured earlier stays underneath, so backing out of the step keeps it.
    const [previous, setPrevious] = useState<string | null>(value ?? null);

    const report = useEffectEvent((dataUrl: string) => onChange(dataUrl));

    // Each finished stroke captures the pad, once it has drawn.
    useEffect(() => {
        if (ink.strokes.length === 0 || !inkView) return;
        const frame = requestAnimationFrame(async () => {
            try {
                const base64 = await captureRef(inkView, { format: "png", result: "base64" });
                report(`data:image/png;base64,${base64}`);
            } catch (error) {
                console.error("Capturing the signature failed", error);
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [ink.strokes, inkView]);

    const point = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;

    const pan = Gesture.Pan()
        .minDistance(0)
        .runOnJS(true)
        .onBegin((e) => setInk((d) => ({ ...d, current: `M${point(e.x, e.y)}` })))
        .onUpdate((e) => {
            setInk((d) => ({ ...d, current: `${d.current} L${point(e.x, e.y)}` }));
            setHasInk(true);
        })
        .onFinalize(() =>
            setInk((d) => (d.current ? { strokes: [...d.strokes, d.current], current: "" } : d))
        );

    const clear = () => {
        setInk({ strokes: [], current: "" });
        setPrevious(null);
        setHasInk(false);
        onChange(null);
    };

    return (
        <View>
            <View
                className="relative rounded-2xl border-2 border-dashed border-zinc-300 bg-white dark:border-zinc-600"
                style={{ height }}
            >
                <View className="absolute inset-x-8 bottom-8 border-b border-zinc-300" pointerEvents="none" />
                {!hasInk && (
                    <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
                        <Text className="text-base text-zinc-400">Sign here with your finger</Text>
                    </View>
                )}
                <GestureDetector gesture={pan}>
                    {/* The captured area: the strokes on a clear background. */}
                    <View ref={setInkView} collapsable={false} className="absolute inset-0">
                        {previous && (
                            <Image
                                source={{ uri: previous }}
                                contentFit="fill"
                                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                            />
                        )}
                        <Svg width="100%" height="100%">
                            {[...ink.strokes, ink.current].filter(Boolean).map((d, i) => (
                                <Path
                                    key={i}
                                    d={d}
                                    stroke="#111827"
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            ))}
                        </Svg>
                    </View>
                </GestureDetector>
            </View>

            <View className="mt-2 flex-row justify-end">
                <Button
                    text="Clear"
                    icon="fa-solid fa-eraser"
                    onClick={clear}
                    disabled={!hasInk}
                    className="min-h-[44px] bg-zinc-500 px-4 text-sm dark:bg-zinc-600"
                />
            </View>
        </View>
    );
};

export default SignaturePad;
