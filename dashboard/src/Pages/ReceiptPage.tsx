import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import LoadingPage from "../Components/Elements/LoadingPage";
import ReceiptSheet from "../Components/Checkout/ReceiptSheet";
import { useAuth } from "../Context/AuthContext";
import { HomePathForRole } from "../Lib/RoleRoutes";
import type { Order } from "../Models/Order";
import { GetOrder } from "../Services/OrderServices";

/**
 * The printable copy of a sale. Unfinished orders are stamped as such by the sheet itself. The toolbar is marked no-print so the paper that comes
 * out of the tray is just the sales sheet.
 */
const ReceiptPage = () => {
    const { user } = useAuth();
    const { orderId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Whoever opened the sheet says where they came from, so Back returns to the Orders list or
    // the checkout table as appropriate. A sheet opened from a bookmark or a fresh tab falls back
    // to the browser history, then to the user's home screen.
    const from =
        (location.state as { from?: string; label?: string; autoPrint?: boolean } | null) ?? null;
    const goBack = () => {
        if (from?.from) navigate(from.from);
        else if (location.key !== "default") navigate(-1);
        else navigate(HomePathForRole(user?.role));
    };
    const backLabel = from?.label ?? "Back";

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const load = async () => {
            if (!orderId) return setLoading(false);

            setOrder(await GetOrder(Number(orderId)));
            setLoading(false);
        };

        load();
    }, [orderId]);

    // Complete & print lands here with autoPrint set, so the print dialog opens by itself. The flag
    // is cleared straight away so going back or refreshing does not print a second copy.
    const autoPrinted = useRef<boolean>(false);
    useEffect(() => {
        if (loading || !order || !from?.autoPrint || autoPrinted.current) return;

        autoPrinted.current = true;
        navigate(location.pathname, { replace: true, state: { ...from, autoPrint: false } });
        setTimeout(() => window.print(), 400);
    }, [loading, order, from, navigate, location.pathname]);

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

    return (
        <div className="print-root min-h-screen bg-zinc-200 py-4 dark:bg-zinc-900">
            <div className="no-print mx-auto mb-4 flex max-w-[8in] flex-wrap items-center gap-2 px-3">
                <Button
                    text={backLabel}
                    icon="fa-solid fa-arrow-left"
                    onClick={goBack}
                    className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                />
                <Button
                    text="Print"
                    icon="fa-solid fa-print"
                    onClick={() => window.print()}
                    className="ml-auto"
                />
            </div>

            <ReceiptSheet order={order} />
        </div>
    );
};

export default ReceiptPage;
