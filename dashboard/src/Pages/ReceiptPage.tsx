import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import LoadingPage from "../Components/Elements/LoadingPage";
import ReceiptSheet from "../Components/Checkout/ReceiptSheet";
import { useAuth } from "../Context/AuthContext";
import type { Order } from "../Models/Order";
import { GetOrder } from "../Services/OrderServices";

/**
 * The printable copy of a completed sale. The toolbar is marked no-print so the paper that comes
 * out of the tray is just the sales sheet.
 */
const ReceiptPage = () => {
    const { user } = useAuth();
    const { orderId } = useParams();
    const navigate = useNavigate();

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

    if (!user) return <Navigate to="/unauthorized" replace />;
    if (loading) return <LoadingPage />;

    if (!order) {
        return (
            <div className="p-8 text-center">
                <p className="text-base font-semibold">That order could not be found.</p>
                <Button
                    text="Back to checkout"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => navigate("/checkout")}
                    className="mt-4"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-200 py-4 dark:bg-zinc-900">
            <div className="no-print mx-auto mb-4 flex max-w-[8in] flex-wrap items-center gap-2 px-3">
                <Button
                    text="Back"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => navigate("/checkout")}
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
