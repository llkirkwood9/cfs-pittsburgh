import CrewPage from "../../../Pages/CrewPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute screen="crew">
            <CrewPage />
        </ProtectedRoute>
    );
}
