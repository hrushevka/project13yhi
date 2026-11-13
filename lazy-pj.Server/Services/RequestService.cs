using Azure.Core;
using lazy_pj.Server.Data;
using lazy_pj.Server.Interfaces;
using lazy_pj.Server.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure.Internal;
using Microsoft.Identity.Client;

namespace lazy_pj.Server.Services
{
    public class RequestService : IRequest
    {
        private readonly AppDbContext _context;

        public RequestService(AppDbContext context)
        {
            _context = context;
        }
        public async Task<AdminRequestModel> CreateRequestAsync(UserModel user, string description) 
        {
            AdminRequestModel request = new AdminRequestModel {
             UserId = user.Id,
             UserEmail = user.Email,
             CreationTime = DateTime.UtcNow,
             Description = description};
            _context.Requests.Add(request);
            await _context.SaveChangesAsync();
            return (request);
            
        }
        public async Task AcceptRequestAsync(int id)
            => await SetStatusAsync(id, RequestStatusModel.Approved);

        public async Task DenyRequestAsync(int id)
            => await SetStatusAsync(id, RequestStatusModel.Denied);

        private async Task SetStatusAsync(int id, int status)
        {
            var currentRequest = await _context.Requests.FirstOrDefaultAsync(x => x.Id == id)
                ?? throw new KeyNotFoundException($"Request w/ id={id} not found!");

            if (currentRequest.Approved != RequestStatusModel.Pending)
                throw new InvalidOperationException("Request already sorted!");

            if (status == RequestStatusModel.Approved)
            {
                var userId = currentRequest.UserId;
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                user.Role = UserRoles.Admin;
            }

            currentRequest.Approved = status;        
            await _context.SaveChangesAsync();
        }
    }
}
