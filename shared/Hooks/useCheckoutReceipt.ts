import { useEffect, useState } from "react";
import { Toast } from "@host";
import type { Order } from "../Models/Order";
import { GetEmailStatus } from "../Services/EmailServices";
import type { EmailStatus } from "../Services/EmailServices";
import { GetOrder } from "../Services/OrderServices";

/**
 * The receipt screen: the order and whether the server can send email. Only a finished sale is a
 * receipt worth emailing; when the server has no email settings the button still shows, and says
 * so when tapped - a tooltip on a disabled button never shows on an iPad.
 * @param orderId The order, from the route.
 * @returns The order, the email state and the handler that starts an email.
 */
export const useCheckoutReceipt = (orderId: string | undefined) => {
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

    const startEmail = () => {
        if (emailStatus?.configured) setEmailing(true);
        else
            Toast.Warning(
                "Email isn't set up on this server yet. Ask whoever runs the app to add the email settings."
            );
    };

    return {
        order,
        loading,
        emailStatus,
        /** A completed sale, which can be emailed. */
        completed: order?.status === "Completed",
        emailing,
        startEmail,
        stopEmail: () => setEmailing(false),
    };
};
