import { useEffect, useState } from "react";
import { api_requests } from "../services/api";
import Navbar from "../services/NavBar";
import { Link } from "react-router-dom";

function OrganizerMyEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    registration_limit: "",
    registration_fee: "",
    eligibility: "All",
    event_tags: "",
    item_sizes: "",
    item_colors: "",
    item_stock: "",
    item_purchase_limit: "",
  });

  const [customForm, setCustomForm] = useState([]);
  const [publishedEditingId, setPublishedEditingId] = useState(null);
  const [publishedForm, setPublishedForm] = useState({
    description: "",
    registration_deadline: "",
    registration_limit: "",
  });

  const fetchMyEvents = async () => {
    try {
      setLoading(true);
      const data = await api_requests(
        "api/organizer/my-events",
        "GET",
        null,
        true, // send JWT
      );
      setEvents(data);
    } catch (err) {
      setError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (event) => {
    setEditingId(event._id);
    setEditForm({
      name: event.name || "",
      description: event.description || "",
      start_date: event.start_date
        ? new Date(event.start_date).toISOString().slice(0, 16)
        : "",
      end_date: event.end_date
        ? new Date(event.end_date).toISOString().slice(0, 16)
        : "",
      registration_deadline: event.registration_deadline
        ? new Date(event.registration_deadline).toISOString().slice(0, 16)
        : "",
      registration_limit: event.registration_limit ?? "",
      registration_fee: event.registration_fee ?? "",
      eligibility: event.eligibility || "All",
      event_tags: Array.isArray(event.event_tags)
        ? event.event_tags.join(", ")
        : "",
      item_sizes: Array.isArray(event.item_details?.sizes)
        ? event.item_details.sizes.join(", ")
        : "",
      item_colors: Array.isArray(event.item_details?.colors)
        ? event.item_details.colors.join(", ")
        : "",
      item_stock: event.item_details?.stock ?? "",
      item_purchase_limit: event.item_details?.purchase_limit ?? "",
    });

    setCustomForm(Array.isArray(event.custom_form) ? event.custom_form : []);
  };

  const saveEdit = async () => {
    try {
      const isMerch =
        (events.find((e) => e._id === editingId)?.event_type || "") ===
        "Merchandise";
      await api_requests(`api/organizer/event/${editingId}/draft`, "PATCH", {
        name: editForm.name,
        description: editForm.description,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        registration_deadline: editForm.registration_deadline,
        registration_limit: Number(editForm.registration_limit),
        registration_fee: Number(editForm.registration_fee),
        eligibility: editForm.eligibility,
        event_tags: editForm.event_tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...(isMerch
          ? {
              item_details: {
                sizes: editForm.item_sizes
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                colors: editForm.item_colors
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                stock: Number(editForm.item_stock),
                purchase_limit: Number(editForm.item_purchase_limit),
              },
            }
          : {}),
      });
      setEditingId(null);
      fetchMyEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  const startPublishedEdit = (event) => {
    setPublishedEditingId(event._id);
    setPublishedForm({
      description: event.description || "",
      registration_deadline: event.registration_deadline
        ? new Date(event.registration_deadline).toISOString().slice(0, 16)
        : "",
      registration_limit: event.registration_limit ?? "",
    });
  };

  const savePublishedEdit = async () => {
    try {
      await api_requests(
        `api/organizer/event/${publishedEditingId}/published-update`,
        "PATCH",
        {
          description: publishedForm.description,
          registration_deadline: publishedForm.registration_deadline,
          registration_limit: Number(publishedForm.registration_limit),
        },
      );
      setPublishedEditingId(null);
      fetchMyEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  const saveCustomForm = async () => {
    try {
      await api_requests(
        `api/organizer/event/${editingId}/custom-form`,
        "PUT",
        {
          custom_form: customForm.map((f, idx) => ({
            field_id: f.field_id || `f${idx + 1}`,
            label: f.label,
            type: f.type,
            required: !!f.required,
            options:
              typeof f.options === "string"
                ? f.options
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                : Array.isArray(f.options)
                  ? f.options
                  : [],
          })),
        },
      );
      alert("Custom form saved");
      fetchMyEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  const publishEvent = async (id) => {
    try {
      await api_requests(
        `api/organizer/event/${id}/publish`,
        "PATCH",
        null,
        true,
      );
      fetchMyEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  const markOngoing = async (id) => {
    try {
      await api_requests(
        `api/organizer/event/${id}/ongoing`,
        "PATCH",
        null,
        true,
      );
      fetchMyEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  const closeEvent = async (id) => {
    try {
      await api_requests(
        `api/organizer/event/${id}/close`,
        "PATCH",
        null,
        true,
      );
      fetchMyEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchMyEvents();
  }, []);

  if (loading) return <p>Loading events...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div>
      <Navbar />
      <h2>My Events</h2>

      {events.length === 0 && <p>No events created yet.</p>}

      {events.map((event) => (
        <div
          key={event._id}
          style={{
            border: "1px solid #ccc",
            padding: 12,
            marginBottom: 10,
          }}
        >
          <h3>{event.name}</h3>
          <p>
            <b>Status:</b> {event.status}
          </p>
          <p>
            <b>Start:</b> {new Date(event.start_date).toLocaleString()}
          </p>
          <p>
            <b>End:</b> {new Date(event.end_date).toLocaleString()}
          </p>

          <p>
            <Link to={`/organizer/event/${event._id}/registrations`}>
              View registrations
            </Link>
          </p>

          {event.status === "draft" && (
            <>
              <button onClick={() => publishEvent(event._id)}>Publish</button>{" "}
              <button onClick={() => startEdit(event)}>
                {editingId === event._id ? "Editing..." : "Edit Draft"}
              </button>
            </>
          )}

          {event.status === "published" && (
            <>
              <button onClick={() => markOngoing(event._id)}>
                Mark Ongoing
              </button>{" "}
              <button onClick={() => startPublishedEdit(event)}>
                Edit Published
              </button>
            </>
          )}

          {event.status === "ongoing" && (
            <button onClick={() => closeEvent(event._id)}>Close Event</button>
          )}

          {event.status === "draft" && editingId === event._id && (
            <div
              style={{
                borderTop: "1px solid #eee",
                marginTop: 10,
                paddingTop: 10,
              }}
            >
              <h4>Edit Draft</h4>
              <input
                value={editForm.name}
                placeholder="Name"
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
              />
              <textarea
                value={editForm.description}
                placeholder="Description"
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, description: e.target.value }))
                }
              />
              <input
                type="datetime-local"
                value={editForm.start_date}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, start_date: e.target.value }))
                }
              />
              <input
                type="datetime-local"
                value={editForm.end_date}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, end_date: e.target.value }))
                }
              />
              <input
                type="datetime-local"
                value={editForm.registration_deadline}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    registration_deadline: e.target.value,
                  }))
                }
              />
              <select
                value={editForm.eligibility}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, eligibility: e.target.value }))
                }
              >
                <option value="All">All</option>
                <option value="IIIT">IIIT Only</option>
              </select>
              <input
                value={editForm.registration_limit}
                placeholder="Registration Limit"
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    registration_limit: e.target.value,
                  }))
                }
              />
              <input
                value={editForm.registration_fee}
                placeholder="Registration Fee"
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    registration_fee: e.target.value,
                  }))
                }
              />
              <input
                value={editForm.event_tags}
                placeholder="Tags (comma separated)"
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, event_tags: e.target.value }))
                }
              />
              {event.event_type === "Merchandise" && (
                <>
                  <h4>Merchandise Details</h4>
                  <input
                    value={editForm.item_sizes}
                    placeholder="Sizes (comma separated)"
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, item_sizes: e.target.value }))
                    }
                  />
                  <input
                    value={editForm.item_colors}
                    placeholder="Colors (comma separated)"
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        item_colors: e.target.value,
                      }))
                    }
                  />
                  <input
                    value={editForm.item_stock}
                    placeholder="Stock"
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, item_stock: e.target.value }))
                    }
                  />
                  <input
                    value={editForm.item_purchase_limit}
                    placeholder="Purchase limit per participant"
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        item_purchase_limit: e.target.value,
                      }))
                    }
                  />
                </>
              )}

              {event.event_type === "Normal" && (
                <div
                  style={{
                    borderTop: "1px solid #eee",
                    marginTop: 10,
                    paddingTop: 10,
                  }}
                >
                  <h4>Custom Registration Form</h4>
                  {customForm.length === 0 ? <p>No custom fields.</p> : null}
                  {customForm.map((f, idx) => (
                    <div
                      key={f.field_id || idx}
                      style={{
                        border: "1px solid #ddd",
                        padding: 8,
                        marginBottom: 8,
                      }}
                    >
                      <input
                        placeholder="Label"
                        value={f.label || ""}
                        onChange={(e) =>
                          setCustomForm((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, label: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <select
                        value={f.type || "text"}
                        onChange={(e) =>
                          setCustomForm((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, type: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        <option value="text">text</option>
                        <option value="dropdown">dropdown</option>
                        <option value="checkbox">checkbox</option>
                        <option value="file">file</option>
                      </select>
                      <label>
                        <input
                          type="checkbox"
                          checked={!!f.required}
                          onChange={(e) =>
                            setCustomForm((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, required: e.target.checked }
                                  : x,
                              ),
                            )
                          }
                        />{" "}
                        Required
                      </label>
                      {String(f.type) === "dropdown" && (
                        <input
                          placeholder="Options (comma separated)"
                          value={
                            Array.isArray(f.options)
                              ? f.options.join(", ")
                              : f.options || ""
                          }
                          onChange={(e) =>
                            setCustomForm((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, options: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      )}
                      <div>
                        <button
                          onClick={() =>
                            setCustomForm((prev) => {
                              if (idx === 0) return prev;
                              const next = [...prev];
                              const t = next[idx - 1];
                              next[idx - 1] = next[idx];
                              next[idx] = t;
                              return next;
                            })
                          }
                        >
                          Up
                        </button>{" "}
                        <button
                          onClick={() =>
                            setCustomForm((prev) => {
                              if (idx === prev.length - 1) return prev;
                              const next = [...prev];
                              const t = next[idx + 1];
                              next[idx + 1] = next[idx];
                              next[idx] = t;
                              return next;
                            })
                          }
                        >
                          Down
                        </button>{" "}
                        <button
                          onClick={() =>
                            setCustomForm((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setCustomForm((prev) => [
                        ...prev,
                        {
                          field_id: `f${prev.length + 1}`,
                          label: "",
                          type: "text",
                          required: false,
                          options: [],
                        },
                      ])
                    }
                  >
                    Add Field
                  </button>{" "}
                  <button onClick={saveCustomForm}>Save Custom Form</button>
                </div>
              )}

              <div>
                <button onClick={saveEdit}>Save</button>{" "}
                <button onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </div>
          )}

          {event.status === "published" && publishedEditingId === event._id && (
            <div
              style={{
                borderTop: "1px solid #eee",
                marginTop: 10,
                paddingTop: 10,
              }}
            >
              <h4>Edit Published Event</h4>
              <textarea
                value={publishedForm.description}
                placeholder="Description"
                onChange={(e) =>
                  setPublishedForm((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
              />
              <input
                type="datetime-local"
                value={publishedForm.registration_deadline}
                onChange={(e) =>
                  setPublishedForm((p) => ({
                    ...p,
                    registration_deadline: e.target.value,
                  }))
                }
              />
              <input
                value={publishedForm.registration_limit}
                placeholder="Increase registration limit"
                onChange={(e) =>
                  setPublishedForm((p) => ({
                    ...p,
                    registration_limit: e.target.value,
                  }))
                }
              />
              <div>
                <button onClick={savePublishedEdit}>Save</button>{" "}
                <button onClick={() => setPublishedEditingId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default OrganizerMyEvents;
