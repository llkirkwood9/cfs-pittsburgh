export type PaymentMethod = "VisaMc" | "Cash" | "Check" | "Financing" | "Layaway";

export type OrderPayment = {
    id?: number;
    method?: PaymentMethod;
    amount?: number;
    checkNumber?: string | null;
    /** For financing, the financing number. */
    reference?: string | null;
    /** For financing, which financing the customer chose (one of the finance options). */
    financeType?: string | null;
};
