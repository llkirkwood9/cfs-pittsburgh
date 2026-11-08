import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { ScrollView, View } from "react-native";
import ReceiptSheet from "../Components/Checkout/ReceiptSheet";
import SheetViewer from "../Components/Checkout/SheetViewer";
import Button from "../Components/Elements/Button";
import EmailDialog from "../Components/Elements/EmailDialog";
import LoadingPage from "../Components/Elements/LoadingPage";
import Text from "../Components/Elements/Text";
import { useAuth } from "@shared/Context/AuthContext";
import { useCheckoutReceipt } from "@shared/Hooks/useCheckoutReceipt";
import { HomePathForRole } from "../Lib/ScreenLinks";

/**
 * The printable copy of a sale. Unfinished orders are stamped as such by the sheet itself. Print
 * makes a PDF of the sheet - the same one email sends - and prints that through the system print
 * dialog, so the paper looks the same from any device. A completed sale can also be emailed to the
 * customer.
 */
const ReceiptPage = () => {
    const { user } = useAuth();
    const { orderId } = useLocalSearchParams<{ orderId: string }>();

    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace(HomePathForRole(user?.role));

    const {
        order,
        loading,
        emailStatus,
        completed,
        emailing,
        startEmail,
        stopEmail,
        printing,
        print,
        sendReceipt,
    } = useCheckoutReceipt(orderId);
    const sheetRef = useRef<View>(null);

    if (loading) return <LoadingPage />;

    if (!order) {
        return (
            <View className="flex-1 items-center bg-zinc-200 p-8 dark:bg-zinc-900">
                <Text className="font-semibold">That order could not be found.</Text>
                <Button
                    text="Back"
                    icon="fa-solid fa-arrow-left"
                    onClick={goBack}
                    className="mt-4"
                />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-zinc-200 dark:bg-zinc-900">
            <Stack.Screen options={{ title: `Sales sheet #${order.orderNumber}` }} />

            <View className="mx-auto w-full max-w-3xl flex-row flex-wrap items-center justify-end gap-2 px-3 py-3">
                {completed && (
                    <Button
                        text="Email"
                        icon="fa-solid fa-envelope"
                        onClick={startEmail}
                        className="bg-zinc-600 dark:bg-zinc-600"
                    />
                )}
                <Button
                    text={printing ? "Making the PDF..." : "Print"}
                    icon="fa-solid fa-print"
                    onClick={() => print([sheetRef])}
                    loading={printing}
                />
            </View>

            <ScrollView
                className="flex-1"
                contentContainerClassName="items-center px-3 pb-10"
                maximumZoomScale={3}
                minimumZoomScale={1}
            >
                <SheetViewer>
                    <ReceiptSheet order={order} sheetRef={sheetRef} />
                </SheetViewer>
            </ScrollView>

            {emailing && (
                <EmailDialog
                    title={`Email receipt #${order.orderNumber}`}
                    description={`Sends ${order.billingName || "the customer"} this sales sheet as a PDF, with a thank-you note${
                        emailStatus?.from ? ` from ${emailStatus.from}` : ""
                    }.`}
                    initialTo={order.billingEmail}
                    onSend={(to, _message, progress) => sendReceipt([sheetRef], to, progress)}
                    onClose={stopEmail}
                />
            )}
        </View>
    );
};

export default ReceiptPage;
