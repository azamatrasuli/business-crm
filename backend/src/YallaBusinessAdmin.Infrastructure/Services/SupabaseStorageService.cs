using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using YallaBusinessAdmin.Application.Common.Interfaces;

namespace YallaBusinessAdmin.Infrastructure.Services;

public class SupabaseStorageService : IStorageService
{
    private readonly HttpClient _httpClient;
    private readonly string _supabaseUrl;
    private readonly string _supabaseKey;
    private readonly ILogger<SupabaseStorageService> _logger;

    public SupabaseStorageService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<SupabaseStorageService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        
        _supabaseUrl = configuration["Supabase:Url"] 
            ?? throw new InvalidOperationException("Supabase:Url not configured");
        _supabaseKey = configuration["Supabase:ServiceRoleKey"] 
            ?? configuration["Supabase:AnonKey"]
            ?? throw new InvalidOperationException("Supabase key not configured");

        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _supabaseKey);
        _httpClient.DefaultRequestHeaders.Add("apikey", _supabaseKey);
    }

    public async Task<string> UploadAsync(string bucket, string path, Stream fileStream, string contentType, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{_supabaseUrl}/storage/v1/object/{bucket}/{path}";
            
            using var content = new StreamContent(fileStream);
            content.Headers.ContentType = new MediaTypeHeaderValue(contentType);

            var response = await _httpClient.PostAsync(url, content, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Failed to upload file to Supabase Storage: {Error}", error);
                throw new InvalidOperationException($"Failed to upload file: {error}");
            }

            return GetPublicUrl(bucket, path);
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Error uploading file to Supabase Storage");
            throw;
        }
    }

    public async Task DeleteAsync(string bucket, string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{_supabaseUrl}/storage/v1/object/{bucket}/{path}";
            
            var response = await _httpClient.DeleteAsync(url, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Failed to delete file from Supabase Storage: {Error}", error);
                throw new InvalidOperationException($"Failed to delete file: {error}");
            }
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Error deleting file from Supabase Storage");
            throw;
        }
    }

    public string GetPublicUrl(string bucket, string path)
    {
        return $"{_supabaseUrl}/storage/v1/object/public/{bucket}/{path}";
    }

    public async Task<string> GetSignedUrlAsync(string bucket, string path, int expiresInSeconds = 3600, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{_supabaseUrl}/storage/v1/object/sign/{bucket}/{path}";
            
            var requestBody = JsonSerializer.Serialize(new { expiresIn = expiresInSeconds });
            using var content = new StringContent(requestBody, System.Text.Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Failed to get signed URL from Supabase Storage: {Error}", error);
                throw new InvalidOperationException($"Failed to get signed URL: {error}");
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<SignedUrlResponse>(responseBody);
            
            return $"{_supabaseUrl}/storage/v1{result?.SignedUrl}";
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Error getting signed URL from Supabase Storage");
            throw;
        }
    }

    public async Task<IEnumerable<StorageFile>> ListFilesAsync(string bucket, string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{_supabaseUrl}/storage/v1/object/list/{bucket}";
            
            var requestBody = JsonSerializer.Serialize(new 
            { 
                prefix = path,
                limit = 100,
                offset = 0,
                sortBy = new { column = "created_at", order = "desc" }
            });
            using var content = new StringContent(requestBody, System.Text.Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Failed to list files from Supabase Storage: {Error}", error);
                throw new InvalidOperationException($"Failed to list files: {error}");
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var files = JsonSerializer.Deserialize<List<StorageFileResponse>>(responseBody, new JsonSerializerOptions 
            { 
                PropertyNameCaseInsensitive = true 
            }) ?? new List<StorageFileResponse>();

            return files.Select(f => new StorageFile(
                f.Name,
                GetPublicUrl(bucket, $"{path}/{f.Name}"),
                f.Metadata?.Size ?? 0,
                f.CreatedAt ?? DateTime.UtcNow
            ));
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Error listing files from Supabase Storage");
            throw;
        }
    }

    private class SignedUrlResponse
    {
        public string? SignedUrl { get; set; }
    }

    private class StorageFileResponse
    {
        public string Name { get; set; } = string.Empty;
        public DateTime? CreatedAt { get; set; }
        public FileMetadata? Metadata { get; set; }
    }

    private class FileMetadata
    {
        public long Size { get; set; }
    }
}

