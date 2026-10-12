import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The dashboard's version, YYYY.MM.<build>. The image workflow numbers each build within its
 * month and passes it in as DASHBOARD_VERSION; any other build - a local one, or `docker compose
 * build` - is this month's build 0.
 */
const now = new Date();
const version =
    process.env.DASHBOARD_VERSION ||
    `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.0`;

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        "import.meta.env.VITE_DASHBOARD_VERSION": JSON.stringify(version),
    },
    server: {
        port: 3000,
        open: true,
        host: true,
    },
});
