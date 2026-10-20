import CheckoutPage from "../../Pages/CheckoutPage";
import ProtectedRoute from "../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Checkout"]} territory="work the checkout table">
            <CheckoutPage />
        </ProtectedRoute>
    );
}
