using System.Security.Cryptography;

namespace CourseIntellect.Infrastructure.Auth;

public static class PasswordGenerator
{
    private const string Charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string Generate(int length = 8)
    {
        if (length < 6) length = 6;
        var bytes = new byte[length];
        RandomNumberGenerator.Fill(bytes);
        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = Charset[bytes[i] % Charset.Length];
        }
        return new string(chars);
    }
}
