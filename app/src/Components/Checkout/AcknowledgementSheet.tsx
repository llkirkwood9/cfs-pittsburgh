import { useState, type ReactNode } from "react";
import { TextInput, View } from "react-native";
// The gesture handler's scroll view, so a stroke on the signature pad wins over scrolling.
import { ScrollView } from "react-native-gesture-handler";
import Button from "../Elements/Button";
import FullScreenSheet from "../Elements/FullScreenSheet";
import Icon from "../Elements/Icon";
import SignaturePad from "../Elements/SignaturePad";
import Text from "../Elements/Text";
import { RenderTermText } from "../Elements/TermText";
import { useSettings } from "../../Context/SettingsContext";
import { useBreakpoint } from "../../Hooks/UseBreakpoint";
import { cx } from "../../Lib/ClassNames";
import { AddressLines, SortLinesForPrint } from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
import { TermFor } from "../../Models/GeneralSettings";
import type { SalesTermKey } from "../../Models/GeneralSettings";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    onSave: (changes: Order) => Promise<void>;
    onClose: () => void;
};

type InitialsKey =
    "customerInfoInitials" | "warrantyInitials" | "dropShipInitials" | "advisoryInitials";

/** Which of the order's initials each statement takes, in signing order. */
const steps: { term: SalesTermKey; key: InitialsKey }[] = [
    { term: "customerInfo", key: "customerInfoInitials" },
    { term: "warranty", key: "warrantyInitials" },
    { term: "dropShip", key: "dropShipInitials" },
    { term: "advisory", key: "advisoryInitials" },
];

/**
 * Everything the customer is confirming on the first step: who they are, how to reach them, where
 * the order goes and how each item is getting there.
 */
const DetailsSummary = ({ order }: { order: Order }) => {
    const { sm } = useBreakpoint();
    const billing = AddressLines({
        address: order.billingAddress,
        unit: order.billingUnit,
        floor: order.billingFloor,
        suite: order.billingSuite,
        city: order.billingCity,
        state: order.billingState,
        zip: order.billingZip,
    });
    const delivery = order.deliverySameAsBilling
        ? null
        : AddressLines({
              address: order.deliveryAddress,
              unit: order.deliveryUnit,
              floor: order.deliveryFloor,
              suite: order.deliverySuite,
              city: order.deliveryCity,
              state: order.deliveryState,
              zip: order.deliveryZip,
          });
    const phones = [order.billingCell, order.billingAlt].filter(Boolean).join(" / ");

    // Each item with the way it is leaving: its shipping row, or Take With.
    const lines = SortLinesForPrint(order.lines ?? []);
    const items = lines
        .filter((l) => l.lineType === "Product" || l.lineType === "Custom")
        .map((item) => {
            const methods = lines
                .filter((l) => l.parentLineId === item.id && l.lineType === "Delivery")
                .map((l) => l.description);
            return {
                id: item.id,
                name: `${item.quantity && item.quantity > 1 ? `${item.quantity} x ` : ""}${item.description}`,
                how: methods.length
                    ? methods.join(" + ")
                    : item.takeWith
                      ? "Take With"
                      : "Drop Ship",
            };
        });

    const missing = (
        <Text className="text-lg italic text-amber-700 dark:text-amber-400">Not given</Text>
    );
    const value = (text: ReactNode) =>
        typeof text === "string" ? <Text className="text-lg">{text}</Text> : text;

    const rows: [string, ReactNode][] = [
        ["Name", order.billingName ? value(order.billingName) : missing],
        [
            "Address",
            billing.length
                ? billing.map((l) => (
                      <Text key={l} className="text-lg">
                          {l}
                      </Text>
                  ))
                : missing,
        ],
        ["Phone", phones ? value(phones) : missing],
        ["Email", order.billingEmail ? value(order.billingEmail) : missing],
        [
            "Deliver to",
            delivery === null ? (
                value("Same as the address above")
            ) : (
                <>
                    {order.deliveryName ? (
                        <Text className="text-lg">{order.deliveryName}</Text>
                    ) : null}
                    {delivery.length
                        ? delivery.map((l) => (
                              <Text key={l} className="text-lg">
                                  {l}
                              </Text>
                          ))
                        : missing}
                    {order.deliveryCell ? (
                        <Text className="text-lg">{order.deliveryCell}</Text>
                    ) : null}
                </>
            ),
        ],
    ];
    if (items.length > 0)
        rows.push([
            "How it arrives",
            items.map((item) => (
                <Text key={item.id} className="text-lg">
                    {item.name}{" "}
                    <Text className="text-lg text-zinc-500 dark:text-zinc-400">- {item.how}</Text>
                </Text>
            )),
        ]);

    return (
        <View className="mt-6 rounded-2xl border-2 border-zinc-200 bg-white px-5 dark:border-zinc-700 dark:bg-zinc-800">
            {rows.map(([label, content], index) => (
                <View
                    key={label}
                    className={cx(
                        "gap-1 py-3",
                        sm && "flex-row gap-4",
                        index > 0 && "border-t border-zinc-200 dark:border-zinc-700"
                    )}
                >
                    <Text
                        className={cx(
                            "text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
                            sm && "w-40 pt-1"
                        )}
                    >
                        {label}
                    </Text>
                    <View className="flex-1">{content}</View>
                </View>
            ))}
        </View>
    );
};

