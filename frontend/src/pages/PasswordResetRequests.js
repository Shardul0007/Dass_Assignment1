import { useEffect, useMemo, useState } from "react";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

function PasswordResetRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api_requests(
        "api/admin/password-reset-requests",
        "GET",
      );
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((r) => (r.status || "") === statusFilter);
  }, [requests, statusFilter]);

  const approve = async (id) => {
    if (
      !window.confirm("Approve this reset request and generate a new password?")
    )
      return;
    try {
      const res = await api_requests(
        `api/admin/password-reset-requests/${id}/approve`,
        "PATCH",
      );
      alert(
        res?.password
          ? `Approved. New password: ${res.password}`
          : "Approved and emailed.",
      );
      fetchRequests();
    } catch (err) {
      alert(err.message);
    }
  };

  const reject = async (id) => {
    if (!window.confirm("Reject this reset request?")) return;
    try {
      await api_requests(
        `api/admin/password-reset-requests/${id}/reject`,
        "PATCH",
      );
      alert("Rejected and emailed.");
      fetchRequests();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <Navbar />
      <h2>Password Reset Requests</h2>

      <div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>{" "}
        <button onClick={fetchRequests}>Refresh</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : filtered.length === 0 ? (
        <p>No requests.</p>
      ) : (
        <ul>
          {filtered.map((r) => (
            <li
              key={r._id}
              style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}
            >
              <p>
                <strong>Organizer:</strong>{" "}
                {r.organizer?.organizer_name || "N/A"} (
                {r.organizer?.email || ""})
              </p>
              <p>
                <strong>Status:</strong> {r.status}
              </p>
              {r.message && (
                <p>
                  <strong>Message:</strong> {r.message}
                </p>
              )}
              <p>
                <strong>Requested:</strong>{" "}
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
              </p>
              {r.status === "pending" && (
                <>
                  <button onClick={() => approve(r._id)}>Approve</button>{" "}
                  <button onClick={() => reject(r._id)}>Reject</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PasswordResetRequests;
