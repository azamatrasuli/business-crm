namespace YallaBusinessAdmin.Application.Common;

/// <summary>
/// Represents the result of an operation that can succeed or fail
/// </summary>
public class Result
{
    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public Error? Error { get; }

    protected Result(bool isSuccess, Error? error)
    {
        if (isSuccess && error != null)
            throw new InvalidOperationException("Successful result cannot have an error");
        if (!isSuccess && error == null)
            throw new InvalidOperationException("Failed result must have an error");

        IsSuccess = isSuccess;
        Error = error;
    }

    public static Result Success() => new(true, null);
    public static Result Failure(Error error) => new(false, error);
    public static Result<T> Success<T>(T value) => new(value, true, null);
    public static Result<T> Failure<T>(Error error) => new(default, false, error);
}

/// <summary>
/// Represents the result of an operation that returns a value
/// </summary>
public class Result<T> : Result
{
    public T? Value { get; }

    internal Result(T? value, bool isSuccess, Error? error) : base(isSuccess, error)
    {
        Value = value;
    }

    public static implicit operator Result<T>(T value) => Success(value);
}

/// <summary>
/// Represents an error with a code, message, and type
/// </summary>
public record Error(string Code, string Message, ErrorType Type, Dictionary<string, object>? Details = null)
{
    public static Error Validation(string code, string message, Dictionary<string, object>? details = null) 
        => new(code, message, ErrorType.Validation, details);
    
    public static Error NotFound(string code, string message, Dictionary<string, object>? details = null) 
        => new(code, message, ErrorType.NotFound, details);
    
    public static Error Forbidden(string code, string message, Dictionary<string, object>? details = null) 
        => new(code, message, ErrorType.Forbidden, details);
    
    public static Error Conflict(string code, string message, Dictionary<string, object>? details = null) 
        => new(code, message, ErrorType.Conflict, details);
    
    public static Error Internal(string code, string message, Dictionary<string, object>? details = null) 
        => new(code, message, ErrorType.Internal, details);
}

/// <summary>
/// Types of errors
/// </summary>
public enum ErrorType
{
    Validation,
    NotFound,
    Forbidden,
    Conflict,
    Internal
}


