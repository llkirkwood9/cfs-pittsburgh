/** A piece of a term's paragraph: plain text, or a bold or underlined run of further pieces. */
export type TermPart =
    | { kind: "text"; text: string }
    | { kind: "bold"; parts: TermPart[] }
    | { kind: "underline"; parts: TermPart[] };

/** **bold** and __underline__, which may be nested either way round. */
const MARKS = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__)/;

/**
 * Reads a term's light markup: **bold** and __underline__, as on the paper sheet
 * ("**__ALL SALES AND TRANSACTIONS ARE FINAL__**"). Anything else is plain text as typed - it is
 * never read as HTML.
 * @param text The term's paragraph.
 * @returns Its pieces, in order.
 */
export const ParseTermMarks = (text: string): TermPart[] =>
    text.split(MARKS).map((part): TermPart => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
            return { kind: "bold", parts: ParseTermMarks(part.slice(2, -2)) };
        if (part.startsWith("__") && part.endsWith("__") && part.length > 4)
            return { kind: "underline", parts: ParseTermMarks(part.slice(2, -2)) };
        return { kind: "text", text: part };
    });
