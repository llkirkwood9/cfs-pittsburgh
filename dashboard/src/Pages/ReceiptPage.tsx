import { useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import EmailDialog from "../Components/Elements/EmailDialog";
import LoadingPage from "../Components/Elements/LoadingPage";
import ReceiptSheet from "../Components/Checkout/ReceiptSheet";
import { useAuth } from "@shared/Context/AuthContext";
import { useCheckoutReceipt } from "@shared/Hooks/useCheckoutReceipt";
import { HomePathForRole } from "../Lib/ScreenLinks";
import { FindSheets } from "../Lib/SheetPdf";

/**
 * The printable copy of a sale. Unfinished orders are stamped as such by the sheet itself. Print
 * makes a PDF of the sheet - the same one email sends - and prints that, so the paper looks the
 * same from any device. A completed sale can also be emailed to the customer.
 */
const ReceiptPage = () => {
    const { user } = useAuth();
    const { orderId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Whoever opened the sheet says where they came from, so Back returns to the Orders list or
    // the checkout table as appropriate. A sheet opened from a bookmark or a fresh tab falls back
    // to the browser history, then to the user's home screen.
    const from = (location.state as { from?: string; label?: string } | null) ?? null;
    const goBack = () => {
        if (from?.from) navigate(from.from);
        else if (location.key !== "default") navigate(-1);
        else navigate(HomePathForRole(user?.role));
    };
    const backLabel = from?.label ?? "Back";

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
    const sheetRef = useRef<HTMLDivElement>(null);

    if (loading) return <LoadingPage />;

    if (!order) {
        return (
            <div className="p-8 text-center">
                <p className="text-base font-semibold">That order could not be found.</p>
                <Button
                    text={backLabel}
                    icon="fa-solid fa-arrow-left"
                    onClick={goBack}
                    className="mt-4"
                />
            </div>
        );
    }

    return (
        <div className="print-root min-h-screen bg-zinc-200 py-4 dark:bg-zinc-900">
            <div className="no-print mx-auto mb-4 flex max-w-[8in] flex-wrap items-center gap-2 px-3">
                <Button
                    text={backLabel}
                    icon="fa-solid fa-arrow-left"
                    onClick={goBack}
                    className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                />
                <div className="ml-auto flex gap-2">
                    {completed && (
                        <Button
                            text="Email"
                            icon="fa-solid fa-envelope"
                            onClick={startEmail}
                            className="bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                    )}
                    <Button
                        text={printing ? "Making the PDF..." : "Print"}
                        icon="fa-solid fa-print"
                        onClick={() => print(FindSheets(sheetRef.current))}
                        loading={printing}
                        disabled={printing}
                    />
                </div>
            </div>

            <div ref={sheetRef}>
                <ReceiptSheet order={order} />
            </div>

            {emailing && (
                <EmailDialog
                    title={`Email receipt #${order.orderNumber}`}
                    description={
                        <>
                            Sends {order.billingName || "the customer"} this sales sheet as a PDF,
                            with a thank-you note
                            {emailStatus?.from ? ` from ${emailStatus.from}` : ""}.
                        </>
                    }
                    initialTo={order.billingEmail}
                    onSend={(to, _message, progress) =>
                        sendReceipt(FindSheets(sheetRef.current), to, progress)
                    }
                    onClose={stopEmail}
                />
            )}
        </div>
    );
};

export default ReceiptPage;
