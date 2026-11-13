using lazy_pj.Server.Models;

namespace lazy_pj.Server.Models
{

    public class UserModel
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = UserRoles.Admin;
    }
} 

