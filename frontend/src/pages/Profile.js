import { useEffect, useMemo, useState } from "react";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";
import { preferencesStorage, uniqueStrings } from "../services/storage";

function Profile() {
  const email = localStorage.getItem("email") || "";
  const role = localStorage.getItem("role") || "";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(role === "participant");
  const [error, setError] = useState("");

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    contact_number: "",
    organisation_name: "",
    participant_type: "",
  });

  const [organizerProfile, setOrganizerProfile] = useState({
    organizer_name: "",
    category: "",
    description: "",
    contact_email: "",
    contact_number: "",
    discord_webhook_url: "",
  });

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  const [selectedInterests, setSelectedInterests] = useState(() => {
    const interests = preferencesStorage.getInterests();
    return new Set(Array.isArray(interests) ? interests : []);
  });
  const [followed, setFollowed] = useState(() => {
    const ids = preferencesStorage.getFollowedOrganizers();
    return new Set(Array.isArray(ids) ? ids : []);
  });

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    const run = async () => {
      try {
        const res = await api_requests("api/users/me", "GET");
        const user = res?.user;
        if (!user) return;

        if (role === "participant") {
          setProfile({
            first_name: user.first_name || "",
            last_name: user.last_name || "",
            contact_number: user.contact_number || "",
            organisation_name: user.organisation_name || "",
            participant_type: user.participant_type || "",
          });
        }
        if (role === "organizer") {
          setOrganizerProfile({
            organizer_name: user.organizer_name || "",
            category: user.category || "",
            description: user.description || "",
            contact_email: user.contact_email || "",
            contact_number: user.contact_number || "",
            discord_webhook_url: user.discord_webhook_url || "",
          });
        }

        const interests = Array.isArray(user.interests) ? user.interests : [];
        const followedIds = Array.isArray(user.followed_organizers)
          ? user.followed_organizers
              .map((x) => (typeof x === "string" ? x : x?._id))
              .filter(Boolean)
          : [];

        preferencesStorage.setInterests(interests);
        preferencesStorage.setFollowedOrganizers(followedIds);
        setSelectedInterests(new Set(interests));
        setFollowed(new Set(followedIds));
      } catch {
        // ignore; UI can still function with cached localStorage
      }
    };
    run();
  }, [role]);

  const saveParticipantProfile = async () => {
    try {
      const res = await api_requests("api/users/profile", "PUT", {
        first_name: profile.first_name,
        last_name: profile.last_name,
        contact_number: profile.contact_number,
        organisation_name: profile.organisation_name,
      });
      alert(res?.message || "Profile updated");
    } catch (err) {
      alert(err.message);
    }
  };

  const changeParticipantPassword = async () => {
    try {
      const res = await api_requests("api/users/change-password", "POST", pw);
      alert(res?.message || "Password updated");
      setPw({ currentPassword: "", newPassword: "" });
    } catch (err) {
      alert(err.message);
    }
  };

  const saveOrganizerProfile = async () => {
    try {
      const res = await api_requests(
        "api/organizer/profile",
        "PUT",
        organizerProfile,
      );
      alert(res?.message || "Profile updated");
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (role !== "participant") return;
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
  }, [role]);

  const organizers = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const o = e.created_by;
      if (o && o._id && !map.has(o._id)) map.set(o._id, o);
    }
    return Array.from(map.values());
  }, [events]);

  const interestOptions = useMemo(() => {
    const tags = [];
    for (const e of events) {
      for (const t of e?.event_tags || []) tags.push(t);
    }
    return uniqueStrings(tags).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const savePreferences = async () => {
    try {
      const interestsArr = Array.from(selectedInterests);
      const followedArr = Array.from(followed);

      await api_requests("api/users/preferences", "PUT", {
        interests: interestsArr,
        followed_organizers: followedArr,
      });

      localStorage.setItem("interests", JSON.stringify(interestsArr));
      localStorage.setItem("followed_organizers", JSON.stringify(followedArr));
      alert("Preferences updated");
    } catch (err) {
      alert(err.message);
    }
  };

  const [resetMessage, setResetMessage] = useState("");
  const requestOrganizerPasswordReset = async () => {
    try {
      await api_requests("api/organizer/password-reset-request", "POST", {
        message: resetMessage,
      });
      setResetMessage("");
      alert("Password reset request sent to admin.");
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleInterest = (tag) => {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const toggleFollowed = (id) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <Navbar />
      <h2>Profile</h2>
      <p>
        <strong>Email:</strong> {email}
      </p>
      <p>
        <strong>Role:</strong> {role}
      </p>

      {role === "participant" && (
        <>
          <h3>Personal Details</h3>
          <p>
            <strong>Participant Type:</strong> {profile.participant_type || ""}
          </p>
          <input
            placeholder="First Name"
            value={profile.first_name}
            onChange={(e) =>
              setProfile((p) => ({ ...p, first_name: e.target.value }))
            }
          />
          <input
            placeholder="Last Name"
            value={profile.last_name}
            onChange={(e) =>
              setProfile((p) => ({ ...p, last_name: e.target.value }))
            }
          />
          <input
            placeholder="Contact Number"
            value={profile.contact_number}
            onChange={(e) =>
              setProfile((p) => ({ ...p, contact_number: e.target.value }))
            }
          />
          <input
            placeholder="College / Organization"
            value={profile.organisation_name}
            onChange={(e) =>
              setProfile((p) => ({ ...p, organisation_name: e.target.value }))
            }
          />
          <button onClick={saveParticipantProfile}>Save Profile</button>

          <h3>Security</h3>
          <input
            type="password"
            placeholder="Current password"
            value={pw.currentPassword}
            onChange={(e) =>
              setPw((p) => ({ ...p, currentPassword: e.target.value }))
            }
          />
          <input
            type="password"
            placeholder="New password"
            value={pw.newPassword}
            onChange={(e) =>
              setPw((p) => ({ ...p, newPassword: e.target.value }))
            }
          />
          <button onClick={changeParticipantPassword}>Change Password</button>

          <h3>Preferences</h3>
          {loading ? (
            <p>Loading preference options...</p>
          ) : error ? (
            <p style={{ color: "red" }}>{error}</p>
          ) : (
            <>
              <div
                style={{
                  border: "1px solid #ddd",
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <p>
                  <strong>Areas of Interest</strong> (select any)
                </p>
                {interestOptions.length === 0 ? (
                  <p>
                    No tags available yet. Create/publish events with tags
                    first.
                  </p>
                ) : (
                  <div>
                    {interestOptions.map((tag) => (
                      <label key={tag} style={{ display: "block" }}>
                        <input
                          type="checkbox"
                          checked={selectedInterests.has(tag)}
                          onChange={() => toggleInterest(tag)}
                        />{" "}
                        {tag}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  border: "1px solid #ddd",
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <p>
                  <strong>Clubs / Organizers to Follow</strong>
                </p>
                {organizers.length === 0 ? (
                  <p>No organizers available yet.</p>
                ) : (
                  <div>
                    {organizers.map((o) => (
                      <label key={o._id} style={{ display: "block" }}>
                        <input
                          type="checkbox"
                          checked={followed.has(o._id)}
                          onChange={() => toggleFollowed(o._id)}
                        />{" "}
                        {o.organizer_name} ({o.category})
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={savePreferences}>Save Preferences</button>
            </>
          )}
        </>
      )}

      {role === "organizer" && (
        <>
          <h3>Organizer Profile</h3>
          <input
            placeholder="Organizer Name"
            value={organizerProfile.organizer_name}
            onChange={(e) =>
              setOrganizerProfile((p) => ({
                ...p,
                organizer_name: e.target.value,
              }))
            }
          />
          <input
            placeholder="Category"
            value={organizerProfile.category}
            onChange={(e) =>
              setOrganizerProfile((p) => ({ ...p, category: e.target.value }))
            }
          />
          <textarea
            placeholder="Description"
            value={organizerProfile.description}
            onChange={(e) =>
              setOrganizerProfile((p) => ({
                ...p,
                description: e.target.value,
              }))
            }
          />
          <input
            placeholder="Contact Email"
            value={organizerProfile.contact_email}
            onChange={(e) =>
              setOrganizerProfile((p) => ({
                ...p,
                contact_email: e.target.value,
              }))
            }
          />
          <input
            placeholder="Contact Number"
            value={organizerProfile.contact_number}
            onChange={(e) =>
              setOrganizerProfile((p) => ({
                ...p,
                contact_number: e.target.value,
              }))
            }
          />
          <input
            placeholder="Discord Webhook URL"
            value={organizerProfile.discord_webhook_url}
            onChange={(e) =>
              setOrganizerProfile((p) => ({
                ...p,
                discord_webhook_url: e.target.value,
              }))
            }
          />
          <button onClick={saveOrganizerProfile}>Save Organizer Profile</button>

          <h3>Security</h3>
          <p>Request a password reset from Admin.</p>
          <input
            placeholder="Optional message to admin"
            value={resetMessage}
            onChange={(e) => setResetMessage(e.target.value)}
          />
          <button onClick={requestOrganizerPasswordReset}>Send Request</button>
        </>
      )}
    </div>
  );
}

export default Profile;
