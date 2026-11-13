namespace lazy_pj.Server.Models
{
    public class AdminRequestModel
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserEmail {  get; set; }
               
        public DateTime CreationTime { get; set; }
        public string Description { get; set; } = string.Empty;
        public int Approved { get; set; } = 1;
    }
}
