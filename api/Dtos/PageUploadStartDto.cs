namespace api.Dtos
{
    /// <summary>
    /// Starts a page-by-page upload of sheets to email.
    /// </summary>
    public class PageUploadStartDto
    {
        /// <summary>
        /// How many pages will be uploaded
        /// </summary>
        public int PageCount { get; set; }
    }
}
