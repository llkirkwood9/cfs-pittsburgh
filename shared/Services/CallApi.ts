import { HandleAxiosError } from "../Lib/ErrorHandler";

/**
 * Runs one API call the way every service does: a failure is reported to the user (see
 * HandleAxiosError) and the service returns its own failure value instead of throwing.
 * @param call The request, returning what the service returns on success.
 * @param failed What the service returns on failure - null, undefined, false, an empty list.
 * @returns The call's result, or the failure value.
 */
export const CallApi = async <T, F>(call: () => Promise<T>, failed: F): Promise<T | F> => {
    try {
        return await call();
    } catch (error) {
        HandleAxiosError(error);
        return failed;
    }
};
