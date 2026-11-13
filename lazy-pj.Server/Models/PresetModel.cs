namespace lazy_pj.Server.Models
{
    public class BodyModel
    {
        public double Mass { get; set; }
        public double PositionX { get; set; }
        public double PositionY { get; set; }
        public double VelocityX { get; set; }
        public double VelocityY { get; set; }
    }

    public class PresetModel
    {
        public int Id { get; set; }
        public int UserId { get; set; }

        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public List<BodyModel> Bodies { get; set; } = new();

        public double G { get; set; } = 1.0;
        public double Softening { get; set; } = 0.01;
        public double Dt { get; set; } = 0.001;

        public string? Outcome { get; set; }
        public bool IsPublic { get; set; } = true;
        public string? ImagePath { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
