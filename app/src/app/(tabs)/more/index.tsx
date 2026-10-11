import MorePage from "../../../Pages/MorePage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute>
            <MorePage />
        </ProtectedRoute>
    );
}
