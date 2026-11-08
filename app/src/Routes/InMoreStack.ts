import { createContext, useContext } from "react";

/**
 * True for screens opened within the More tab's stack, which have their own header, so a screen
 * there draws no menu bar of its own. Set by the More layout.
 */
export const InMoreStack = createContext<boolean>(false);

/**
 * Whether this screen was opened within More.
 * @returns True inside the More stack.
 */
export const useInMoreStack = (): boolean => useContext(InMoreStack);
