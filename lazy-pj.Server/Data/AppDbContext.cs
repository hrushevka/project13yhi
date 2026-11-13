using Microsoft.EntityFrameworkCore;
using lazy_pj.Server.Models;
namespace lazy_pj.Server.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions options) : base(options)
        {
        }
        public DbSet<UserModel> Users { get; set; }
        public DbSet<AdminRequestModel> Requests { get; set; }
        protected override void OnModelCreating(ModelBuilder mb)
        {
            mb.Entity<UserModel>()
              .HasIndex(u => u.Email)
              .IsUnique();
        }
    }
}
