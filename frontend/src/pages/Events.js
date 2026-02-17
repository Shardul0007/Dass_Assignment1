import React, { useEffect, useState } from "react";
import { api_requests } from "../services/api";
import Navbar from "../services/NavBar";
import { Link } from "react-router-dom";
import { preferencesStorage } from "../services/storage";

const fuzzyIncludes = (query, text) => {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  if (!q) return true;
  const t = String(text || "").toLowerCase();
  if (t.includes(q)) return true;

  // simple subsequence match as a lightweight fuzzy fallback
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i++;
    if (i >= q.length) return true;
  }
  return false;
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registeredIds, setRegisteredIds] = useState(new Set());
  const [trending, setTrending] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [eligibilityFilter, setEligibilityFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const role = localStorage.getItem("role");

  useEffect(() => {
    const currentRole = localStorage.getItem("role");
    const run = async () => {
      try {
        const data = await api_requests("api/events", "GET");
        setEvents(data || []);

        if (currentRole === "participant") {
          const my = await api_requests("api/participant/my-events", "GET");
          const ids = new Set((Array.isArray(my) ? my : []).map((e) => e._id));
          setRegisteredIds(ids);

          // Trending (Top 5/24h)
          try {
            const t = await api_requests(
              "api/participant/trending-events",
              "GET",
            );
            setTrending(Array.isArray(t) ? t : []);
          } catch {
            setTrending([]);
          }
        }
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const trendingEvents = trending
    .map((t) => {
      const event = events.find((e) => e._id === t._id);
      return event ? { event, count: t.count } : null;
    })
    .filter(Boolean);

  const filtered = events.filter((event) => {
    if (role === "participant" && registeredIds.has(event._id)) return false;
    const text =
      `${event.name || ""} ${event.created_by?.organizer_name || ""}`.toLowerCase();
    const matchesSearch = fuzzyIncludes(search, text);
    const matchesType =
      typeFilter === "All" ? true : event.event_type === typeFilter;
    const matchesEligibility =
      eligibilityFilter === "All"
        ? true
        : event.eligibility === eligibilityFilter;

    const followedIds = new Set(
      preferencesStorage.getFollowedOrganizers() || [],
    );
    const isFollowed = followedIds.has(event.created_by?._id);
    const matchesScope = scopeFilter === "All" ? true : isFollowed;

    const start = event.start_date ? new Date(event.start_date) : null;
    const fromOk = !fromDate
      ? true
      : start && !Number.isNaN(start.getTime())
        ? start >= new Date(fromDate)
        : false;
    const toOk = !toDate
      ? true
      : start && !Number.isNaN(start.getTime())
        ? start <= new Date(toDate)
        : false;

    return (
      matchesSearch &&
      matchesType &&
      matchesEligibility &&
      matchesScope &&
      fromOk &&
      toOk
    );
  });

  const ordered = [...filtered].sort((a, b) => {
    const followedIds = new Set(
      preferencesStorage.getFollowedOrganizers() || [],
    );
    const interests = new Set(preferencesStorage.getInterests() || []);

    const aFollowed = followedIds.has(a.created_by?._id) ? 1 : 0;
    const bFollowed = followedIds.has(b.created_by?._id) ? 1 : 0;
    if (aFollowed !== bFollowed) return bFollowed - aFollowed;

    const score = (e) => {
      const tags = Array.isArray(e.event_tags) ? e.event_tags : [];
      let s = 0;
      for (const t of tags) if (interests.has(t)) s += 1;
      return s;
    };
    const aScore = score(a);
    const bScore = score(b);
    if (aScore !== bScore) return bScore - aScore;

    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
    return aStart - bStart;
  });

  if (loading) {
    return <p>Loading...</p>;
  }
  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  return (
    <div>
      <Navbar />
      <h2>Available Events</h2>

      {role === "participant" && trendingEvents.length > 0 && (
        <div
          style={{ border: "1px solid #ddd", padding: 12, marginBottom: 12 }}
        >
          <h3>Trending (Top 5 / 24h)</h3>
          <ul>
            {trendingEvents.map(({ event, count }) => (
              <li key={event._id} style={{ marginBottom: 6 }}>
                <Link to={`/events/${event._id}`}>{event.name}</Link> — {count}{" "}
                registrations
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <input
          placeholder="Search events / organizers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="All">All Types</option>
          <option value="Normal">Normal</option>
          <option value="Merchandise">Merchandise</option>
        </select>
        <select
          value={eligibilityFilter}
          onChange={(e) => setEligibilityFilter(e.target.value)}
        >
          <option value="All">All Eligibility</option>
          <option value="IIIT">IIIT</option>
        </select>

        {role === "participant" && (
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option value="All">All events</option>
            <option value="Followed">Followed clubs</option>
          </select>
        )}

        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          title="From"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          title="To"
        />
      </div>

      {ordered.length === 0 ? (
        <p>No events found</p>
      ) : (
        <ul>
          {ordered.map((event) => (
            <li
              key={event._id}
              style={{
                border: "1px solid #ccc",
                marginBottom: "10px",
                padding: "10px",
              }}
            >
              <h3>
                <Link to={`/events/${event._id}`}>{event.name}</Link>
              </h3>
              <p>{event.description}</p>
              <p>Organizer: {event.created_by?.organizer_name || "N/A"}</p>
              <p>
                <strong>Fees: {event.registration_fee}</strong>
              </p>
              <p>Start Date: {new Date(event.start_date).toLocaleString()}</p>
              <p>End Date: {new Date(event.end_date).toLocaleString()}</p>
              {role === "participant" && (
                <Link to={`/events/${event._id}`}>View details</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Events;
