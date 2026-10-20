import SalesPage from "../../Pages/SalesPage";
import ProtectedRoute from "../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Sales"]} territory="take orders">
            <SalesPage />
        </ProtectedRoute>
    );
}
