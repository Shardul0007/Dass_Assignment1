import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";
import { preferencesStorage } from "../services/storage";

function OrganizerDetails() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [followed, setFollowed] = useState(() => {
    const ids = preferencesStorage.getFollowedOrganizers();
    return new Set(Array.isArray(ids) ? ids : []);
  });

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const data = await api_requests("api/events", "GET");
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const organizer = useMemo(() => {
    for (const e of events) {
      if (e?.created_by?._id === id) return e.created_by;
    }
    return null;
  }, [events, id]);

  const now = new Date();
  const organizerEvents = useMemo(
    () => events.filter((e) => e?.created_by?._id === id),
    [events, id],
  );

  const upcoming = organizerEvents.filter((e) => {
    const end = e?.end_date ? new Date(e.end_date) : null;
    if (end && !Number.isNaN(end.getTime())) return end >= now;
    const start = e?.start_date ? new Date(e.start_date) : null;
    if (start && !Number.isNaN(start.getTime())) return start >= now;
    return true;
  });

  const past = organizerEvents.filter((e) => {
    const end = e?.end_date ? new Date(e.end_date) : null;
    if (end && !Number.isNaN(end.getTime())) return end < now;
    const start = e?.start_date ? new Date(e.start_date) : null;
    if (start && !Number.isNaN(start.getTime())) return start < now;
    return false;
  });

  const isFollowed = followed.has(id);

  const toggleFollow = async () => {
    const role = localStorage.getItem("role");
    if (role !== "participant") return;

    const next = new Set(followed);
    if (next.has(id)) next.delete(id);
    else next.add(id);

    const ids = Array.from(next);

    try {
      await api_requests("api/users/preferences", "PUT", {
        interests: preferencesStorage.getInterests(),
        followed_organizers: ids,
      });
      preferencesStorage.setFollowedOrganizers(ids);
      setFollowed(next);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!organizer) return <p>Organizer not found.</p>;

  return (
    <div>
      <Navbar />
      <h2>{organizer.organizer_name}</h2>
      <p>
        <strong>Category:</strong> {organizer.category}
      </p>
      <p>
        <strong>Description:</strong> {organizer.description}
      </p>
      <p>
        <strong>Contact Email:</strong> {organizer.contact_email}
      </p>

      <button onClick={toggleFollow}>
        {isFollowed ? "Unfollow" : "Follow"}
      </button>

      <h3>Upcoming Events</h3>
      {upcoming.length === 0 ? (
        <p>No upcoming events.</p>
      ) : (
        <ul>
          {upcoming.map((e) => (
            <li
              key={e._id}
              style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}
            >
              <h4>
                <Link to={`/events/${e._id}`}>{e.name}</Link>
              </h4>
              <p>
                <strong>Type:</strong> {e.event_type}
              </p>
              <p>
                <strong>When:</strong> {new Date(e.start_date).toLocaleString()}{" "}
                to {new Date(e.end_date).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3>Past Events</h3>
      {past.length === 0 ? (
        <p>No past events.</p>
      ) : (
        <ul>
          {past.map((e) => (
            <li
              key={e._id}
              style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}
            >
              <h4>
                <Link to={`/events/${e._id}`}>{e.name}</Link>
              </h4>
              <p>
                <strong>Type:</strong> {e.event_type}
              </p>
              <p>
                <strong>When:</strong> {new Date(e.start_date).toLocaleString()}{" "}
                to {new Date(e.end_date).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default OrganizerDetails;
