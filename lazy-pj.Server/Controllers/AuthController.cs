using lazy_pj.Server.Interfaces;
using lazy_pj.Server.Models;
using Microsoft.AspNetCore.Mvc;

namespace lazy_pj.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuth _authService;

        public AuthController(IAuth authService) => _authService = authService;

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] UserModel user)
        {
            try
            {
                var result = await _authService.RegisterUserAsync(user);
                return result
                    ? Ok(new { message = "Registration successful!" })
                    : BadRequest(new { message = "Registration failed" });
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] UserModel user)
        {
            try
            {
                var result = await _authService.LoginUserAsync(user);
                if (result is null)
                    return Unauthorized(new { message = "Invalid credentials" });

                return Ok(new { token = result.Token, role = result.Role });
            }
            catch (Exception ex) { return Unauthorized(new { message = ex.Message }); }
        }

        [HttpPut("edit")]
        public async Task<IActionResult> Edit([FromBody] UserModel user)
        {
            try
            {
                var result = await _authService.EditUserAsync(user);
                return result
                    ? Ok(new { message = "User updated successfully!" })
                    : BadRequest(new { message = "Update failed" });
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpDelete("delete/{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _authService.DeleteUserAsync(id);
                return result
                    ? Ok(new { message = "User deleted successfully!" })
                    : BadRequest(new { message = "Delete failed" });
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }
    }
}