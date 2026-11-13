using lazy_pj.Server.DTOs;

namespace lazy_pj.Server.Interfaces
{
    public interface IPreserService
    {
        Task<IReadOnlyList<PresetListItemDto>> GetPublicAsync(
            string? search, string? outcome, int page, int pageSize,
            CancellationToken ct = default);

        Task<PresetDetailDto?> GetByIdAsync(int id, CancellationToken ct = default);

        Task<PresetDetailDto> CreateAsync(
            CreatePresetDto dto, int userId, CancellationToken ct = default);

        Task<bool> DeleteAsync(int id, int userId, CancellationToken ct = default);

        Task<string?> GetPreviewImagePathAsync(int id, CancellationToken ct = default);
    }
}