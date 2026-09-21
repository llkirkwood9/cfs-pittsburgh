export type PaymentMethod = "VisaMc" | "Cash" | "Check" | "Financing" | "Layaway";

export type OrderPayment = {
    id?: number;
    method?: PaymentMethod;
    amount?: number;
    checkNumber?: string | null;
    reference?: string | null;
};
