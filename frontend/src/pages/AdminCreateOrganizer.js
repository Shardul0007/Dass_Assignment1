import { useEffect, useState } from "react";
import { api_requests } from "../services/api";
import Navbar from "../services/NavBar";

function AdminCreateOrganizer() {
  const [form, setForm] = useState({
    organizer_name: "",
    category: "",
    description: "",
    contact_email: "",
    email: "", // Login email for organizer
  });

  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createdCreds, setCreatedCreds] = useState(null);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const fetchOrganizers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api_requests("api/admin/organizers", "GET");
      setOrganizers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizers();
  }, []);

  const handleSubmit = async () => {
    try {
      setCreatedCreds(null);
      const res = await api_requests(
        "api/admin/create-organizer",
        "POST",
        form,
      );
      alert("Organizer created successfully");

      // If backend returns credentials, show them.
      // If it doesn't, we can still refresh the organizer list to show the generated email.
      if (res && (res.email || res.password)) {
        setCreatedCreds({ email: res.email, password: res.password });
      }

      setForm({
        organizer_name: "",
        category: "",
        description: "",
        contact_email: "",
        email: "",
      });
      fetchOrganizers();
    } catch (err) {
      alert(err.message);
    }
  };

  const setDisabled = async (id, disabled) => {
    const action = disabled ? "disable" : "enable";
    if (
      !window.confirm(
        `${disabled ? "Disable" : "Enable"} this organizer account?`,
      )
    )
      return;

    try {
      await api_requests(`api/admin/${action}-organizer/${id}`, "PATCH");
      fetchOrganizers();
    } catch (err) {
      alert(err.message);
    }
  };

  const archiveOrganizer = async (id) => {
    if (!window.confirm("Archive this organizer? (This will disable login.)")) {
      return;
    }
    try {
      await api_requests(`api/admin/archive-organizer/${id}`, "PATCH");
      fetchOrganizers();
    } catch (err) {
      alert(err.message);
    }
  };

  const restoreOrganizer = async (id) => {
    if (!window.confirm("Restore this organizer?")) return;
    try {
      await api_requests(`api/admin/restore-organizer/${id}`, "PATCH");
      fetchOrganizers();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteOrganizer = async (id) => {
    if (
      !window.confirm(
        "Permanently delete this organizer? This will delete their events, registrations, and tickets.",
      )
    ) {
      return;
    }
    try {
      await api_requests(`api/admin/delete-organizer/${id}`, "DELETE");
      fetchOrganizers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <Navbar />
      <h2>Manage Clubs/Organizers</h2>

      <p>
        Create organizer accounts. Enter the organizer's real email address -
        they will receive their login credentials automatically.
      </p>

      <input
        name="organizer_name"
        placeholder="Organizer/Club Name"
        value={form.organizer_name}
        onChange={handleChange}
      />
      <input
        name="email"
        placeholder="Login Email (organizer's real email)"
        value={form.email}
        onChange={handleChange}
        type="email"
      />
      <input
        name="category"
        placeholder="Category"
        value={form.category}
        onChange={handleChange}
      />
      <input
        name="contact_email"
        placeholder="Contact Email (public)"
        value={form.contact_email}
        onChange={handleChange}
      />
      <textarea
        name="description"
        placeholder="Description"
        value={form.description}
        onChange={handleChange}
      />

      <button onClick={handleSubmit}>Create Organizer</button>

      {createdCreds && (
        <div
          style={{
            border: "1px solid #16a34a",
            background: "#f0fdf4",
            padding: 12,
            marginTop: 12,
            borderRadius: 8,
          }}
        >
          <h3 style={{ color: "#16a34a" }}>✓ Organizer Created Successfully</h3>
          <p>Credentials have been emailed to the organizer.</p>
          {createdCreds.email && (
            <p>
              <strong>Login Email:</strong> {createdCreds.email}
            </p>
          )}
          {createdCreds.password && (
            <p>
              <strong>Generated Password:</strong> {createdCreds.password}
            </p>
          )}
        </div>
      )}

      <hr />

      <h3>All Organizers</h3>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : organizers.length === 0 ? (
        <p>No organizers found.</p>
      ) : (
        <ul>
          {organizers.map((o) => (
            <li
              key={o._id}
              style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}
            >
              <p>
                <strong>Name:</strong> {o.organizer_name}
              </p>
              <p>
                <strong>Email:</strong> {o.email}
              </p>
              <p>
                <strong>Category:</strong> {o.category}
              </p>
              <p>
                <strong>Disabled:</strong> {String(!!o.is_disabled)}
              </p>
              <p>
                <strong>Archived:</strong> {String(!!o.is_archived)}
                {o.archived_at
                  ? ` (at ${new Date(o.archived_at).toLocaleString()})`
                  : ""}
              </p>

              {o.is_archived ? (
                <button onClick={() => restoreOrganizer(o._id)}>Restore</button>
              ) : (
                <>
                  {o.is_disabled ? (
                    <button onClick={() => setDisabled(o._id, false)}>
                      Enable
                    </button>
                  ) : (
                    <button onClick={() => setDisabled(o._id, true)}>
                      Disable
                    </button>
                  )}
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => archiveOrganizer(o._id)}
                  >
                    Archive
                  </button>
                </>
              )}

              <button
                style={{ marginLeft: 8 }}
                onClick={() => deleteOrganizer(o._id)}
              >
                Delete Permanently
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AdminCreateOrganizer;
