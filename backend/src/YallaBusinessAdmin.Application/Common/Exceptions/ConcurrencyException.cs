namespace YallaBusinessAdmin.Application.Common.Exceptions;

/// <summary>
/// Exception thrown when a concurrency conflict occurs during data modification
/// </summary>
public class ConcurrencyException : Exception
{
    public ConcurrencyException() 
        : base("Данные были изменены другим пользователем. Пожалуйста, обновите страницу и попробуйте снова.")
    {
    }

    public ConcurrencyException(string message) : base(message)
    {
    }

    public ConcurrencyException(string message, Exception innerException) 
        : base(message, innerException)
    {
    }
}

