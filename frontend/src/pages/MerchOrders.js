import { useEffect, useState } from "react";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

function MerchOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("pending_approval");
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await api_requests("api/organizer/merch-orders", "GET");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (filter === "all") return true;
    return o.merch_payment_status === filter;
  });

  const handleApprove = async (orderId) => {
    if (
      !window.confirm(
        "Approve this payment? Stock will be decremented and ticket will be sent.",
      )
    )
      return;

    try {
      await api_requests(
        `api/organizer/merch-order/${orderId}/approve`,
        "PATCH",
      );
      alert("Order approved. Ticket sent to participant.");
      fetchOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReject = async (orderId) => {
    const reason = prompt("Enter rejection reason:");
    if (reason === null) return;

    try {
      await api_requests(
        `api/organizer/merch-order/${orderId}/reject`,
        "PATCH",
        { reason },
      );
      alert("Order rejected.");
      fetchOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending_approval":
        return <span className="badge badge-warning">Pending</span>;
      case "approved":
        return <span className="badge badge-success">Approved</span>;
      case "rejected":
        return <span className="badge badge-error">Rejected</span>;
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

  return (
    <div className="container">
      <Navbar />

      <h1>Merchandise Payment Approvals</h1>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">
            {
              orders.filter(
                (o) => o.merch_payment_status === "pending_approval",
              ).length
            }
          </div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {orders.filter((o) => o.merch_payment_status === "approved").length}
          </div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--error)" }}>
            {orders.filter((o) => o.merch_payment_status === "rejected").length}
          </div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        <button
          className={`tab ${filter === "pending_approval" ? "active" : ""}`}
          onClick={() => setFilter("pending_approval")}
        >
          Pending (
          {
            orders.filter((o) => o.merch_payment_status === "pending_approval")
              .length
          }
          )
        </button>
        <button
          className={`tab ${filter === "approved" ? "active" : ""}`}
          onClick={() => setFilter("approved")}
        >
          Approved
        </button>
        <button
          className={`tab ${filter === "rejected" ? "active" : ""}`}
          onClick={() => setFilter("rejected")}
        >
          Rejected
        </button>
        <button
          className={`tab ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">No orders found.</div>
      ) : (
        <ul>
          {filteredOrders.map((order) => (
            <li key={order._id}>
              <div
                className="flex justify-between items-center"
                style={{ marginBottom: 12 }}
              >
                <div>
                  <h4 style={{ margin: 0 }}>{order.event?.name}</h4>
                  <p style={{ margin: 0 }}>
                    <strong>Buyer:</strong> {order.participant?.first_name}{" "}
                    {order.participant?.last_name} ({order.participant?.email})
                  </p>
                </div>
                {getStatusBadge(order.merch_payment_status)}
              </div>

              <div className="form-row" style={{ marginBottom: 12 }}>
                <div>
                  <p>
                    <strong>Size:</strong> {order.merch?.size || "N/A"}
                  </p>
                  <p>
                    <strong>Color:</strong> {order.merch?.color || "N/A"}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Quantity:</strong> {order.merch?.quantity || 1}
                  </p>
                  <p>
                    <strong>Total:</strong> ₹
                    {(order.event?.registration_fee || 0) *
                      (order.merch?.quantity || 1)}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Ordered:</strong>{" "}
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  {order.ticketId && (
                    <p>
                      <strong>Ticket:</strong> {order.ticketId}
                    </p>
                  )}
                </div>
              </div>

              {/* Payment Proof */}
              {order.payment_proof_image && (
                <div style={{ marginBottom: 12 }}>
                  <p>
                    <strong>Payment Proof:</strong>
                  </p>
                  <img
                    src={order.payment_proof_image}
                    alt="Payment proof"
                    style={{
                      maxWidth: 200,
                      maxHeight: 200,
                      cursor: "pointer",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                    onClick={() => setSelectedImage(order.payment_proof_image)}
                  />
                </div>
              )}

              {order.payment_rejection_reason && (
                <p className="text-error">
                  <strong>Rejection Reason:</strong>{" "}
                  {order.payment_rejection_reason}
                </p>
              )}

              {/* Actions */}
              {order.merch_payment_status === "pending_approval" && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleApprove(order._id)}
                    className="success"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(order._id)}
                    className="danger"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Payment Proof</h3>
              <button
                className="modal-close"
                onClick={() => setSelectedImage(null)}
              >
                ×
              </button>
            </div>
            <img
              src={selectedImage}
              alt="Payment proof"
              style={{ width: "100%", borderRadius: "var(--radius)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MerchOrders;
