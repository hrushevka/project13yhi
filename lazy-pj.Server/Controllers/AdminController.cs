using lazy_pj.Server.Interfaces;
using lazy_pj.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace lazy_pj.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = UserRoles.Admin)]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _adminService;

        public AdminController(IAdminService adminService) => _adminService = adminService;

        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers() =>
            Ok(await _adminService.GetAllUsersAsync());

        [HttpGet("users/{id:int}")]
        public async Task<IActionResult> GetUser(int id)
        {
            var user = await _adminService.GetUserAsync(id);
            return user is null
                ? NotFound(new { message = "User not found" })
                : Ok(user);
        }

        [HttpGet("admins")]
        public async Task<IActionResult> GetAllAdmins() =>
            Ok(await _adminService.GetAllAdminsAsync());

        [HttpDelete("users/{id:int}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            try
            {
                await _adminService.DeleteUserAsync(id);
                return Ok(new { message = "User deleted" });
            }
            catch (InvalidOperationException ex) { return NotFound(new { message = ex.Message }); }
        }

        [HttpPost("users/{id:int}/promote")]
        public async Task<IActionResult> Promote(int id)
        {
            try
            {
                await _adminService.SetUserAdminAsync(id);
                return Ok(new { message = "User promoted to admin" });
            }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        }

        [HttpPost("users/{id:int}/demote")]
        public async Task<IActionResult> Demote(int id)
        {
            try
            {
                await _adminService.RemoveUserAdminAsync(id);
                return Ok(new { message = "Admin demoted to user" });
            }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        }

        [HttpGet("users/{id:int}/role")]
        public async Task<IActionResult> GetRole(int id)
        {
            try
            {
                var role = await _adminService.GetUserRoleAsync(id);
                return Ok(new { role });
            }
            catch (InvalidOperationException ex) { return NotFound(new { message = ex.Message }); }
        }
    }
}