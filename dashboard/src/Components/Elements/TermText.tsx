import { Fragment } from "react";
import type { ReactNode } from "react";

/** **bold** and __underline__, which may be nested either way round. */
const MARKS = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__)/;

/**
 * Turns a term's light markup into text: **bold** and __underline__, as on the paper sheet
 * ("**__ALL SALES AND TRANSACTIONS ARE FINAL__**"). Anything else shows as typed - it is never
 * read as HTML.
 * @param text The term's paragraph.
 * @returns The formatted text.
 */
export const RenderTermText = (text: string): ReactNode =>
    text.split(MARKS).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
            return <strong key={i}>{RenderTermText(part.slice(2, -2))}</strong>;
        if (part.startsWith("__") && part.endsWith("__") && part.length > 4)
            return <u key={i}>{RenderTermText(part.slice(2, -2))}</u>;
        return <Fragment key={i}>{part}</Fragment>;
    });

type Props = {
    text: string;
};

/** A term's paragraph with its bold and underlined parts. */
const TermText = ({ text }: Props) => <>{RenderTermText(text)}</>;

export default TermText;
