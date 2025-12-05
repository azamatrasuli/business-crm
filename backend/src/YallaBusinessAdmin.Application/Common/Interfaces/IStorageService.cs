namespace YallaBusinessAdmin.Application.Common.Interfaces;

public interface IStorageService
{
    /// <summary>
    /// Upload a file to storage
    /// </summary>
    Task<string> UploadAsync(string bucket, string path, Stream fileStream, string contentType, CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete a file from storage
    /// </summary>
    Task DeleteAsync(string bucket, string path, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get public URL for a file
    /// </summary>
    string GetPublicUrl(string bucket, string path);

    /// <summary>
    /// Get signed URL for private files
    /// </summary>
    Task<string> GetSignedUrlAsync(string bucket, string path, int expiresInSeconds = 3600, CancellationToken cancellationToken = default);

    /// <summary>
    /// List files in a folder
    /// </summary>
    Task<IEnumerable<StorageFile>> ListFilesAsync(string bucket, string path, CancellationToken cancellationToken = default);
}

public record StorageFile(string Name, string Url, long Size, DateTime CreatedAt);

