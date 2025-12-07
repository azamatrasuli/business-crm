using System.Text.RegularExpressions;

namespace YallaBusinessAdmin.Application.Common.Validators;

/// <summary>
/// Password complexity validator
/// </summary>
public static class PasswordValidator
{
    /// <summary>
    /// Minimum password length
    /// </summary>
    public const int MinLength = 8;
    
    /// <summary>
    /// Maximum password length
    /// </summary>
    public const int MaxLength = 128;

    /// <summary>
    /// Validates password complexity and returns validation result
    /// </summary>
    public static PasswordValidationResult Validate(string password)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(password))
        {
            return new PasswordValidationResult(false, new[] { "Пароль не может быть пустым" });
        }

        // Length check
        if (password.Length < MinLength)
        {
            errors.Add($"Пароль должен быть не менее {MinLength} символов");
        }

        if (password.Length > MaxLength)
        {
            errors.Add($"Пароль должен быть не более {MaxLength} символов");
        }

        // Must contain at least one uppercase letter
        if (!Regex.IsMatch(password, @"[A-ZА-ЯЁ]"))
        {
            errors.Add("Пароль должен содержать хотя бы одну заглавную букву");
        }

        // Must contain at least one lowercase letter
        if (!Regex.IsMatch(password, @"[a-zа-яё]"))
        {
            errors.Add("Пароль должен содержать хотя бы одну строчную букву");
        }

        // Must contain at least one digit
        if (!Regex.IsMatch(password, @"\d"))
        {
            errors.Add("Пароль должен содержать хотя бы одну цифру");
        }

        // Must contain at least one special character
        if (!Regex.IsMatch(password, @"[!@#$%^&*()_+\-=\[\]{};':""\\|,.<>\/?~`]"))
        {
            errors.Add("Пароль должен содержать хотя бы один специальный символ (!@#$%^&*...)");
        }

        // Check for common weak passwords
        var lowercasePassword = password.ToLowerInvariant();
        var commonPasswords = new[]
        {
            "password", "123456", "12345678", "qwerty", "admin", "letmein",
            "welcome", "monkey", "dragon", "master", "пароль", "йцукен"
        };

        if (commonPasswords.Any(p => lowercasePassword.Contains(p)))
        {
            errors.Add("Пароль слишком простой. Используйте уникальную комбинацию");
        }

        // Check for sequential characters
        if (HasSequentialCharacters(password, 4))
        {
            errors.Add("Пароль не должен содержать последовательности символов (1234, abcd)");
        }

        // Check for repeated characters
        if (HasRepeatedCharacters(password, 3))
        {
            errors.Add("Пароль не должен содержать повторяющиеся символы (aaa, 111)");
        }

        return new PasswordValidationResult(errors.Count == 0, errors);
    }

    /// <summary>
    /// Quick check if password meets minimum requirements
    /// </summary>
    public static bool MeetsMinimumRequirements(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinLength)
            return false;

        return Regex.IsMatch(password, @"[A-ZА-ЯЁ]") &&  // Uppercase
               Regex.IsMatch(password, @"[a-zа-яё]") &&   // Lowercase
               Regex.IsMatch(password, @"\d") &&          // Digit
               Regex.IsMatch(password, @"[!@#$%^&*()_+\-=\[\]{};':""\\|,.<>\/?~`]"); // Special
    }

    /// <summary>
    /// Calculates password strength score (0-100)
    /// </summary>
    public static int CalculateStrength(string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return 0;

        var score = 0;

        // Length score (max 30)
        score += Math.Min(password.Length * 2, 30);

        // Character variety score (max 40)
        if (Regex.IsMatch(password, @"[A-ZА-ЯЁ]")) score += 10;
        if (Regex.IsMatch(password, @"[a-zа-яё]")) score += 10;
        if (Regex.IsMatch(password, @"\d")) score += 10;
        if (Regex.IsMatch(password, @"[!@#$%^&*()_+\-=\[\]{};':""\\|,.<>\/?~`]")) score += 10;

        // Unique characters bonus (max 20)
        var uniqueChars = password.Distinct().Count();
        score += Math.Min(uniqueChars, 20);

        // Penalty for common patterns
        if (HasSequentialCharacters(password, 3)) score -= 10;
        if (HasRepeatedCharacters(password, 3)) score -= 10;

        return Math.Max(0, Math.Min(100, score));
    }

    private static bool HasSequentialCharacters(string password, int minLength)
    {
        if (password.Length < minLength)
            return false;

        for (int i = 0; i <= password.Length - minLength; i++)
        {
            var isSequence = true;
            var isReverseSequence = true;

            for (int j = 0; j < minLength - 1; j++)
            {
                if (password[i + j + 1] - password[i + j] != 1)
                    isSequence = false;
                if (password[i + j] - password[i + j + 1] != 1)
                    isReverseSequence = false;
            }

            if (isSequence || isReverseSequence)
                return true;
        }

        return false;
    }

    private static bool HasRepeatedCharacters(string password, int minLength)
    {
        if (password.Length < minLength)
            return false;

        for (int i = 0; i <= password.Length - minLength; i++)
        {
            var allSame = true;
            for (int j = 1; j < minLength; j++)
            {
                if (password[i + j] != password[i])
                {
                    allSame = false;
                    break;
                }
            }

            if (allSame)
                return true;
        }

        return false;
    }
}

/// <summary>
/// Result of password validation
/// </summary>
public record PasswordValidationResult(bool IsValid, IEnumerable<string> Errors)
{
    public string ErrorMessage => string.Join(". ", Errors);
}

