using lazy_pj.Server.DTOs;
using lazy_pj.Server.Interfaces;
using lazy_pj.Server.Models;
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

            if (User.Identity?.IsAuthenticated == true)
            {
                var uid = GetCurrentUserId();
                var isAdmin = User.IsInRole(UserRoles.Admin);
                items = items.Select(i => i with
                {
                    CanEdit = isAdmin || GetAuthorId(i.Id) == uid
                }).ToList();
            }

            return Ok(items);
        }

        [Authorize]
        [HttpGet("mine")]
        public async Task<IActionResult> Mine(
            [FromQuery] int page = 1,
            CancellationToken ct = default)
        {
            var uid = GetCurrentUserId();
            if (uid is null) return Unauthorized();

            return Ok(await _presets.GetMineAsync(uid.Value, page, 20, ct));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id, CancellationToken ct)
        {
            var dto = await _presets.GetByIdAsync(id, ct);
            if (dto is null) return NotFound();

            var uid = GetCurrentUserId();
            var isAdmin = User.IsInRole(UserRoles.Admin);

            return Ok(dto with { CanEdit = isAdmin || dto.AuthorId == uid });
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
            var uid = GetCurrentUserId();
            if (uid is null) return Unauthorized();

            try
            {
                var created = await _presets.CreateAsync(dto, uid.Value, ct);
                return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
            }
            catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        }

        [Authorize]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(
            int id,
            [FromBody] UpdatePresetDto dto,
            CancellationToken ct)
        {
            var uid = GetCurrentUserId();
            if (uid is null) return Unauthorized();

            try
            {
                var updated = await _presets.UpdateAsync(
                    id, dto, uid.Value, User.IsInRole(UserRoles.Admin), ct);
                return updated is null ? NotFound() : Ok(updated);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        }

        [Authorize]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var uid = GetCurrentUserId();
            if (uid is null) return Unauthorized();

            try
            {
                var ok = await _presets.DeleteAsync(
                    id, uid.Value, User.IsInRole(UserRoles.Admin), ct);
                return ok ? NoContent() : NotFound();
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        private int? GetCurrentUserId()
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(raw, out var id) ? id : null;
        }

        private int? GetAuthorId(int presetId) => _authorCache.TryGetValue(presetId, out var v) ? v : null;
        private readonly Dictionary<int, int> _authorCache = new();
    }
}