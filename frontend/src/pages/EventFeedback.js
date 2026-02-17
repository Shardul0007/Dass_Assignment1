import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

function EventFeedback() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterRating, setFilterRating] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ev = await api_requests(`api/events/${id}`, "GET");
        setEvent(ev);
        const fb = await api_requests(
          `api/organizer/event/${id}/feedback`,
          "GET",
        );
        setFeedback(fb);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const renderStars = (rating) => {
    return (
      <span className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`star ${star <= rating ? "filled" : ""}`}>
            ★
          </span>
        ))}
      </span>
    );
  };

  const filteredFeedbacks =
    feedback?.feedbacks?.filter((f) => {
      if (filterRating === "all") return true;
      return f.rating === Number(filterRating);
    }) || [];

  if (loading)
    return (
      <div className="container">
        <Navbar />
        <p className="loading">Loading...</p>
      </div>
    );
  if (error)
    return (
      <div className="container">
        <Navbar />
        <p className="alert alert-error">{error}</p>
      </div>
    );

  return (
    <div className="container">
      <Navbar />

      <h1>Feedback - {event?.name}</h1>

      {/* Summary Stats */}
      <div className="card">
        <h3>Feedback Summary</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{feedback?.totalFeedback || 0}</div>
            <div className="stat-label">Total Responses</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "#fbbf24" }}>
              {feedback?.averageRating || 0} ★
            </div>
            <div className="stat-label">Average Rating</div>
          </div>
        </div>

        {/* Rating Distribution */}
        <h4>Rating Distribution</h4>
        <div style={{ maxWidth: 400 }}>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = feedback?.ratingDistribution?.[rating] || 0;
            const total = feedback?.totalFeedback || 1;
            const percentage = Math.round((count / total) * 100);

            return (
              <div
                key={rating}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ width: 30 }}>{rating}★</span>
                <div
                  style={{
                    flex: 1,
                    height: 20,
                    background: "var(--bg-tertiary)",
                    borderRadius: "var(--radius)",
                    marginRight: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: "100%",
                      background:
                        rating >= 4
                          ? "var(--success)"
                          : rating >= 3
                            ? "var(--warning)"
                            : "var(--error)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span style={{ width: 60, textAlign: "right" }}>
                  {count} ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div
          className="flex justify-between items-center"
          style={{ marginBottom: 16 }}
        >
          <h3 style={{ margin: 0 }}>Individual Feedback (Anonymous)</h3>
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>

        {filteredFeedbacks.length === 0 ? (
          <div className="empty-state">No feedback yet.</div>
        ) : (
          <ul>
            {filteredFeedbacks.map((fb, idx) => (
              <li key={idx}>
                <div
                  className="flex justify-between items-center"
                  style={{ marginBottom: 8 }}
                >
                  {renderStars(fb.rating)}
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {new Date(fb.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {fb.comment ? (
                  <p
                    style={{
                      margin: 0,
                      fontStyle: "italic",
                      color: "var(--text-secondary)",
                    }}
                  >
                    "{fb.comment}"
                  </p>
                ) : (
                  <p className="text-muted" style={{ margin: 0 }}>
                    No comment provided
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default EventFeedback;
