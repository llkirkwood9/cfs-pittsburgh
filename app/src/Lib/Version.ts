import Constants from "expo-constants";

/**
 * App version, from app.json, shown in the profile menu so the crew can report what they are
 * running.
 */
export const APP_VERSION = `${Constants.expoConfig?.version ?? "1.0.0"} - Beta`;
