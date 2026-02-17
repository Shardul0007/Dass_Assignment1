import { useEffect, useState } from "react";
import Navbar from "../services/NavBar";
import { Link } from "react-router-dom";
import { api_requests } from "../services/api";

function OrganizerDashboard() {
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const e = await api_requests("api/organizer/my-events", "GET");
        setEvents(Array.isArray(e) ? e : []);
        const a = await api_requests("api/organizer/analytics", "GET");
        setAnalytics(a || null);
      } catch (err) {
        setError(err.message);
      }
    };
    run();
  }, []);

  return (
    <div>
      <Navbar />
      <h2>Organizer Dashboard</h2>

      <ul>
        <li>
          <Link to="/organizer/my-events">Ongoing Events</Link>
        </li>
        <li>
          <Link to="/organizer/create-event">Create Event</Link>
        </li>
        <li>
          <Link to="/profile">Profile</Link>
        </li>
      </ul>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>My Events</h3>
      {events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
          {events.map((e) => (
            <div
              key={e._id}
              style={{ border: "1px solid #ddd", padding: 12, minWidth: 240 }}
            >
              <h4>{e.name}</h4>
              <p>
                <strong>Type:</strong> {e.event_type}
              </p>
              <p>
                <strong>Status:</strong> {e.status}
              </p>
              <p>
                <Link to={`/events/${e._id}`}>View</Link> |{" "}
                <Link to={`/organizer/event/${e._id}/registrations`}>
                  Manage
                </Link>
              </p>
            </div>
          ))}
        </div>
      )}

      {analytics && (
        <>
          <h3>Completed Event Analytics</h3>
          <p>
            <strong>Total revenue:</strong> {analytics.totals?.revenue || 0} |{" "}
            <strong>Paid:</strong> {analytics.totals?.paid || 0} |{" "}
            <strong>Attendance:</strong> {analytics.totals?.attendance || 0}
          </p>

          {(analytics.completed || []).length === 0 ? (
            <p>No completed events yet.</p>
          ) : (
            <ul>
              {analytics.completed.map((x) => (
                <li key={x.eventId}>
                  {x.name}: regs={x.registrations}, paid={x.paid}, revenue=
                  {x.revenue}, attendance={x.attendance}
                  {x.team && x.team.teams_total > 0
                    ? `, teams complete=${x.team.teams_complete}/${x.team.teams_total}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default OrganizerDashboard;
