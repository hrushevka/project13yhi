using lazy_pj.Server.Models;

namespace lazy_pj.Server.Interfaces
{
    public interface IRequest
    {
        Task<AdminRequestModel> CreateRequestAsync(UserModel user, string Description);
        Task AcceptRequestAsync(int id);
        Task DenyRequestAsync(int  id);
    }
}
