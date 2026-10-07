using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using MimeKit.Utils;

namespace api.Services
{
    /// <summary>
    /// Sends email through an SMTP account - Gmail, Outlook, or the organization's own mail server.
    /// Configured from the "Email" settings section (or Email__* environment variables):
    ///
    ///   Email:Host       smtp.gmail.com
    ///   Email:Port       587
    ///   Email:Security   StartTls (or SslOnConnect, or None)
    ///   Email:Username   the account to sign in as
    ///   Email:Password   its password or app password
    ///   Email:From       the address mail comes from
    ///   Email:FromName   the name shown; when empty, the app name from Settings
    ///   Email:ReplyTo    optional address customers' replies go to, when From isn't read
    ///
    /// Until Host and From are set, email is simply switched off and the app says so.
    /// </summary>
    public class EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        #region Public Methods

        /// <summary>
        /// Whether enough is configured to send.
        /// </summary>
        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(config["Email:Host"]) && !string.IsNullOrWhiteSpace(config["Email:From"]);

        /// <summary>
        /// The address mail is sent from, for display.
        /// </summary>
        public string? FromAddress => config["Email:From"];

        /// <summary>
        /// Checks that every recipient is a well-formed address.
        /// </summary>
        /// <param name="addresses">Comma- or semicolon-separated addresses</param>
        /// <param name="parsed">The parsed addresses</param>
        /// <returns>True when there is at least one and all are valid.</returns>
        public static bool TryParseRecipients(string? addresses, out List<MailboxAddress> parsed)
        {
            parsed = [];
            if (string.IsNullOrWhiteSpace(addresses))
                return false;

            foreach (var part in addresses.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!MailboxAddress.TryParse(part, out var address) || !address.Address.Contains('@'))
                    return false;
                parsed.Add(address);
            }

            return parsed.Count is > 0 and <= 10;
        }

        /// <summary>
        /// Sends one message.
        /// </summary>
        /// <param name="to">Recipients</param>
        /// <param name="subject">Subject line</param>
        /// <param name="html">HTML body</param>
        /// <param name="text">Plain-text body for clients that do not show HTML</param>
        /// <param name="attachments">Optional files: name, content type and bytes</param>
        /// <param name="replyTo">Optional reply-to address</param>
        /// <param name="fromName">The sender's name when Email:FromName isn't set - the app name</param>
        public async Task SendAsync(
            IEnumerable<MailboxAddress> to,
            string subject,
            string html,
            string text,
            IEnumerable<(string Name, string ContentType, byte[] Content)>? attachments = null,
            string? replyTo = null,
            string? fromName = null)
        {
            if (!IsConfigured)
                throw new InvalidOperationException("Email is not set up.");

            var host = config["Email:Host"]!;
            var from = config["Email:From"]!;
            var username = config["Email:Username"];

            var message = new MimeMessage();
            var senderName = new[] { config["Email:FromName"], fromName, "CFS" }.First(n => !string.IsNullOrWhiteSpace(n));
            message.From.Add(new MailboxAddress(senderName, from));
            message.To.AddRange(to);
            message.Subject = subject;

            // The default Message-Id ends in this machine's name - a container id on the Pi - which
            // spam filters read as a sign of a script rather than a real mail account.
            var fromDomain = from[(from.LastIndexOf('@') + 1)..].Trim();
            if (fromDomain.Contains('.'))
                message.MessageId = MimeUtils.GenerateMessageId(fromDomain);

            // A no-reply sender with nowhere for replies to go is another spam signal, so the
            // configured reply address is used when the caller doesn't give one.
            replyTo = string.IsNullOrWhiteSpace(replyTo) ? config["Email:ReplyTo"] : replyTo;
            if (!string.IsNullOrWhiteSpace(replyTo) && MailboxAddress.TryParse(replyTo, out var reply))
                message.ReplyTo.Add(reply);

            var body = new BodyBuilder { HtmlBody = HtmlDocument(subject, html), TextBody = text };
            foreach (var (name, contentType, content) in attachments ?? [])
                body.Attachments.Add(name, content, ContentType.Parse(contentType));
            message.Body = body.ToMessageBody();

            var security = (config["Email:Security"] ?? "StartTls").ToLowerInvariant() switch
            {
                "none" => SecureSocketOptions.None,
                "sslonconnect" or "ssl" => SecureSocketOptions.SslOnConnect,
                "auto" => SecureSocketOptions.Auto,
                _ => SecureSocketOptions.StartTls,
            };
            var port = int.TryParse(config["Email:Port"], out var configured) ? configured : 587;

            using var client = new SmtpClient { Timeout = 20000 };
            await client.ConnectAsync(host, port, security);

            if (!string.IsNullOrWhiteSpace(username))
                await client.AuthenticateAsync(username, config["Email:Password"] ?? string.Empty);

            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            logger.LogInformation("Sent \"{Subject}\" to {Count} recipient(s).", subject, message.To.Count);
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Wraps a body fragment in a complete HTML document. Filters mark down HTML mail with no
        /// html, head or body tags, as it's typical of bulk mail tools.
        /// </summary>
        /// <param name="subject">Subject line, used as the title</param>
        /// <param name="html">The body - a fragment, or already a whole document</param>
        /// <returns>A complete document.</returns>
        private static string HtmlDocument(string subject, string html)
        {
            if (html.TrimStart().StartsWith("<!DOCTYPE", StringComparison.OrdinalIgnoreCase) ||
                html.TrimStart().StartsWith("<html", StringComparison.OrdinalIgnoreCase))
                return html;

            return $"""
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>{System.Net.WebUtility.HtmlEncode(subject)}</title>
                </head>
                <body style="margin:0;padding:16px;background:#ffffff;">
                {html}
                </body>
                </html>
                """;
        }

        #endregion
    }
}
