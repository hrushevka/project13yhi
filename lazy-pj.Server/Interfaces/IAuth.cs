using lazy_pj.Server.Models;

namespace lazy_pj.Server.Interfaces
{
    public class LoginResult
    {
        public string Token { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public interface IAuth
    {
        Task<bool> RegisterUserAsync(UserModel user);
        Task<LoginResult?> LoginUserAsync(UserModel user);   // ← было Task<string?>
        Task<bool> DeleteUserAsync(int id);
        Task<bool> EditUserAsync(UserModel user);
    }
}