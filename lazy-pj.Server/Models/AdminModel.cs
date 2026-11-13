namespace lazy_pj.Server.Models
{
    public class AdminModel
    {
        public int Id { get; set; }
        public string? Name { get; set; }

        private string _email;
        required public string Email
        {
            get { return _email; }
            set
            {
                if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException("Email cannot be null or whitespace!");
                else _email = value;
            }
        }
        private string _password;
        required public string Password
        {
            get { return _password; }
            set
            {
                if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException("Password cannot be null or whitespace!");
                else _password = value;
            }

        }
    }
}
