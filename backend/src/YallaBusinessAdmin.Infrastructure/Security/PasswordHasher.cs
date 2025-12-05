using YallaBusinessAdmin.Application.Common.Interfaces;
using BC = BCrypt.Net.BCrypt;

namespace YallaBusinessAdmin.Infrastructure.Security;

public class PasswordHasher : IPasswordHasher
{
    public string Hash(string password)
    {
        return BC.HashPassword(password, workFactor: 10);
    }

    public bool Verify(string password, string hash)
    {
        // Handle special case for Supabase-synced users
        if (hash == "supabase_synced")
            return false;

        try
        {
            return BC.Verify(password, hash);
        }
        catch
        {
            return false;
        }
    }
}

