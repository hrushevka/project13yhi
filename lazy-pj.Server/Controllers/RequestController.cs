using lazy_pj.Server.Data;
using lazy_pj.Server.DTOs;
using lazy_pj.Server.Interfaces;
using lazy_pj.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lazy_pj.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RequestController : ControllerBase
    {
        private readonly IRequest _requestService;
        private readonly AppDbContext _context;

        public RequestController(IRequest requestService, AppDbContext context)
        {
            _requestService = requestService;
            _context = context;
        }
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] CreateRequestDTO dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Description))
                return BadRequest("Description is required");

            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user is null)
                return Unauthorized();

            var request = await _requestService.CreateRequestAsync(user, dto.Description);
            return Ok(request);
        }
        [HttpPost("{id}/accept")]
        [Authorize(Roles = UserRoles.Admin)]
        public async Task<IActionResult> Accept(int id)
        {
            try
            {
                await _requestService.AcceptRequestAsync(id);
                return Ok();
            }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (InvalidOperationException ex) { return Conflict(ex.Message); }
        }
        [HttpPost("{id}/Deny")]
        [Authorize(Roles = UserRoles.Admin)]
        public async Task<IActionResult> Deny(int id)
        {
            try
            {
                await _requestService.DenyRequestAsync(id);
                return Ok();
            }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (InvalidOperationException ex) { return Conflict(ex.Message); }
        }

    }
}
