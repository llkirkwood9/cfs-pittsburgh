import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { AuthProvider } from "./Context/AuthContext";
import { SettingsProvider } from "./Context/SettingsContext";
import { TerritoryProvider } from "./Context/TerritoryContext";
import { router } from "./Routes/Routes";
import "./index.css";

// Only the solid set is registered. The regular and brand sets would roughly double the
// bundle and this app does not use an icon from either, which matters on venue wifi.
library.add(fas);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <AuthProvider>
            <TerritoryProvider>
                <SettingsProvider>
                    <RouterProvider router={router} />
                </SettingsProvider>
            </TerritoryProvider>
        </AuthProvider>
    </StrictMode>
);
