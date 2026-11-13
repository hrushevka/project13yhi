using lazy_pj.Server.Data;
using lazy_pj.Server.DTOs;
using lazy_pj.Server.Interfaces;
using lazy_pj.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace lazy_pj.Server.Services
{
    public class PresetService : IPreserService
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<PresetService> _log;

        private const long MaxImageBytes = 500_000;
        private static readonly string[] AllowedOutcomes =
            { "collision", "ejection", "stable", "figure8", "lagrange" };

        public PresetService(AppDbContext db, IWebHostEnvironment env, ILogger<PresetService> log)
        {
            _db = db;
            _env = env;
            _log = log;
        }

        public async Task<IReadOnlyList<PresetListItemDto>> GetPublicAsync(
            string? search, string? outcome, int page, int pageSize,
            CancellationToken ct = default)
        {
            if (page < 1) page = 1;
            if (pageSize is < 1 or > 100) pageSize = 20;

            var q = _db.Presets
                .Where(p => p.IsPublic)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
                q = q.Where(p => p.Title.Contains(search));

            if (!string.IsNullOrWhiteSpace(outcome) && AllowedOutcomes.Contains(outcome))
                q = q.Where(p => p.Outcome == outcome);

            return await q
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Join(_db.Users,
                      p => p.UserId,
                      u => u.Id,
                      (p, u) => new PresetListItemDto(
                          p.Id, p.Title, p.Description, p.Outcome,
                          p.ImagePath == null ? null : $"/api/presets/{p.Id}/preview",
                          u.Name ?? "unknown",
                          p.CreatedAt))
                .ToListAsync(ct);
        }

        public async Task<PresetDetailDto?> GetByIdAsync(int id, CancellationToken ct = default)
        {
            var p = await _db.Presets
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.IsPublic, ct);

            if (p is null) return null;

            var authorName = await _db.Users
                .Where(u => u.Id == p.UserId)
                .Select(u => u.Name)
                .FirstOrDefaultAsync(ct) ?? "unknown";

            return new PresetDetailDto(
                p.Id, p.Title, p.Description,
                p.Bodies.Select(b => new BodyDto(
                    b.Mass, b.PositionX, b.PositionY,
                    b.VelocityX, b.VelocityY)).ToList(),
                p.G, p.Softening, p.Dt, p.Outcome,
                authorName);
        }

        public async Task<PresetDetailDto> CreateAsync(
            CreatePresetDto dto, int userId, CancellationToken ct = default)
        {
            Validate(dto);

            var preset = new PresetModel
            {
                Title = dto.Title.Trim(),
                Description = string.IsNullOrWhiteSpace(dto.Description)
                    ? null
                    : dto.Description.Trim(),
                Bodies = dto.Bodies.Select(b => new BodyModel
                {
                    Mass = b.Mass,
                    PositionX = b.PositionX,
                    PositionY = b.PositionY,
                    VelocityX = b.VelocityX,
                    VelocityY = b.VelocityY
                }).ToList(),
                G = dto.G,
                Softening = dto.Softening,
                Dt = dto.Dt,
                UserId = userId,
                IsPublic = true,
                CreatedAt = DateTime.UtcNow
            };

            if (!string.IsNullOrWhiteSpace(dto.PreviewImageBase64))
                preset.ImagePath = await SaveImageAsync(dto.PreviewImageBase64, ct);

            _db.Presets.Add(preset);
            await _db.SaveChangesAsync(ct);

            _log.LogInformation("Preset {Id} created by user {UserId}", preset.Id, userId);

            var author = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.Name)
                .FirstOrDefaultAsync(ct) ?? "unknown";

            return new PresetDetailDto(
                preset.Id, preset.Title, preset.Description,
                preset.Bodies.Select(b => new BodyDto(
                    b.Mass, b.PositionX, b.PositionY,
                    b.VelocityX, b.VelocityY)).ToList(),
                preset.G, preset.Softening, preset.Dt, preset.Outcome,
                author);
        }

        public async Task<bool> DeleteAsync(int id, int userId, CancellationToken ct = default)
        {
            var p = await _db.Presets
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);

            if (p is null) return false;

            if (!string.IsNullOrWhiteSpace(p.ImagePath))
            {
                var path = Path.Combine(_env.WebRootPath, p.ImagePath);
                if (File.Exists(path)) File.Delete(path);
            }

            _db.Presets.Remove(p);
            await _db.SaveChangesAsync(ct);
            return true;
        }

        public async Task<string?> GetPreviewImagePathAsync(int id, CancellationToken ct = default)
        {
            var imagePath = await _db.Presets
                .Where(p => p.Id == id && p.ImagePath != null)
                .Select(p => p.ImagePath)
                .FirstOrDefaultAsync(ct);

            if (imagePath is null) return null;

            var full = Path.Combine(_env.WebRootPath, imagePath);
            return File.Exists(full) ? full : null;
        }

        private static void Validate(CreatePresetDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
                throw new ArgumentException("Title is required");
            if (dto.Title.Length > 128)
                throw new ArgumentException("Title is too long");
            if (dto.Bodies is null || dto.Bodies.Count != 3)
                throw new ArgumentException("Exactly 3 bodies are required");
            if (dto.Bodies.Any(b => b.Mass <= 0))
                throw new ArgumentException("Mass must be positive");
            if (dto.Dt <= 0)
                throw new ArgumentException("Dt must be positive");
            if (dto.Softening < 0)
                throw new ArgumentException("Softening cannot be negative");
        }

        private async Task<string> SaveImageAsync(string base64, CancellationToken ct)
        {
            var raw = base64.Contains(',') ? base64.Split(',')[^1] : base64;

            byte[] bytes;
            try { bytes = Convert.FromBase64String(raw); }
            catch (FormatException) { throw new ArgumentException("Invalid image data"); }

            if (bytes.Length > MaxImageBytes)
                throw new ArgumentException("Image is too large (max 500 KB)");

            var dir = Path.Combine(_env.WebRootPath, "uploads", "previews");
            Directory.CreateDirectory(dir);

            var fileName = $"{Guid.NewGuid():N}.png";
            var fullPath = Path.Combine(dir, fileName);
            await File.WriteAllBytesAsync(fullPath, bytes, ct);

            return Path.Combine("uploads", "previews", fileName).Replace('\\', '/');
        }
    }
}