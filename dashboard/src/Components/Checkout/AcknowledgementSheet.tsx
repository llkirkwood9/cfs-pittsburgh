import { useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import SignaturePad from "../Elements/SignaturePad";
import { useLockBodyScroll } from "../../Hooks/UseLockBodyScroll";
import { Toast } from "../../Lib/Toast";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    onSave: (changes: Order) => Promise<void>;
    onClose: () => void;
};

type Acknowledgement = {
    key: "warrantyInitials" | "dropShipInitials" | "advisoryInitials";
    heading: string;
    summary: string;
    detail: string;
};

/**
 * The three paragraphs from the bottom of the sales sheet, reworded into plain language for the
 * customer. The legal wording is still printed verbatim on the receipt they sign for; this is the
 * explanation that goes with it.
 */
const acknowledgements: Acknowledgement[] = [
    {
        key: "warrantyInitials",
        heading: "Warranty & mattress protectors",
        summary: "Your warranty is with the manufacturer, and it needs a protector to stay valid.",
        detail:
            "Customer service and warranty issues are handled by the manufacturer, not by CFS. " +
            "Every manufacturer requires a mattress protector, and they can refuse service or void " +
            "the warranty if the bed has any stains, tears, burns, odours or pet hair - even if the " +
            "product itself is faulty. A warranty claim covers the replacement item only, not " +
            "delivery or set-up.",
    },
    {
        key: "dropShipInitials",
        heading: "How your bed arrives",
        summary: "It ships straight to your door, boxed, and no one needs to be home to sign.",
        detail:
            "All items are drop shipped directly to you unless noted otherwise, and no signature is " +
            "needed at delivery. The mattress arrives compressed, vacuum sealed and boxed. It can be " +
            "heavy, so you may need a second pair of hands to move it. Once opened it recovers fully " +
            "within 24 to 48 hours, though sleeping on it sooner will not harm it.",
    },
    {
        key: "advisoryInitials",
        heading: "All sales are final",
        summary: "This is a fundraiser, and part of what you pay goes straight to the organization.",
        detail:
            "This is a sanctioned fundraising event and a portion of the proceeds is allocated " +
            "directly to the organization named on your receipt. Because of that, all sales and " +
            "transactions are final.",
    },
];

/**
 * The tablet is turned around for this. The customer reads each point, initials it, then signs
 * once at the end. Progress is explicit so nobody is initialling something they have not seen,
 * and everything is written back in a single save.
 */
const AcknowledgementSheet = ({ order, onSave, onClose }: Props) => {
    useLockBodyScroll();

    const [step, setStep] = useState<number>(0);
    const [initials, setInitials] = useState<Record<string, string>>({
        warrantyInitials: order.warrantyInitials ?? "",
        dropShipInitials: order.dropShipInitials ?? "",
        advisoryInitials: order.advisoryInitials ?? "",
    });
    const [signature, setSignature] = useState<string | null>(order.customerSignature ?? null);
    const [printedName, setPrintedName] = useState<string>(
        order.customerSignatureName ?? order.billingName ?? ""
    );
    const [saving, setSaving] = useState<boolean>(false);

    const totalSteps = acknowledgements.length + 1;
    const isSignatureStep = step === acknowledgements.length;
    const current = acknowledgements[step];

    const next = () => {
        if (!isSignatureStep && !initials[current.key].trim())
            return Toast.Warning("Please add your initials to continue.");

        setStep((value) => Math.min(value + 1, totalSteps - 1));
    };

    const handleFinish = async () => {
        if (!printedName.trim()) return Toast.Warning("Please print your name.");
        if (!signature) return Toast.Warning("Please sign in the box above.");

        setSaving(true);
        await onSave({
            id: order.id,
            warrantyInitials: initials.warrantyInitials.trim(),
            dropShipInitials: initials.dropShipInitials.trim(),
            advisoryInitials: initials.advisoryInitials.trim(),
            customerSignatureName: printedName.trim(),
            customerSignature: signature,
            signedDate: new Date().toISOString(),
        });
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50 dark:bg-zinc-900">
            <header className="shrink-0 bg-sky-700 px-5 py-4 text-white dark:bg-sky-800">
                <div className="mx-auto max-w-3xl">
                    <div className="flex items-center gap-3">
                        <Icon icon="fa-solid fa-file-signature" className="text-2xl" />
                        <div>
                            <h1 className="text-xl font-bold leading-tight">
                                A few things to confirm
                            </h1>
                            <p className="text-sm text-sky-100">
                                Step {step + 1} of {totalSteps}
                            </p>
                        </div>
                    </div>

                    <div className="mt-3 flex gap-1.5">
                        {Array.from({ length: totalSteps }).map((_, index) => (
                            <span
                                key={index}
                                className={`h-1.5 flex-1 rounded-full ${
                                    index <= step ? "bg-white" : "bg-white/30"
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto max-w-3xl">
                    {!isSignatureStep ? (
                        <>
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                {current.heading}
                            </h2>
                            <p className="mt-2 text-lg font-medium text-sky-800 dark:text-sky-300">
                                {current.summary}
                            </p>
                            <p className="mt-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                                {current.detail}
                            </p>

                            <label className="mt-8 block">
                                <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                    Your initials
                                </span>
                                <input
                                    value={initials[current.key]}
                                    onChange={(e) =>
                                        setInitials((value) => ({
                                            ...value,
                                            [current.key]: e.target.value.toUpperCase(),
                                        }))
                                    }
                                    maxLength={10}
                                    autoCapitalize="characters"
                                    autoCorrect="off"
                                    placeholder="AB"
                                    className="mt-2 min-h-[72px] w-40 rounded-2xl border-2 border-zinc-300 bg-white
                                        text-center text-3xl font-bold tracking-widest text-zinc-900 outline-none
                                        focus:border-sky-600 focus:ring-4 focus:ring-sky-600/20
                                        dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                            </label>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                Sign to finish
                            </h2>
                            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
                                Your signature confirms the three points you just initialled.
                            </p>

                            <label className="mt-6 block">
                                <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                    Print your name
                                </span>
                                <input
                                    value={printedName}
                                    onChange={(e) => setPrintedName(e.target.value)}
                                    maxLength={150}
                                    autoCapitalize="words"
                                    className="mt-2 min-h-[60px] w-full rounded-2xl border-2 border-zinc-300 bg-white px-4
                                        text-lg text-zinc-900 outline-none focus:border-sky-600
                                        focus:ring-4 focus:ring-sky-600/20
                                        dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                            </label>

                            <div className="mt-6">
                                <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                    Signature
                                </span>
                                <div className="mt-2">
                                    <SignaturePad value={signature} onChange={setSignature} />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-700 dark:bg-zinc-800">
                <div className="mx-auto flex max-w-3xl gap-3">
                    <Button
                        text={step === 0 ? "Cancel" : "Back"}
                        icon={step === 0 ? undefined : "fa-solid fa-arrow-left"}
                        onClick={() => (step === 0 ? onClose() : setStep((value) => value - 1))}
                        className="min-h-[60px] bg-zinc-500 px-6 text-lg hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    {isSignatureStep ? (
                        <Button
                            text="Done"
                            icon="fa-solid fa-check"
                            onClick={handleFinish}
                            loading={saving}
                            className="min-h-[60px] flex-1 bg-green-700 text-lg hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                    ) : (
                        <Button
                            text="I understand"
                            icon="fa-solid fa-arrow-right"
                            onClick={next}
                            className="min-h-[60px] flex-1 text-lg"
                        />
                    )}
                </div>
            </footer>
        </div>
    );
};

export default AcknowledgementSheet;
