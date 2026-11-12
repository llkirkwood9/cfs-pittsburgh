using System.Collections.Concurrent;

namespace api.Email
{
    /// <summary>
    /// The pictures of a stack of sheets, uploaded one page at a time while the device is still
    /// making the rest, and kept in memory until they are emailed. One small upload per page means
    /// no request runs long enough for a slow venue connection, the browser or a proxy to give up
    /// on it, and a dropped connection costs one page that is simply sent again. Uploads nobody
    /// finishes are dropped after half an hour.
    /// </summary>
    public class PageUploads
    {
        #region Public Fields

        /// <summary>
        /// The most pages one upload may have - several times the largest event's stack.
        /// </summary>
        public const int MaxPages = 500;

        /// <summary>
        /// The largest single page picture.
        /// </summary>
        public const long MaxPageBytes = 4 * 1024 * 1024;

        #endregion

        #region Private Fields

        /// <summary>How long an unfinished upload is kept.</summary>
        private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

        /// <summary>The most unfinished uploads one person may have at once.</summary>
        private const int MaxPerUser = 4;

        private readonly ConcurrentDictionary<Guid, Upload> uploads = new();

        #endregion

        #region Public Methods

        /// <summary>
        /// Starts an upload.
        /// </summary>
        /// <param name="userId">Who is uploading; only they can add to it or send it.</param>
        /// <param name="pageCount">How many pages it will have</param>
        /// <returns>The upload's id.</returns>
        public Guid Start(int userId, int pageCount)
        {
            DropExpired();

            // A device that gave up and started again leaves its old upload behind.
            foreach (var stale in uploads.Where(u => u.Value.UserId == userId)
                         .OrderByDescending(u => u.Value.Started).Skip(MaxPerUser - 1).ToList())
                uploads.TryRemove(stale.Key, out _);

            var id = Guid.NewGuid();
            uploads[id] = new Upload(userId, DateTime.UtcNow, new byte[]?[pageCount]);
            return id;
        }

        /// <summary>
        /// Keeps one page. Sending the same page again replaces it, so a retry after a reply that
        /// never arrived does no harm.
        /// </summary>
        /// <param name="id">The upload</param>
        /// <param name="userId">Who is uploading</param>
        /// <param name="index">The page, from 0</param>
        /// <param name="picture">The page's JPEG</param>
        /// <param name="maxTotalBytes">The most all the pages together may come to</param>
        /// <returns>Null when kept, otherwise what was wrong.</returns>
        public string? Put(Guid id, int userId, int index, byte[] picture, long maxTotalBytes)
        {
            if (!uploads.TryGetValue(id, out var upload) || upload.UserId != userId || upload.Expired)
                return Missing;
            if (index < 0 || index >= upload.Pages.Length)
                return "That page isn't part of this upload.";

            lock (upload)
            {
                var total = upload.Pages.Where((p, i) => p != null && i != index).Sum(p => (long)p!.Length);
                if (total + picture.Length > maxTotalBytes)
                    return TooLarge;
                upload.Pages[index] = picture;
            }
            return null;
        }

        /// <summary>
        /// Every page of a finished upload. The upload is kept until Finish, so a send the mail
        /// server refused can be tried again without uploading the pages again.
        /// </summary>
        /// <param name="id">The upload</param>
        /// <param name="userId">Who uploaded it</param>
        /// <param name="pages">The pictures, in page order</param>
        /// <returns>Null when every page is there, otherwise what was wrong.</returns>
        public string? Get(Guid id, int userId, out List<byte[]> pages)
        {
            pages = [];
            if (!uploads.TryGetValue(id, out var upload) || upload.UserId != userId || upload.Expired)
                return Missing;

            lock (upload)
            {
                var missing = Array.FindIndex(upload.Pages, p => p == null);
                if (missing >= 0)
                    return $"Page {missing + 1} of the sheets didn't come through. Please try again.";
                pages = upload.Pages.Select(p => p!).ToList();
            }
            return null;
        }

        /// <summary>
        /// Forgets an upload once it has been emailed.
        /// </summary>
        /// <param name="id">The upload</param>
        public void Finish(Guid id) => uploads.TryRemove(id, out _);

        #endregion

        #region Private Methods

        private const string Missing = "The upload ran out of time. Please try again.";

        private const string TooLarge =
            "These sheets make a PDF too large to email. Print them, or save them as a PDF and share it another way.";

        private void DropExpired()
        {
            foreach (var expired in uploads.Where(u => u.Value.Expired).ToList())
                uploads.TryRemove(expired.Key, out _);
        }

        /// <summary>One upload: whose it is, when it started and the pages so far.</summary>
        private sealed record Upload(int UserId, DateTime Started, byte[]?[] Pages)
        {
            public bool Expired => DateTime.UtcNow - Started > Lifetime;
        }

        #endregion
    }
}