/**
 * The tablet is turned around for this. The customer reads each point, initials it, then signs
 * once at the end. Progress is explicit so nobody is initialling something they have not seen,
 * and everything is written back in a single save. Full screen, so it can't be swiped away.
 */
const AcknowledgementSheet = ({ order, onSave, onClose }: Props) => {
    // The same wording the sales sheet prints beside each set of initials, set under Settings.
    const { settings } = useSettings();

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

    const totalSteps = steps.length + 1;
    const isSignatureStep = step === steps.length;
    const current = steps[Math.min(step, steps.length - 1)];
    const term = TermFor(settings.terms, current.term);

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

    return (
        <FullScreenSheet
            onClose={onClose}
            header={
                <View className="mx-auto w-full max-w-3xl px-5 py-4">
                    <View className="flex-row items-center gap-3">
                        <Icon icon="fa-solid fa-file-signature" className="text-2xl text-white" />
                        <View>
                            <Text className="text-xl font-bold text-white">
                                A few things to confirm
                            </Text>
                            <Text className="text-sm text-sky-100">
                                Step {step + 1} of {totalSteps}
                            </Text>
                        </View>
                    </View>

                    <View className="mt-3 flex-row gap-1.5">
                        {Array.from({ length: totalSteps }).map((_, index) => (
                            <View
                                key={index}
                                className={cx(
                                    "h-1.5 flex-1 rounded-full",
                                    index <= step ? "bg-white" : "bg-white/30"
                                )}
                            />
                        ))}
                    </View>
                </View>
            }
            footer={
                <View className="mx-auto w-full max-w-3xl flex-row gap-3 px-4 py-4">
                    <Button
                        text={step === 0 ? "Cancel" : "Back"}
                        icon={step === 0 ? undefined : "fa-solid fa-arrow-left"}
                        onClick={() => (step === 0 ? onClose() : setStep((value) => value - 1))}
                        className="min-h-[60px] bg-zinc-500 px-6 text-lg dark:bg-zinc-600"
                    />
                    {isSignatureStep ? (
                        <Button
                            text="Done"
                            icon="fa-solid fa-check"
                            onClick={handleFinish}
                            loading={saving}
                            className="min-h-[60px] flex-1 bg-green-700 text-lg dark:bg-green-600"
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
                </View>
            }
        >
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}
                keyboardShouldPersistTaps="handled"
            >
                <View className="mx-auto w-full max-w-3xl">
                    {!isSignatureStep ? (
                        <>
                            <Text className="text-2xl font-bold">{term.title}</Text>
                            <Text className="mt-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                                {RenderTermText(term.text)}
                            </Text>
                            {current.key === "customerInfoInitials" && (
                                <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                                    If anything below is wrong, tap Cancel and let us know before
                                    you initial.
                                </Text>
                            )}

                            {current.key === "customerInfoInitials" && (
                                <DetailsSummary order={order} />
                            )}

                            <View className="mt-8">
                                <Text className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                    Your initials
                                </Text>
                                <TextInput
                                    key={current.key}
                                    value={initials[current.key]}
                                    onChangeText={(text) =>
                                        setInitials((value) => ({
                                            ...value,
                                            [current.key]: text.toUpperCase(),
                                        }))
                                    }
                                    maxLength={10}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    placeholder="AB"
                                    placeholderTextColor="#a1a1aa"
                                    accessibilityLabel="Your initials"
                                    className="mt-2 min-h-[72px] w-40 rounded-2xl border-2 border-zinc-300 bg-white
                                        text-center text-3xl font-bold tracking-widest text-zinc-900
                                        focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            <Text className="text-2xl font-bold">Sign to finish</Text>
                            <Text className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
                                Your signature confirms your details and the points you just
                                initialled.
                            </Text>

                            <View className="mt-6">
                                <Text className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                    Print your name
                                </Text>
                                <TextInput
                                    value={printedName}
                                    onChangeText={setPrintedName}
                                    maxLength={150}
                                    autoCapitalize="words"
                                    accessibilityLabel="Print your name"
                                    className="mt-2 min-h-[60px] w-full rounded-2xl border-2 border-zinc-300 bg-white px-4
                                        text-lg text-zinc-900 focus:border-sky-600
                                        dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                            </View>

                            <View className="mt-6">
                                <Text className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                    Signature
                                </Text>
                                <View className="mt-2">
                                    <SignaturePad value={signature} onChange={setSignature} />
                                </View>
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>
        </FullScreenSheet>
    );
};

export default AcknowledgementSheet;
