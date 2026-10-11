import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import ReceiptSheet from "../Components/Checkout/ReceiptSheet";
import SheetViewer from "../Components/Checkout/SheetViewer";
import Button from "../Components/Elements/Button";
import EmailDialog from "../Components/Elements/EmailDialog";
import LoadingPage from "../Components/Elements/LoadingPage";
import Text from "../Components/Elements/Text";
import { useAuth } from "../Context/AuthContext";
import { HomePathForRole } from "../Lib/RoleRoutes";
import { PrintSheetsPdf, ShareSheetsPdf, TryBuildSheetsPdf } from "../Lib/SheetPdf";
import { Toast } from "../Lib/Toast";
import type { Order } from "../Models/Order";
import { EmailReceipt, GetEmailStatus } from "../Services/EmailServices";
import type { EmailStatus } from "../Services/EmailServices";
import { GetOrder } from "../Services/OrderServices";

/**
 * The printable copy of a sale. Unfinished orders are stamped as such by the sheet itself. Print
 * makes a PDF of the sheet - the same one email sends - and prints that through the system print
 * dialog, so the paper looks the same from any device. Share hands the PDF to Files, Mail or
 * AirDrop, and a completed sale can be emailed to the customer.
 */
const ReceiptPage = () => {
    const { user } = useAuth();
    const { orderId } = useLocalSearchParams<{ orderId: string }>();

    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace(HomePathForRole(user?.role));

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
    const [emailing, setEmailing] = useState<boolean>(false);
    const [printing, setPrinting] = useState<boolean>(false);
    const [sharing, setSharing] = useState<boolean>(false);
    const sheetRef = useRef<View>(null);

    useEffect(() => {
        const load = async () => {
            if (!orderId) return setLoading(false);

            const [found, status] = await Promise.all([GetOrder(Number(orderId)), GetEmailStatus()]);
            setOrder(found);
            setEmailStatus(status);
            setLoading(false);
        };

        load();
    }, [orderId]);

    if (!user) return <Redirect href="/unauthorized" />;
    if (loading) return <LoadingPage />;

    if (!order) {
        return (
            <View className="flex-1 items-center bg-zinc-200 p-8 dark:bg-zinc-900">
                <Text className="font-semibold">That order could not be found.</Text>
                <Button text="Back" icon="fa-solid fa-arrow-left" onClick={goBack} className="mt-4" />
            </View>
        );
    }

    // Only a finished sale is a receipt worth emailing. When the server has no email settings the
    // button still shows, and says so when tapped.
    const completed = order.status === "Completed";
    const startEmail = () => {
        if (emailStatus?.configured) setEmailing(true);
        else
            Toast.Warning(
                "Email isn't set up on this server yet. Ask whoever runs the app to add the email settings."
            );
    };

    // Printed from the same PDF that email sends, so the sheet comes out the same from any device.
    const handlePrint = async () => {
        setPrinting(true);
        await PrintSheetsPdf([sheetRef]);
        setPrinting(false);
    };

    const handleShare = async () => {
        setSharing(true);
        await ShareSheetsPdf([sheetRef], `sales-sheet-${order.orderNumber}`);
        setSharing(false);
    };

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
                    text={sharing ? "Making the PDF..." : "Share PDF"}
                    icon="fa-solid fa-share-from-square"
                    onClick={handleShare}
                    loading={sharing}
                    disabled={printing}
                    className="bg-zinc-600 dark:bg-zinc-600"
                />
                <Button
                    text={printing ? "Making the PDF..." : "Print"}
                    icon="fa-solid fa-print"
                    onClick={handlePrint}
                    loading={printing}
                    disabled={sharing}
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
                    onSend={async (to, _message, progress) => {
                        progress("Making the PDF...");
                        const pdf = await TryBuildSheetsPdf([sheetRef]);
                        if (!pdf) return null;
                        progress("Sending...");
                        return EmailReceipt(order.id!, to, pdf);
                    }}
                    onClose={() => setEmailing(false)}
                />
            )}
        </View>
    );
};

export default ReceiptPage;
