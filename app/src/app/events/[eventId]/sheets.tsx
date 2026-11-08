import EventSheetsPage from "../../../Pages/EventSheetsPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute screen="eventSheets">
            <EventSheetsPage />
        </ProtectedRoute>
    );
}
