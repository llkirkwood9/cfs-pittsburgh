import type { ReactNode } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import SignaturePad from "../Elements/SignaturePad";
import { useLockBodyScroll } from "../../Hooks/UseLockBodyScroll";
import TermText from "../Elements/TermText";
import { useSettingsFor } from "@shared/Context/SettingsContext";
import { useCheckoutAcknowledgements } from "@shared/Hooks/useCheckoutForms";
import { DetailsSummaryOf } from "@shared/Lib/Checkout";
import { TermFor } from "@shared/Models/GeneralSettings";
import type { Order } from "@shared/Models/Order";

type Props = {
    order: Order;
    onSave: (changes: Order) => Promise<void>;
    onClose: () => void;
};

/**
 * Everything the customer is confirming on the first step: who they are, how to reach them, where
 * the order goes and how each item is getting there.
 */
const DetailsSummary = ({ order }: { order: Order }) => {
    const { billing, delivery, phones, items } = DetailsSummaryOf(order);

    const missing = <span className="italic text-amber-700 dark:text-amber-400">Not given</span>;

    const row = (label: string, value: ReactNode) => (
        <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </dt>
            <dd className="text-lg text-zinc-900 dark:text-zinc-100">{value}</dd>
        </div>
    );

    return (
        <dl className="mt-6 divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white px-5 dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
            {row("Name", order.billingName || missing)}
            {row(
                "Address",
                billing.length
                    ? billing.map((l) => (
                          <span key={l} className="block">
                              {l}
                          </span>
                      ))
                    : missing
            )}
            {row("Phone", phones || missing)}
            {row("Email", order.billingEmail || missing)}
            {row(
                "Deliver to",
                delivery === null ? (
                    "Same as the address above"
                ) : (
                    <>
                        {order.deliveryName && <span className="block">{order.deliveryName}</span>}
                        {delivery.length
                            ? delivery.map((l) => (
                                  <span key={l} className="block">
                                      {l}
                                  </span>
                              ))
                            : missing}
                        {order.deliveryCell && <span className="block">{order.deliveryCell}</span>}
                    </>
                )
            )}
            {items.length > 0 &&
                row(
                    "How it arrives",
                    items.map((item) => (
                        <span key={item.id} className="block">
                            {item.name}{" "}
                            <span className="text-zinc-500 dark:text-zinc-400">- {item.how}</span>
                        </span>
                    ))
                )}
        </dl>
    );
};

/**
 * The tablet is turned around for this. The customer reads each point, initials it, then signs
 * once at the end. Progress is explicit so nobody is initialling something they have not seen,
 * and everything is written back in a single save.
 */
const AcknowledgementSheet = ({ order, onSave, onClose }: Props) => {
    useLockBodyScroll();
    // The same wording the sales sheet prints beside each set of initials, set under Settings for
    // the territory the sale is being taken in.
    const settings = useSettingsFor(order.territoryId);

    const {
        step,
        totalSteps,
        isSignatureStep,
        current,
        currentInitials,
        setCurrentInitials,
        signature,
        setSignature,
        printedName,
        setPrintedName,
        saving,
        next,
        back,
        finish,
    } = useCheckoutAcknowledgements(order, onSave, onClose);
    const term = TermFor(settings.terms, current.term);

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
                                {term.title}
                            </h2>
                            <p className="mt-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                                <TermText text={term.text} />
                            </p>
                            {current.key === "customerInfoInitials" && (
                                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                                    If anything below is wrong, tap Cancel and let us know before
                                    you initial.
                                </p>
                            )}

                            {current.key === "customerInfoInitials" && (
                                <DetailsSummary order={order} />
                            )}

                            <label className="mt-8 block">
                                <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                    Your initials
                                </span>
                                <input
                                    value={currentInitials}
                                    onChange={(e) => setCurrentInitials(e.target.value)}
                                    maxLength={10}
                                    autoCapitalize="characters"
                                    autoCorrect="off"
                                    placeholder="AB"
                                    className="mt-2 min-h-[72px] w-40 rounded-2xl border-2 border-zinc-300 bg-white
                                        text-center text-3xl font-bold tracking-widest text-zinc-900 outline-hidden
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
                                Your signature confirms your details and the points you just
                                initialled.
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
                                        text-lg text-zinc-900 outline-hidden focus:border-sky-600
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
                        onClick={back}
                        className="min-h-[60px] bg-zinc-500 px-6 text-lg hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    {isSignatureStep ? (
                        <Button
                            text="Done"
                            icon="fa-solid fa-check"
                            onClick={finish}
                            loading={saving}
                            className="min-h-[60px] flex-1 bg-green-700 text-lg hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                    ) : (
                        <Button
                            text={
                                current.key === "customerInfoInitials"
                                    ? "My details are correct"
                                    : "I understand"
                            }
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
