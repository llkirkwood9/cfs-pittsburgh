import type { ReactNode } from "react";
import { Text } from "react-native";

/** **bold** and __underline__, which may be nested either way round. */
const MARKS = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__)/;

/**
 * Turns a term's light markup into text: **bold** and __underline__, as on the paper sheet
 * ("**__ALL SALES AND TRANSACTIONS ARE FINAL__**"). Anything else shows as typed. Returns nested
 * Text, so it goes inside a Text that carries the paragraph's size and colour.
 * @param text The term's paragraph.
 * @returns The formatted text.
 */
export const RenderTermText = (text: string): ReactNode =>
    text.split(MARKS).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
            return (
                <Text key={i} style={{ fontWeight: "700" }}>
                    {RenderTermText(part.slice(2, -2))}
                </Text>
            );
        if (part.startsWith("__") && part.endsWith("__") && part.length > 4)
            return (
                <Text key={i} style={{ textDecorationLine: "underline" }}>
                    {RenderTermText(part.slice(2, -2))}
                </Text>
            );
        return <Text key={i}>{part}</Text>;
    });

type Props = {
    text: string;
};

/** A term's paragraph with its bold and underlined parts. */
const TermText = ({ text }: Props) => <>{RenderTermText(text)}</>;

export default TermText;
