using System.Globalization;
using System.Text;

namespace api.Email
{
    /// <summary>
    /// Writes a PDF of JPEG pictures, one per US Letter page, laid out as the dashboard and the app
    /// lay out their own PDFs: as wide as the page allows inside a 0.35in margin, centred across
    /// the page and set at the top margin, and shrunk to fit when a picture is too tall. The app
    /// writes its printed PDFs the same way (app/src/Lib/ImagePdf.ts); a change to the layout
    /// belongs in both, so an emailed copy matches a printed one.
    /// </summary>
    public static class ImagePdf
    {
        #region Private Fields

        /// <summary>US Letter, in points.</summary>
        private const double PageW = 612, PageH = 792;

        /// <summary>The margin round each sheet: 0.35in.</summary>
        private const double Margin = 0.35 * 72;

        #endregion

        #region Public Methods

        /// <summary>
        /// Whether these bytes are a JPEG the PDF can use.
        /// </summary>
        /// <param name="bytes">The upload</param>
        /// <returns>True when its size can be read.</returns>
        public static bool IsJpeg(byte[] bytes) =>
            bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && ReadJpeg(bytes) != null;

        /// <summary>
        /// Builds the PDF.
        /// </summary>
        /// <param name="jpegs">The pictures, in page order; each must pass IsJpeg.</param>
        /// <param name="title">The document's title, shown by PDF viewers</param>
        /// <returns>The PDF.</returns>
        public static byte[] Build(IReadOnlyList<byte[]> jpegs, string? title)
        {
            using var pdf = new MemoryStream();
            var offsets = new List<long>();

            void Text(string value) => pdf.Write(Encoding.ASCII.GetBytes(value));
            // Objects are numbered from 1 in the order they are written.
            void Object(string body)
            {
                offsets.Add(pdf.Length);
                Text($"{offsets.Count} 0 obj\n{body}\nendobj\n");
            }

            Text("%PDF-1.4\n");

            // 1: catalog, 2: page tree, 3: document info, then three objects per page.
            static int PageObject(int index) => 4 + index * 3;
            Object("<< /Type /Catalog /Pages 2 0 R >>");
            Object($"<< /Type /Pages /Kids [{string.Join(" ", jpegs.Select((_, i) => $"{PageObject(i)} 0 R"))}] /Count {jpegs.Count} >>");
            var safeTitle = new string((title ?? "").Where(c => c is >= ' ' and <= '~').ToArray())
                .Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
            Object($"<< /Title ({safeTitle}) /Producer (CFS Sales) >>");

            const double boxW = PageW - Margin * 2, boxH = PageH - Margin * 2;
            for (var index = 0; index < jpegs.Count; index++)
            {
                var jpeg = jpegs[index];
                var (width, height, components) = ReadJpeg(jpeg)
                    ?? throw new ArgumentException($"Page {index + 1} isn't a JPEG.");
                var page = PageObject(index);

                var ratio = (double)width / height;
                var w = boxW;
                var h = w / ratio;
                if (h > boxH)
                {
                    h = boxH;
                    w = h * ratio;
                }
                var x = (PageW - w) / 2;
                // PDF measures from the bottom of the page.
                var y = PageH - Margin - h;

                Object($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PageW} {PageH}] " +
                       $"/Resources << /XObject << /Im0 {page + 2} 0 R >> /ProcSet [/PDF /ImageC] >> " +
                       $"/Contents {page + 1} 0 R >>");

                var draw = $"q {Num(w)} 0 0 {Num(h)} {Num(x)} {Num(y)} cm /Im0 Do Q";
                Object($"<< /Length {draw.Length} >>\nstream\n{draw}\nendstream");

                var colors = components switch { 1 => "DeviceGray", 4 => "DeviceCMYK", _ => "DeviceRGB" };
                offsets.Add(pdf.Length);
                Text($"{page + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width {width} /Height {height} " +
                     $"/ColorSpace /{colors} /BitsPerComponent 8 /Filter /DCTDecode /Length {jpeg.Length} >>\nstream\n");
                pdf.Write(jpeg);
                Text("\nendstream\nendobj\n");
            }

            var xref = pdf.Length;
            var table = new StringBuilder($"xref\n0 {offsets.Count + 1}\n0000000000 65535 f \n");
            foreach (var offset in offsets)
                table.Append(CultureInfo.InvariantCulture, $"{offset:D10} 00000 n \n");
            table.Append(CultureInfo.InvariantCulture, $"trailer\n<< /Size {offsets.Count + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n{xref}\n%%EOF\n");
            Text(table.ToString());

            return pdf.ToArray();
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// A number as PDF writes it: at most two decimals, no trailing zeros.
        /// </summary>
        private static string Num(double n) => Math.Round(n, 2).ToString("0.##", CultureInfo.InvariantCulture);

        /// <summary>
        /// Reads a JPEG's size and colour channels from its frame header.
        /// </summary>
        /// <param name="bytes">The JPEG</param>
        /// <returns>Its size and channels, or null when there is no frame header.</returns>
        private static (int Width, int Height, int Components)? ReadJpeg(byte[] bytes)
        {
            var i = 2;
            while (i + 9 < bytes.Length)
            {
                if (bytes[i] != 0xFF)
                {
                    i++;
                    continue;
                }
                var marker = bytes[i + 1];
                // Start-of-frame markers, apart from DHT (C4), JPG (C8) and DAC (CC).
                if (marker is >= 0xC0 and <= 0xCF and not 0xC4 and not 0xC8 and not 0xCC)
                {
                    var height = (bytes[i + 5] << 8) | bytes[i + 6];
                    var width = (bytes[i + 7] << 8) | bytes[i + 8];
                    return width > 0 && height > 0 ? (width, height, bytes[i + 9]) : null;
                }
                // Markers with no length.
                if (marker is 0xD8 or 0x01 or (>= 0xD0 and <= 0xD7))
                {
                    i += 2;
                    continue;
                }
                i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
            }
            return null;
        }

        #endregion
    }
}
