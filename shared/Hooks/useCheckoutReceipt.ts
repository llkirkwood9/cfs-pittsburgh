import { useEffect, useState } from "react";
import { Toast } from "@host";
import { EMAIL_NOT_SET_UP } from "../Lib/Email";
import { EmailSheets, PrintSheetsPdf } from "../Lib/SheetPdf";
import type { Sheet } from "../Lib/SheetPdf";
import type { Order } from "../Models/Order";
import { EmailReceipt, GetEmailStatus } from "../Services/EmailServices";
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
    const [printing, setPrinting] = useState<boolean>(false);

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
        else Toast.Warning(EMAIL_NOT_SET_UP);
    };

    /**
     * Prints the sales sheet. Call it straight from the tap.
     * @param sheets The sheet on screen.
     */
    const print = async (sheets: Sheet[]) => {
        if (!order) return;
        setPrinting(true);
        await PrintSheetsPdf(sheets, `sales-sheet-${order.orderNumber}`);
        setPrinting(false);
    };

    /**
     * Sends the sales sheet as a PDF, from the email dialog.
     * @param sheets The sheet on screen.
     * @param to The addresses.
     * @param progress Told what it is doing.
     * @returns The addresses it went to, or null when it failed.
     */
    const sendReceipt = async (sheets: Sheet[], to: string, progress: (status: string) => void) => {
        const id = order?.id;
        if (!id) return null;
        return EmailSheets(`order:${id}`, sheets, progress, (uploadId) =>
            EmailReceipt(id, to, uploadId)
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
        printing,
        print,
        sendReceipt,
    };
};
