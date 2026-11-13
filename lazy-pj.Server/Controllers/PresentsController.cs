using lazy_pj.Server.DTOs;
using lazy_pj.Server.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace lazy_pj.Server.Controllers
{
    [ApiController]
    [Route("api/presets")]
    public class PresetsController : ControllerBase
    {
        private readonly IPreserService _presets;

        public PresetsController(IPreserService presets) => _presets = presets;

        [HttpGet]
        public async Task<IActionResult> List(
            [FromQuery] string? search,
            [FromQuery] string? outcome,
            [FromQuery] int page = 1,
            CancellationToken ct = default)
        {
            var items = await _presets.GetPublicAsync(search, outcome, page, 20, ct);
            return Ok(items);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id, CancellationToken ct)
        {
            var dto = await _presets.GetByIdAsync(id, ct);
            return dto is null ? NotFound() : Ok(dto);
        }

        [HttpGet("{id:int}/preview")]
        public async Task<IActionResult> Preview(int id, CancellationToken ct)
        {
            var path = await _presets.GetPreviewImagePathAsync(id, ct);
            return path is null ? NotFound() : PhysicalFile(path, "image/png");
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Create(
            [FromBody] CreatePresetDto dto,
            CancellationToken ct)
        {
            var userId = GetCurrentUserId();
            if (userId is null) return Unauthorized();

            try
            {
                var created = await _presets.CreateAsync(dto, userId.Value, ct);
                return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var userId = GetCurrentUserId();
            if (userId is null) return Unauthorized();

            var ok = await _presets.DeleteAsync(id, userId.Value, ct);
            return ok ? NoContent() : NotFound();
        }

        private int? GetCurrentUserId()
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(raw, out var id) ? id : null;
        }
    }
}