import EventSheetsPage from "../../../Pages/EventSheetsPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Manager"]}>
            <EventSheetsPage />
        </ProtectedRoute>
    );
}
