using lazy_pj.Server.Models;

namespace lazy_pj.Server.Interfaces
{
    public interface IAdminService
    {
        Task<List<UserModel>> GetAllUsersAsync();
        Task<List<UserModel>> GetAllAdminsAsync();
        Task<UserModel?> GetUserAsync(int id);
        Task<bool> SetUserAdminAsync(int id);
        Task<bool> RemoveUserAdminAsync(int id);
        Task<string> GetUserRoleAsync(int id);
        Task<bool> DeleteUserAsync(int id);
    }
}