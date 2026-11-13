using lazy_pj.Server.Data;
using lazy_pj.Server.Interfaces;
using lazy_pj.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace lazy_pj.Server.Services
{
    public class AuthService : IAuth
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthService(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<bool> RegisterUserAsync(UserModel user)
        {
            var exists = await _context.Users
                .AnyAsync(u => u.Email == user.Email || u.Name == user.Name);

            if (exists)
                throw new InvalidOperationException("User already exists!");

            user.Role = UserRoles.User;
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<LoginResult?> LoginUserAsync(UserModel user)
        {
            var fromDb = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == user.Email);

            if (fromDb is null || fromDb.Password != user.Password)
                throw new InvalidOperationException("Wrong email or password!");

            return new LoginResult
            {
                Token = GenerateJwtToken(fromDb),
                Role = fromDb.Role,
            };
        }

        public async Task<bool> DeleteUserAsync(int id)
        {
            var fromDb = await _context.Users.FirstOrDefaultAsync(u => u.Id == id)
                         ?? throw new InvalidOperationException("User not found!");

            _context.Users.Remove(fromDb);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> EditUserAsync(UserModel user)
        {
            var fromDb = await _context.Users.FirstOrDefaultAsync(u => u.Id == user.Id)
                         ?? throw new InvalidOperationException("User doesnt exist!");

            if (string.IsNullOrWhiteSpace(user.Email) || string.IsNullOrWhiteSpace(user.Password))
                throw new InvalidOperationException("Email or password cannot be empty!");

            fromDb.Name = user.Name;
            fromDb.Email = user.Email;
            fromDb.Password = user.Password;

            await _context.SaveChangesAsync();
            return true;
        }

        private string GenerateJwtToken(UserModel user)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Name, user.Name ?? string.Empty),
                new(ClaimTypes.Role, user.Role),
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}