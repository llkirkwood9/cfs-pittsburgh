import Modal from "./Modal";

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

const chart = `${import.meta.env.BASE_URL}mattress_sizes.png`;

/**
 * A quick reference for the mattress sizes: the chart drawing them to scale against each other,
 * with the same measurements listed underneath.
 */
const SizeGuideModal = ({ onClose }: Props) => (
    <Modal title="Mattress sizes" onClose={onClose} wide>
        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
            {/* The chart is drawn on white, so it keeps a white card in dark mode too. */}
            <a
                href={chart}
                target="_blank"
                rel="noreferrer"
                title="Open the chart full size"
                className="block rounded-xl p-2 shadow-xs"
            >
                <img
                    src={chart}
                    alt="Mattress sizes drawn to scale: Twin 38 by 75 inches, Twin XL 38 by 80, Full 53 by 75, Queen 60 by 80, King 76 by 80 and California King 72 by 84."
                    className="mx-auto max-h-[60vh] w-auto object-contain"
                />
            </a>

            <div>
                <table className="w-full text-left text-base">
                    <thead>
                        <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                            <th className="py-2 font-semibold">Size</th>
                            <th className="py-2 text-right font-semibold">Width x length</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sizes.map((size) => (
                            <tr
                                key={size.name}
                                className="border-b border-zinc-100 last:border-0 dark:border-zinc-700/60 text-zinc-900 dark:text-zinc-100"
                            >
                                <td className="py-2 font-semibold">{size.name}</td>
                                <td className="py-2 text-right tabular-nums">
                                    {size.width}&quot; x {size.length}&quot;
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    Inches, width by length.
                </p>
            </div>
        </div>
    </Modal>
);

export default SizeGuideModal;
