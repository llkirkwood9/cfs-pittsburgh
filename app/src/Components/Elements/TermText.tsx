import type { ReactNode } from "react";
import { Text } from "react-native";
import { ParseTermMarks } from "@shared/Lib/TermMarks";
import type { TermPart } from "@shared/Lib/TermMarks";

/**
 * Draws a term's pieces.
 * @param parts The pieces.
 * @returns Nested Text.
 */
const renderParts = (parts: TermPart[]): ReactNode =>
    parts.map((part, i) => {
        if (part.kind === "bold")
            return (
                <Text key={i} style={{ fontWeight: "700" }}>
                    {renderParts(part.parts)}
                </Text>
            );
        if (part.kind === "underline")
            return (
                <Text key={i} style={{ textDecorationLine: "underline" }}>
                    {renderParts(part.parts)}
                </Text>
            );
        return <Text key={i}>{part.text}</Text>;
    });

/**
 * Turns a term's light markup into text: **bold** and __underline__, as on the paper sheet.
 * Returns nested Text, so it goes inside a Text that carries the paragraph's size and colour.
 * @param text The term's paragraph.
 * @returns The formatted text.
 */
export const RenderTermText = (text: string): ReactNode => renderParts(ParseTermMarks(text));
