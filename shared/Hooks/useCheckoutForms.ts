import { useEffect, useState } from "react";
import { Toast } from "@host";
import { AcknowledgementSteps } from "../Lib/Checkout";
import { ParseMoney } from "../Lib/Format";
import { RequiredTerms } from "../Lib/Orders";
import type { FinanceOption } from "../Models/FinanceOption";
import type { Order } from "../Models/Order";
import type { OrderPayment, PaymentMethod } from "../Models/OrderPayment";
import { GetFinanceOptions } from "../Services/FinanceOptionServices";

/** The financing type picker's value for Other. */
export const OTHER_FINANCE = "__other__";

/**
 * The Payment Options box at the checkout table. An order can be split across several methods.
 * Financing also takes the financing number and the type of financing, picked from the
 * territory's financing options - or typed in under Other.
 * @param order The order.
 * @param onAdd Records a payment.
 * @param onMethodChange Puts the card fee on or takes it off for the method picked.
 * @param onWaiveFee Takes the card fee off the order, or puts it back.
 * @returns The panel's state and handlers.
 */
export const useCheckoutPayment = (
    order: Order,
    onAdd: (payment: OrderPayment) => Promise<void>,
    onMethodChange: (method: PaymentMethod) => Promise<void>,
    onWaiveFee: (waive: boolean) => Promise<void>
) => {
    const [financeOptions, setFinanceOptions] = useState<FinanceOption[]>([]);

    useEffect(() => {
        GetFinanceOptions(false, order.territoryId).then((options) =>
            setFinanceOptions(options ?? [])
        );
    }, [order.territoryId]);
    // Cash is the default. It carries no card fee, so the selection shown always matches the
    // total shown; an order already switched to card reopens on card.
    const [method, setMethod] = useState<PaymentMethod>(
        order.applyCcProcessingFee ? "VisaMc" : "Cash"
    );
    const [amount, setAmount] = useState<string>("");
    const [checkNumber, setCheckNumber] = useState<string>("");
    // An option's name, OTHER_FINANCE, or "" before anything is picked.
    const [financeChoice, setFinanceChoice] = useState<string>("");
    const [otherType, setOtherType] = useState<string>("");
    const [financeNumber, setFinanceNumber] = useState<string>("");
    const [saving, setSaving] = useState<boolean>(false);

    const feeRate = order.ccProcessingFeeRate ?? 0;
    // Shows the tick straight away while the order saves, then follows the saved order.
    const [pendingWaive, setPendingWaive] = useState<boolean | null>(null);
    const waived = pendingWaive ?? order.waiveCcProcessingFee ?? false;

    const toggleWaive = async (waive: boolean) => {
        setPendingWaive(waive);
        await onWaiveFee(waive);
        setPendingWaive(null);
    };

    // Picking a method is what turns the card fee on and off, so the customer sees the real
    // total before anything is keyed in rather than after.
    const chooseMethod = async (next: PaymentMethod) => {
        if (next === method) return;

        setMethod(next);
        setAmount("");
        if (feeRate > 0) await onMethodChange(next);
    };

    const add = async () => {
        const parsed = ParseMoney(amount);
        if (parsed === null || parsed <= 0) return void Toast.Warning("Enter an amount to record.");

        if (method === "Check" && !checkNumber.trim())
            return void Toast.Warning("Enter the check number.");

        const financing = method === "Financing";
        const financeType = financeChoice === OTHER_FINANCE ? otherType : financeChoice;
        if (financing && financeChoice === OTHER_FINANCE && !otherType.trim())
            return void Toast.Warning("Type in the kind of financing.");
        if (financing && !financeType.trim())
            return void Toast.Warning("Choose the type of financing.");
        if (financing && !financeNumber.trim())
            return void Toast.Warning("Enter the financing number.");

        setSaving(true);
        await onAdd({
            method,
            amount: parsed,
            checkNumber: method === "Check" ? checkNumber.trim() : undefined,
            financeType: financing ? financeType.trim() : undefined,
            reference: financing ? financeNumber.trim() : undefined,
        });
        setSaving(false);

        setAmount("");
        setCheckNumber("");
        setFinanceChoice("");
        setOtherType("");
        setFinanceNumber("");
    };

    return {
        financeOptions,
        method,
        chooseMethod,
        amount,
        setAmount,
        checkNumber,
        setCheckNumber,
        financeChoice,
        setFinanceChoice,
        otherType,
        setOtherType,
        financeNumber,
        setFinanceNumber,
        balance: order.balanceDue ?? 0,
        feeRate,
        /** The fee waiver is saving. */
        waiving: pendingWaive !== null,
        waived,
        toggleWaive,
        /** A card is in play: picked now, or already paid with - so the No card fee box shows. */
        cardInPlay:
            method === "VisaMc" || (order.payments ?? []).some((p) => p.method === "VisaMc"),
        saving,
        add,
    };
};

/**
 * The customer's acknowledgements: they read each statement the order needs, initial it, then
 * sign once at the end. Everything is written back in a single save.
 * @param order The order.
 * @param onSave Saves the initials and signature.
 * @param onClose Closes the sheet.
 * @returns The sheet's steps, values and handlers.
 */
export const useCheckoutAcknowledgements = (
    order: Order,
    onSave: (changes: Order) => Promise<void>,
    onClose: () => void
) => {
    const [step, setStep] = useState<number>(0);
    const [initials, setInitials] = useState<Record<string, string>>({
        customerInfoInitials: order.customerInfoInitials ?? "",
        warrantyInitials: order.warrantyInitials ?? "",
        dropShipInitials: order.dropShipInitials ?? "",
        advisoryInitials: order.advisoryInitials ?? "",
    });
    const [signature, setSignature] = useState<string | null>(order.customerSignature ?? null);
    const [printedName, setPrintedName] = useState<string>(
        order.customerSignatureName ?? order.billingName ?? ""
    );
    const [saving, setSaving] = useState<boolean>(false);

    // Only the statements this order needs - a pillow taken home today skips the warranty, drop
    // ship and details steps - then the signature.
    const required = RequiredTerms(order);
    const steps = AcknowledgementSteps.filter((s) => required.includes(s.term));
    const totalSteps = steps.length + 1;
    const isSignatureStep = step === steps.length;
    // With no statements to initial the sheet opens on the signature, and this is never shown.
    const current =
        steps[Math.min(step, steps.length - 1)] ??
        AcknowledgementSteps[AcknowledgementSteps.length - 1];

    const next = () => {
        if (!isSignatureStep && !initials[current.key].trim())
            return void Toast.Warning("Please add your initials to continue.");

        setStep((value) => Math.min(value + 1, totalSteps - 1));
    };

    /** Back a step, or closes the sheet from the first. */
    const back = () => (step === 0 ? onClose() : setStep((value) => value - 1));

    const finish = async () => {
        if (!printedName.trim()) return void Toast.Warning("Please print your name.");
        if (!signature) return void Toast.Warning("Please sign in the box above.");

        setSaving(true);
        await onSave({
            id: order.id,
            customerInfoInitials: initials.customerInfoInitials.trim(),
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

    return {
        step,
        totalSteps,
        isSignatureStep,
        current,
        /** The initials for the statement on screen. */
        currentInitials: initials[current.key],
        /** Sets them, in capitals. */
        setCurrentInitials: (text: string) =>
            setInitials((value) => ({ ...value, [current.key]: text.toUpperCase() })),
        signature,
        setSignature,
        printedName,
        setPrintedName,
        saving,
        next,
        back,
        finish,
    };
};
