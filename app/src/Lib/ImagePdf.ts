/** US Letter, in points. */
export const PAGE_W = 612;
export const PAGE_H = 792;

/** The margin round each sheet: 0.35in, as the dashboard's PDFs and printed sheets use. */
export const MARGIN = 0.35 * 72;

/** A JPEG's size in pixels and how many colour channels it has. */
type JpegInfo = { width: number; height: number; components: number };

/**
 * Reads a JPEG's size from its frame header.
 * @param bytes The JPEG.
 * @returns Its size and colour channels.
 */
const ReadJpeg = (bytes: Uint8Array): JpegInfo => {
    let i = 2;
    while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) {
            i++;
            continue;
        }
        const marker = bytes[i + 1];
        // Start-of-frame markers, apart from DHT (C4), JPG (C8) and DAC (CC).
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return {
                height: (bytes[i + 5] << 8) | bytes[i + 6],
                width: (bytes[i + 7] << 8) | bytes[i + 8],
                components: bytes[i + 9],
            };
        }
        // Markers with no length.
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            i += 2;
            continue;
        }
        i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
    throw new Error("The page picture isn't a JPEG the PDF can use.");
};

/** Base64 to bytes. */
const FromBase64 = (base64: string): Uint8Array => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

/** ASCII text to bytes; everything written around the pictures is plain ASCII. */
const Ascii = (text: string): Uint8Array => {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0x7f;
    return bytes;
};

/** A number as PDF writes it: at most two decimals, no trailing zeros. */
const Num = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Lays JPEG pictures out one per US Letter page, exactly as the dashboard's jsPDF does: as wide as
 * the page allows inside a 0.35in margin, centred across the page and set at the top margin, and
 * shrunk to fit when a picture is too tall for the page. The PDF is written directly rather than
 * printed from HTML, so it comes out the same from every device.
 * @param jpegs The pictures, base64-encoded, in page order.
 * @param title The document's title, shown by PDF viewers.
 * @returns The PDF.
 */
export const BuildImagePdf = (jpegs: string[], title?: string): Uint8Array => {
    const parts: Uint8Array[] = [];
    const offsets: number[] = [];
    let length = 0;

    const push = (part: Uint8Array) => {
        parts.push(part);
        length += part.length;
    };
    const text = (value: string) => push(Ascii(value));
    // Objects are numbered from 1 in the order they are written.
    const object = (body: string) => {
        offsets.push(length);
        text(`${offsets.length} 0 obj\n${body}\nendobj\n`);
    };

    text("%PDF-1.4\n");

    // 1: catalog, 2: page tree, 3: document info, then three objects per page.
    const pageObject = (index: number) => 4 + index * 3;
    object("<< /Type /Catalog /Pages 2 0 R >>");
    object(
        `<< /Type /Pages /Kids [${jpegs.map((_, i) => `${pageObject(i)} 0 R`).join(" ")}] /Count ${jpegs.length} >>`
    );
    const safeTitle = (title ?? "").replace(/[^\x20-\x7e]/g, "").replace(/([\\()])/g, "\\$1");
    object(`<< /Title (${safeTitle}) /Producer (CFS Sales) >>`);

    const boxW = PAGE_W - MARGIN * 2;
    const boxH = PAGE_H - MARGIN * 2;

    jpegs.forEach((base64, index) => {
        const jpeg = FromBase64(base64);
        const info = ReadJpeg(jpeg);
        const page = pageObject(index);

        const ratio = info.width / info.height;
        let w = boxW;
        let h = w / ratio;
        if (h > boxH) {
            h = boxH;
            w = h * ratio;
        }
        const x = (PAGE_W - w) / 2;
        // PDF measures from the bottom of the page.
        const y = PAGE_H - MARGIN - h;

        object(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
                `/Resources << /XObject << /Im0 ${page + 2} 0 R >> /ProcSet [/PDF /ImageC] >> ` +
                `/Contents ${page + 1} 0 R >>`
        );

        const draw = `q ${Num(w)} 0 0 ${Num(h)} ${Num(x)} ${Num(y)} cm /Im0 Do Q`;
        object(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);

        offsets.push(length);
        text(
            `${page + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} ` +
                `/ColorSpace /${info.components === 1 ? "DeviceGray" : info.components === 4 ? "DeviceCMYK" : "DeviceRGB"} ` +
                `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
        );
        push(jpeg);
        text("\nendstream\nendobj\n");
    });

    const xref = length;
    text(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
    for (const offset of offsets) text(`${String(offset).padStart(10, "0")} 00000 n \n`);
    text(
        `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    );

    const pdf = new Uint8Array(length);
    let at = 0;
    for (const part of parts) {
        pdf.set(part, at);
        at += part.length;
    }
    return pdf;
};
