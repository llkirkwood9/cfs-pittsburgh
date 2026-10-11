import ReceiptPage from "../../Pages/ReceiptPage";
import ProtectedRoute from "../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute>
            <ReceiptPage />
        </ProtectedRoute>
    );
}
