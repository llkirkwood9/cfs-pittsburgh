import { Fragment } from "react";
import type { ReactNode } from "react";
import { ParseTermMarks } from "@shared/Lib/TermMarks";
import type { TermPart } from "@shared/Lib/TermMarks";

/**
 * Draws a term's pieces.
 * @param parts The pieces.
 * @returns The formatted text.
 */
const renderParts = (parts: TermPart[]): ReactNode =>
    parts.map((part, i) => {
        if (part.kind === "bold") return <strong key={i}>{renderParts(part.parts)}</strong>;
        if (part.kind === "underline") return <u key={i}>{renderParts(part.parts)}</u>;
        return <Fragment key={i}>{part.text}</Fragment>;
    });

type Props = {
    text: string;
};

/** A term's paragraph with its bold and underlined parts. */
const TermText = ({ text }: Props) => <>{renderParts(ParseTermMarks(text))}</>;

export default TermText;
