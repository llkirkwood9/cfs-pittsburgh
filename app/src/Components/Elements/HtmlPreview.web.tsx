import { createElement } from "react";

type Props = {
    /** The HTML to show, such as an email's body. */
    html: string;
    height: number;
    title: string;
};

/** In a browser the preview is a sandboxed frame: it can't run anything. */
const HtmlPreview = ({ html, height, title }: Props) =>
    createElement("iframe", {
        title,
        sandbox: "",
        srcDoc: `<!doctype html><html><body style="margin:16px;background:#fff">${html}</body></html>`,
        style: { display: "block", width: "100%", height, border: 0, background: "#fff" },
    });

export default HtmlPreview;
