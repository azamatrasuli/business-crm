namespace YallaBusinessAdmin.Application.Common.Models;

/// <summary>
/// Generic paged result wrapper matching the NestJS API response format.
/// </summary>
public class PagedResult<T>
{
    public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }

    public static PagedResult<T> Create(IEnumerable<T> items, int total, int page, int pageSize)
    {
        return new PagedResult<T>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        };
    }
}

