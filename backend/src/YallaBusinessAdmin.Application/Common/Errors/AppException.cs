namespace YallaBusinessAdmin.Application.Common.Errors;

/// <summary>
/// Base exception for application-specific errors
/// </summary>
public class AppException : Exception
{
    public string Code { get; }
    public ErrorType Type { get; }
    public Dictionary<string, object>? Details { get; }

    public AppException(string code, string message, ErrorType type, Dictionary<string, object>? details = null) 
        : base(message)
    {
        Code = code;
        Type = type;
        Details = details;
    }

    public Error ToError() => new(Code, Message, Type, Details);
}

/// <summary>
/// Validation exception (400 Bad Request)
/// </summary>
public class ValidationException : AppException
{
    public ValidationException(string code, string message, Dictionary<string, object>? details = null) 
        : base(code, message, ErrorType.Validation, details) { }

    public static ValidationException RequiredField(string fieldName) =>
        new(ErrorCodes.VALIDATION_ERROR, $"Поле '{fieldName}' обязательно для заполнения", 
            new Dictionary<string, object> { ["field"] = fieldName });

    public static ValidationException InvalidFormat(string fieldName, string expectedFormat) =>
        new(ErrorCodes.VALIDATION_ERROR, $"Неверный формат поля '{fieldName}'. Ожидается: {expectedFormat}",
            new Dictionary<string, object> { ["field"] = fieldName, ["expectedFormat"] = expectedFormat });
}

/// <summary>
/// Not found exception (404 Not Found)
/// </summary>
public class NotFoundException : AppException
{
    public NotFoundException(string code, string message, Dictionary<string, object>? details = null) 
        : base(code, message, ErrorType.NotFound, details) { }

    public static NotFoundException Entity(string entityType, Guid id) =>
        new(ErrorCodes.NOT_FOUND, $"{entityType} не найден",
            new Dictionary<string, object> { ["entityType"] = entityType, ["id"] = id });
}

/// <summary>
/// Forbidden exception (403 Forbidden)
/// </summary>
public class ForbiddenException : AppException
{
    public ForbiddenException(string code, string message, Dictionary<string, object>? details = null) 
        : base(code, message, ErrorType.Forbidden, details) { }
}

/// <summary>
/// Conflict exception (409 Conflict)
/// </summary>
public class ConflictException : AppException
{
    public ConflictException(string code, string message, Dictionary<string, object>? details = null) 
        : base(code, message, ErrorType.Conflict, details) { }

    public static ConflictException DuplicateField(string fieldName, string value) =>
        new(ErrorCodes.CONFLICT, $"Значение '{value}' для поля '{fieldName}' уже используется",
            new Dictionary<string, object> { ["field"] = fieldName, ["value"] = value });
}

/// <summary>
/// Business rule exception (400 Bad Request) - for business logic violations
/// </summary>
public class BusinessRuleException : AppException
{
    public BusinessRuleException(string code, string message, Dictionary<string, object>? details = null) 
        : base(code, message, ErrorType.Validation, details) { }
}


