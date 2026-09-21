import { useEffect, useRef, useState } from "react";
import Button from "./Button";

type Props = {
    value?: string | null;
    onChange: (dataUrl: string | null) => void;
    height?: number;
};

/**
 * Finger-drawn signature capture. Draws at the device pixel ratio so the line stays crisp on a
 * retina tablet, and hands back a transparent PNG data URL that the receipt prints directly.
 */
const SignaturePad = ({ value, onChange, height = 180 }: Props) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef<boolean>(false);
    const [hasInk, setHasInk] = useState<boolean>(Boolean(value));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;

        const context = canvas.getContext("2d");
        if (!context) return;

        context.scale(ratio, ratio);
        context.lineWidth = 2.5;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "#111827";

        // Re-drawing a previously captured signature keeps it on screen if the customer
        // backs out of the step and returns.
        if (value) {
            const image = new Image();
            image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
            image.src = value;
        }
    }, [value]);

    const positionOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const context = canvasRef.current?.getContext("2d");
        if (!context) return;

        event.currentTarget.setPointerCapture(event.pointerId);
        drawing.current = true;

        const { x, y } = positionOf(event);
        context.beginPath();
        context.moveTo(x, y);
    };

    const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;

        const context = canvasRef.current?.getContext("2d");
        if (!context) return;

        const { x, y } = positionOf(event);
        context.lineTo(x, y);
        context.stroke();
        setHasInk(true);
    };

    const end = () => {
        if (!drawing.current) return;

        drawing.current = false;
        const canvas = canvasRef.current;
        if (canvas) onChange(canvas.toDataURL("image/png"));
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        setHasInk(false);
        onChange(null);
    };

    return (
        <div>
            <div className="relative rounded-2xl border-2 border-dashed border-zinc-300 bg-white dark:border-zinc-600">
                <canvas
                    ref={canvasRef}
                    style={{ height, touchAction: "none" }}
                    className="w-full rounded-2xl"
                    onPointerDown={start}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerLeave={end}
                    onPointerCancel={end}
                />
                {!hasInk && (
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center
                        text-base text-zinc-400">
                        Sign here with your finger
                    </p>
                )}
                <div className="pointer-events-none absolute inset-x-8 bottom-8 border-b border-zinc-300" />
            </div>

            <div className="mt-2 flex justify-end">
                <Button
                    text="Clear"
                    icon="fa-solid fa-eraser"
                    onClick={clear}
                    disabled={!hasInk}
                    className="min-h-[44px] bg-zinc-500 px-4 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                />
            </div>
        </div>
    );
};

export default SignaturePad;
