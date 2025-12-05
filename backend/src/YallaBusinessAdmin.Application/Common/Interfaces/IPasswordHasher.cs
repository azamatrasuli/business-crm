namespace YallaBusinessAdmin.Application.Common.Interfaces;

/// <summary>
/// Service for password hashing and verification.
/// </summary>
public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

