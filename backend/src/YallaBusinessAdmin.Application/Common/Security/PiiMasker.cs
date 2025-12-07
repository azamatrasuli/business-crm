using System.Text.RegularExpressions;

namespace YallaBusinessAdmin.Application.Common.Security;

/// <summary>
/// Utility for masking Personally Identifiable Information (PII) in logs
/// </summary>
public static class PiiMasker
{
    /// <summary>
    /// Mask a phone number, showing only last 4 digits
    /// Example: +992901234567 → +992****4567
    /// </summary>
    public static string MaskPhone(string? phone)
    {
        if (string.IsNullOrEmpty(phone))
            return "***";

        if (phone.Length <= 4)
            return "****";

        var prefix = phone.StartsWith('+') ? phone[..4] : "";
        var suffix = phone[^4..];
        var middleLength = phone.Length - prefix.Length - 4;
        
        return $"{prefix}{new string('*', Math.Max(middleLength, 4))}{suffix}";
    }

    /// <summary>
    /// Mask an email address, showing only first 2 chars and domain
    /// Example: user@example.com → us***@example.com
    /// </summary>
    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrEmpty(email))
            return "***";

        var atIndex = email.IndexOf('@');
        if (atIndex <= 0)
            return "***@***";

        var localPart = email[..atIndex];
        var domain = email[atIndex..];
        
        var visibleChars = Math.Min(2, localPart.Length);
        var masked = localPart[..visibleChars] + new string('*', Math.Max(localPart.Length - visibleChars, 3));
        
        return masked + domain;
    }

    /// <summary>
    /// Mask a full name, showing only first letter of each word
    /// Example: Иван Петров → И*** П***
    /// </summary>
    public static string MaskName(string? name)
    {
        if (string.IsNullOrEmpty(name))
            return "***";

        var words = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var maskedWords = words.Select(w => 
            w.Length > 0 ? $"{w[0]}***" : "***"
        );
        
        return string.Join(" ", maskedWords);
    }

    /// <summary>
    /// Mask an IP address, showing only first 2 octets
    /// Example: 192.168.1.100 → 192.168.*.*
    /// </summary>
    public static string MaskIpAddress(string? ip)
    {
        if (string.IsNullOrEmpty(ip))
            return "*.*.*.*";

        // IPv4
        var parts = ip.Split('.');
        if (parts.Length == 4)
        {
            return $"{parts[0]}.{parts[1]}.*.*";
        }

        // IPv6 - just mask last half
        var colonParts = ip.Split(':');
        if (colonParts.Length > 4)
        {
            var visible = string.Join(":", colonParts.Take(4));
            return $"{visible}:****";
        }

        return "***";
    }

    /// <summary>
    /// Mask a generic identifier/token
    /// </summary>
    public static string MaskToken(string? token)
    {
        if (string.IsNullOrEmpty(token))
            return "***";

        if (token.Length <= 8)
            return new string('*', token.Length);

        return $"{token[..4]}...{token[^4..]}";
    }

    /// <summary>
    /// Mask sensitive fields in an object for logging
    /// Returns a safe-to-log dictionary
    /// </summary>
    public static Dictionary<string, object?> MaskSensitiveFields(object? obj)
    {
        if (obj == null)
            return new Dictionary<string, object?>();

        var result = new Dictionary<string, object?>();
        var type = obj.GetType();

        foreach (var prop in type.GetProperties())
        {
            var name = prop.Name.ToLowerInvariant();
            var value = prop.GetValue(obj);

            // Mask sensitive fields
            if (SensitiveFieldNames.Any(s => name.Contains(s)))
            {
                result[prop.Name] = value switch
                {
                    string str when name.Contains("phone") => MaskPhone(str),
                    string str when name.Contains("email") => MaskEmail(str),
                    string str when name.Contains("name") && !name.Contains("company") && !name.Contains("project") => MaskName(str),
                    string str when name.Contains("password") || name.Contains("secret") || name.Contains("token") => "***",
                    string str when name.Contains("ip") => MaskIpAddress(str),
                    null => null,
                    _ => "***"
                };
            }
            else
            {
                result[prop.Name] = value;
            }
        }

        return result;
    }

    /// <summary>
    /// Mask sensitive data in a string (for log messages)
    /// </summary>
    public static string MaskSensitiveDataInString(string input)
    {
        if (string.IsNullOrEmpty(input))
            return input;

        var result = input;

        // Mask phone numbers (various formats)
        result = Regex.Replace(result, @"\+?\d{10,15}", match => MaskPhone(match.Value));
        
        // Mask email addresses
        result = Regex.Replace(result, @"[\w\.-]+@[\w\.-]+\.\w+", match => MaskEmail(match.Value));
        
        // Mask JWTs (eyJ...)
        result = Regex.Replace(result, @"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "***JWT***");
        
        // Mask base64 tokens (longer than 32 chars)
        result = Regex.Replace(result, @"[A-Za-z0-9+/]{32,}={0,2}", match => MaskToken(match.Value));

        return result;
    }

    private static readonly string[] SensitiveFieldNames = 
    {
        "password", "secret", "token", "key", "phone", "email", 
        "name", "address", "ip", "creditcard", "ssn", "passport"
    };
}

