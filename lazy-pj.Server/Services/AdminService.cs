using lazy_pj.Server.Data;
using lazy_pj.Server.Interfaces;
using lazy_pj.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace lazy_pj.Server.Services
{
    public class AdminService : IAdminService
    {
        private readonly AppDbContext _context;

        public AdminService(AppDbContext context) => _context = context;

        public Task<List<UserModel>> GetAllUsersAsync() =>
            _context.Users.AsNoTracking().OrderBy(u => u.Id).ToListAsync();

        public Task<List<UserModel>> GetAllAdminsAsync() =>
            _context.Users.AsNoTracking()
                .Where(u => u.Role == UserRoles.Admin)
                .OrderBy(u => u.Id)
                .ToListAsync();

        public Task<UserModel?> GetUserAsync(int id) =>
            _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);

        public async Task<bool> SetUserAdminAsync(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id)
                       ?? throw new InvalidOperationException("User not found!");

            if (user.Role == UserRoles.Admin)
                throw new InvalidOperationException("User is already an admin!");

            user.Role = UserRoles.Admin;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RemoveUserAdminAsync(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id)
                       ?? throw new InvalidOperationException("User not found!");

            if (user.Role != UserRoles.Admin)
                throw new InvalidOperationException("User is not an admin!");

            user.Role = UserRoles.User;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<string> GetUserRoleAsync(int id)
        {
            var user = await _context.Users.AsNoTracking()
                          .FirstOrDefaultAsync(u => u.Id == id)
                       ?? throw new InvalidOperationException("User not found!");

            return user.Role;
        }

        public async Task<bool> DeleteUserAsync(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id)
                       ?? throw new InvalidOperationException("User not found!");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return true;
        }
        public Task<List<AdminRequestModel>> GetAllRequestsAsync() =>
            _context.Requests.AsNoTracking()
                .OrderByDescending(r => r.CreationTime)
                .ToListAsync();
        
    }
}