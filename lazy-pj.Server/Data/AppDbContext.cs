using lazy_pj.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace lazy_pj.Server.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions options) : base(options) { }

        public DbSet<UserModel> Users { get; set; }
        public DbSet<PresetModel> Presets { get; set; }

        protected override void OnModelCreating(ModelBuilder mb)
        {
            mb.Entity<UserModel>()
                .HasIndex(u => u.Email)
                .IsUnique();

            mb.Entity<PresetModel>()
                .OwnsMany(p => p.Bodies, b => b.ToJson());
        }
    }
}