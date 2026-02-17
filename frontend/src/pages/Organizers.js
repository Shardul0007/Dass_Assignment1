import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";
import { preferencesStorage } from "../services/storage";

function Organizers() {
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

  const organizers = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const o = e.created_by;
      if (o && o._id && !map.has(o._id)) {
        map.set(o._id, o);
      }
    }
    return Array.from(map.values());
  }, [events]);

  const toggleFollow = async (organizerId) => {
    const role = localStorage.getItem("role");
    if (role !== "participant") return;

    const next = new Set(followed);
    if (next.has(organizerId)) next.delete(organizerId);
    else next.add(organizerId);

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

  return (
    <div>
      <Navbar />
      <h2>Clubs / Organizers</h2>
      {organizers.length === 0 ? (
        <p>No organizers available.</p>
      ) : (
        <ul>
          {organizers.map((o) => (
            <li
              key={o._id}
              style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}
            >
              <p>
                <strong>Name:</strong>{" "}
                <Link to={`/organizers/${o._id}`}>{o.organizer_name}</Link>
              </p>
              <p>
                <strong>Category:</strong> {o.category}
              </p>
              <p>
                <strong>Description:</strong> {o.description}
              </p>
              <p>
                <strong>Contact:</strong> {o.contact_email}
              </p>

              <button onClick={() => toggleFollow(o._id)}>
                {followed.has(o._id) ? "Unfollow" : "Follow"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Organizers;
