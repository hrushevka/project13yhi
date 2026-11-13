namespace lazy_pj.Server.DTOs
{
    public record BodyDto(
        double Mass, double PositionX, double PositionY,
        double VelocityX, double VelocityY);

    public record PresetListItemDto(
        int Id, string Title, string? Description,
        string? Outcome, string? PreviewUrl,
        string AuthorName, DateTime CreatedAt);

    public record PresetDetailDto(
        int Id, string Title, string? Description,
        List<BodyDto> Bodies,
        double G, double Softening, double Dt,
        string? Outcome, string AuthorName);

    public record CreatePresetDto(
        string Title, string? Description,
        List<BodyDto> Bodies,
        double G, double Softening, double Dt,
        string? PreviewImageBase64);
}
