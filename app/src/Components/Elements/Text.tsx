import { Text as NativeText } from "react-native";
import type { TextProps } from "react-native";
import { cx, HasTextColor, HasTextSize } from "../../Lib/ClassNames";

type Props = TextProps & {
    className?: string;
};

/**
 * Text with the app's default colour and size. React Native doesn't pass text styles down from a
 * container the way the browser does, so every piece of text carries its own - this keeps the
 * dashboard's body text (zinc-900, or zinc-100 in dark mode) without repeating it everywhere.
 */
const Text = ({ className = "", ...props }: Props) => (
    <NativeText
        {...props}
        className={cx(
            !HasTextColor(className) && "text-zinc-900 dark:text-zinc-100",
            !HasTextSize(className) && "text-base",
            className
        )}
    />
);

export default Text;
