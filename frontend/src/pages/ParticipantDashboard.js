import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

function ParticipantDashboard() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Normal");

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "participant") {
      setError("Unauthorized access");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        const data = await api_requests(
          "api/participant/my-registrations",
          "GET",
        );
        setRegistrations(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return registrations;

    return registrations.filter((r) => {
      const e = r.event || {};
      const name = String(e.name || "").toLowerCase();
      const ticket = String(r.ticketId || "").toLowerCase();
      const organizerName = String(
        e.created_by?.organizer_name || "",
      ).toLowerCase();
      return (
        name.includes(q) || ticket.includes(q) || organizerName.includes(q)
      );
    });
  }, [registrations, query]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return filtered.filter((r) => {
      if (String(r.status || "").toLowerCase() !== "registered") return false;
      const e = r.event || {};
      const end = e.end_date ? new Date(e.end_date) : null;
      if (end && !Number.isNaN(end.getTime())) return end >= now;
      const start = e.start_date ? new Date(e.start_date) : null;
      if (start && !Number.isNaN(start.getTime())) return start >= now;
      return true;
    });
  }, [filtered]);

  const history = useMemo(() => {
    const now = new Date();
    return filtered.filter((r) => {
      const status = String(r.status || "").toLowerCase();
      if (tab === "Normal") return (r.event?.event_type || "") === "Normal";
      if (tab === "Merchandise")
        return (r.event?.event_type || "") === "Merchandise";
      if (tab === "Completed") {
        const e = r.event || {};
        if (status === "cancelled" || status === "rejected") return false;
        if (status === "completed") return true;
        if (String(e.status || "").toLowerCase() === "closed") return true;
        const end = e.end_date ? new Date(e.end_date) : null;
        // fallback: treat past events with active registrations as completed
        return status === "registered" && end && !Number.isNaN(end.getTime())
          ? end < now
          : false;
      }
      if (tab === "Cancelled/Rejected") {
        return status === "cancelled" || status === "rejected";
      }
      return true;
    });
  }, [filtered, tab]);

  // Determine display status - show "completed" if event has ended
  const getDisplayStatus = (r) => {
    const e = r.event || {};
    const status = String(r.status || "").toLowerCase();
    if (status === "completed" || status === "cancelled" || status === "rejected" || status === "pending_approval") {
      return status;
    }
    // If event is closed or end_date passed, show as completed
    if (String(e.status || "").toLowerCase() === "closed") {
      return "completed";
    }
    const end = e.end_date ? new Date(e.end_date) : null;
    if (end && !Number.isNaN(end.getTime()) && end < new Date()) {
      return "completed";
    }
    return status;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "registered":
        return <span className="badge badge-success">Registered</span>;
      case "completed":
        return <span className="badge badge-primary">Completed</span>;
      case "cancelled":
        return <span className="badge badge-error">Cancelled</span>;
      case "rejected":
        return <span className="badge badge-error">Rejected</span>;
      case "pending_approval":
        return <span className="badge badge-warning">Pending Approval</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

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

  const renderRow = (r) => {
    const e = r.event || {};
    const organizer =
      e.created_by?.organizer_name ||
      (typeof e.created_by === "string" ? e.created_by : "N/A");

    return (
      <li key={r._id}>
        <div
          className="flex justify-between items-center"
          style={{ marginBottom: 8 }}
        >
          <h4 style={{ margin: 0 }}>
            <Link
              to={`/events/${e._id}`}
              style={{ color: "var(--text-primary)", textDecoration: "none" }}
            >
              {e.name || "(Unnamed event)"}
            </Link>
          </h4>
          {getStatusBadge(getDisplayStatus(r))}
        </div>

        <div className="form-row" style={{ marginBottom: 0 }}>
          <div>
            <p>
              <strong>Type:</strong> {e.event_type}
            </p>
            <p>
              <strong>Organizer:</strong> {organizer}
            </p>
          </div>
          <div>
            <p>
              <strong>Start:</strong>{" "}
              {e.start_date
                ? new Date(e.start_date).toLocaleDateString()
                : "N/A"}
            </p>
            <p>
              <strong>End:</strong>{" "}
              {e.end_date ? new Date(e.end_date).toLocaleDateString() : "N/A"}
            </p>
          </div>
          <div>
            <p>
              <strong>Payment:</strong>{" "}
              <span
                className={
                  r.payment_status === "paid" ? "text-success" : "text-warning"
                }
              >
                {r.payment_status}
              </span>
            </p>
            <p>
              <strong>Attendance:</strong>{" "}
              {r.attendance ? (
                <span className="text-success">Yes</span>
              ) : (
                <span className="text-muted">No</span>
              )}
            </p>
          </div>
        </div>

        {r.team_name && (
          <p>
            <strong>Team:</strong> {r.team_name}
          </p>
        )}

        {r.ticketId && (
          <p>
            <strong>Ticket:</strong>{" "}
            <Link
              to={`/tickets/${r.ticketId}`}
              style={{ color: "var(--primary)" }}
            >
              {r.ticketId}
            </Link>
          </p>
        )}

        {/* Show feedback link for completed events */}
        {getDisplayStatus(r) === "completed" && (
          <p>
            <Link
              to={`/events/${e._id}#feedback`}
              style={{ color: "var(--primary)", fontWeight: "bold" }}
            >
              Give Feedback
            </Link>
          </p>
        )}
      </li>
    );
  };

  return (
    <div className="container">
      <Navbar />

      <h1>My Events</h1>

      <div className="form-group">
        <input
          placeholder="Search by event name or ticket..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card">
        <h3>Upcoming Events</h3>
        {upcoming.length === 0 ? (
          <div className="empty-state">No upcoming events.</div>
        ) : (
          <ul>{upcoming.map(renderRow)}</ul>
        )}
      </div>

      <div className="card">
        <h3>Participation History</h3>
        <div className="tabs">
          <button
            className={`tab ${tab === "Normal" ? "active" : ""}`}
            onClick={() => setTab("Normal")}
          >
            Normal
          </button>
          <button
            className={`tab ${tab === "Merchandise" ? "active" : ""}`}
            onClick={() => setTab("Merchandise")}
          >
            Merchandise
          </button>
          <button
            className={`tab ${tab === "Completed" ? "active" : ""}`}
            onClick={() => setTab("Completed")}
          >
            Completed
          </button>
          <button
            className={`tab ${tab === "Cancelled/Rejected" ? "active" : ""}`}
            onClick={() => setTab("Cancelled/Rejected")}
          >
            Cancelled/Rejected
          </button>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">No records.</div>
        ) : (
          <ul>{history.map(renderRow)}</ul>
        )}
      </div>
    </div>
  );
}

export default ParticipantDashboard;
