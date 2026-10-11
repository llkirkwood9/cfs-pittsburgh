import DashboardPage from "../../Pages/DashboardPage";
import ProtectedRoute from "../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute>
            <DashboardPage />
        </ProtectedRoute>
    );
}
