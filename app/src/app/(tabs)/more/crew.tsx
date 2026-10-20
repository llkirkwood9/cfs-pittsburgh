import CrewPage from "../../../Pages/CrewPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Admin"]}>
            <CrewPage />
        </ProtectedRoute>
    );
}
