/**
 * The server the app talks to, fixed when the app is built from EXPO_PUBLIC_API_URL. Locally it
 * comes from app/.env - a local API or the live site, see .env.example; a release build gets the
 * live site from the API_URL secret, which the release workflow writes to .env.production.
 */
const SERVER_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "") || null;

/**
 * The server this app talks to.
 * @returns Its address, or null when the build was made without one.
 */
export const GetServerUrl = (): string | null => SERVER_URL;
