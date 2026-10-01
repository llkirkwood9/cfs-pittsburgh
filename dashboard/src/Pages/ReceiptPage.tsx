import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import EmailDialog from "../Components/Elements/EmailDialog";
import LoadingPage from "../Components/Elements/LoadingPage";
import ReceiptSheet from "../Components/Checkout/ReceiptSheet";
import { useAuth } from "../Context/AuthContext";
import { HomePathForRole } from "../Lib/RoleRoutes";
import { Toast } from "../Lib/Toast";
import type { Order } from "../Models/Order";
import { EmailReceipt, GetEmailStatus } from "../Services/EmailServices";
import type { EmailStatus } from "../Services/EmailServices";
import { GetOrder } from "../Services/OrderServices";

/**
 * The printable copy of a sale. Unfinished orders are stamped as such by the sheet itself. The toolbar is marked no-print so the paper that comes
 * out of the tray is just the sales sheet. A completed sale can also be emailed to the customer.
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

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
    const [emailing, setEmailing] = useState<boolean>(false);

    useEffect(() => {
        const load = async () => {
            if (!orderId) return setLoading(false);

            const [found, status] = await Promise.all([
                GetOrder(Number(orderId)),
                GetEmailStatus(),
            ]);
            setOrder(found);
            setEmailStatus(status);
            setLoading(false);
        };

        load();
    }, [orderId]);

    if (!user) return <Navigate to="/unauthorized" replace />;
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

    // Only a finished sale is a receipt worth emailing. When the server has no email settings the
    // button still shows, and says so when tapped - a tooltip on a disabled button never shows on
    // an iPad.
    const completed = order.status === "Completed";
    const startEmail = () => {
        if (emailStatus?.configured) setEmailing(true);
        else
            Toast.Warning(
                "Email isn't set up on this server yet. Ask whoever runs the app to add the email settings."
            );
    };

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
                    <Button text="Print" icon="fa-solid fa-print" onClick={() => window.print()} />
                </div>
            </div>

            <ReceiptSheet order={order} />

            {emailing && (
                <EmailDialog
                    title={`Email receipt #${order.orderNumber}`}
                    description={
                        <>
                            Sends {order.billingName || "the customer"} a copy of this sales sheet
                            {emailStatus?.from ? ` from ${emailStatus.from}` : ""}.
                        </>
                    }
                    initialTo={order.billingEmail}
                    onSend={(to) => EmailReceipt(order.id!, to)}
                    onClose={() => setEmailing(false)}
                />
            )}
        </div>
    );
};

export default ReceiptPage;
