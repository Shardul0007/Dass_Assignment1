import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function EventDetails() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [registration, setRegistration] = useState(null);

  const [teamName, setTeamName] = useState("");
  const [formResponse, setFormResponse] = useState({});
  const [merch, setMerch] = useState({ size: "", color: "", quantity: 1 });
  const [paymentProof, setPaymentProof] = useState(null);

  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const role = localStorage.getItem("role");

  // Auto-scroll to feedback section if hash is present
  useEffect(() => {
    if (window.location.hash === "#feedback") {
      setTimeout(() => {
        const el = document.getElementById("feedback");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 500);
    }
  }, [event]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const currentRole = localStorage.getItem("role");
        const data = await api_requests(`api/events/${id}`, "GET");
        setEvent(data);

        try {
          const a = await api_requests(`api/events/${id}/availability`, "GET");
          setAvailability(a);
        } catch {
          setAvailability(null);
        }

        if (currentRole === "participant") {
          // Get registration details first - this includes all statuses
          let foundRegistration = null;
          try {
            const regs = await api_requests(
              "api/participant/my-registrations",
              "GET",
            );
            foundRegistration = regs.find(
              (r) => r.event?._id === id || r.event === id,
            );
            setRegistration(foundRegistration);
            // User is registered if they have ANY registration (regardless of status)
            setIsRegistered(!!foundRegistration);
          } catch {
            // Fallback to my-events if my-registrations fails
            const my = await api_requests("api/participant/my-events", "GET");
            const ids = new Set(
              (Array.isArray(my) ? my : []).map((e) => e._id),
            );
            setIsRegistered(ids.has(id));
          }

          // Check if feedback already submitted
          try {
            const feedbacks = await api_requests(
              "api/participant/my-feedback",
              "GET",
            );
            const hasFeedback = feedbacks.some(
              (f) => f.event?._id === id || f.event === id,
            );
            setFeedbackSubmitted(hasFeedback);
          } catch {}
        } else {
          setIsRegistered(false);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  const deadlinePassed = useMemo(() => {
    if (!event?.registration_deadline) return false;
    return new Date() > new Date(event.registration_deadline);
  }, [event]);

  const isMerchandise = (event?.event_type || "") === "Merchandise";
  const isFull = !!availability?.isFull;
  const outOfStock = !!availability?.outOfStock;

  const canRegister =
    role === "participant" &&
    event &&
    !isMerchandise &&
    event.status === "published" &&
    !deadlinePassed &&
    !isFull &&
    !isRegistered;

  const canPurchase =
    role === "participant" &&
    event &&
    isMerchandise &&
    event.status === "published" &&
    !deadlinePassed &&
    !outOfStock;

  const handleRegister = async () => {
    try {
      await api_requests("api/participant/register-event", "POST", {
        eventId: event._id,
        team_name: teamName,
        formResponse,
      });
      setIsRegistered(true);
      alert("Registered successfully");
    } catch (err) {
      alert(err.message);
    }
  };

  // New: Place order with payment proof (for payment approval workflow)
  const handlePlaceOrder = async () => {
    if (!paymentProof) {
      alert("Please upload payment proof image");
      return;
    }
    try {
      await api_requests("api/participant/place-merchandise-order", "POST", {
        eventId: event._id,
        size: merch.size,
        color: merch.color,
        quantity: Number(merch.quantity || 1),
        paymentProofImage: paymentProof,
      });
      alert(
        "Order placed! Awaiting payment approval from organizer. You will receive a ticket once approved.",
      );
      setPaymentProof(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePaymentProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("File too large. Max 2MB.");
      return;
    }
    const base64 = await fileToBase64(file);
    setPaymentProof(base64);
  };

  // Feedback submission
  const handleFeedbackSubmit = async () => {
    if (feedbackRating < 1 || feedbackRating > 5) {
      alert("Please select a rating (1-5 stars)");
      return;
    }
    try {
      await api_requests("api/participant/feedback", "POST", {
        eventId: event._id,
        rating: feedbackRating,
        comment: feedbackComment,
      });
      setFeedbackSubmitted(true);
      alert("Thank you for your feedback!");
    } catch (err) {
      alert(err.message);
    }
  };

  // Check if event is completed for feedback
  const isEventCompleted = useMemo(() => {
    if (!event) return false;
    if (event.status === "closed") return true;
    if (registration?.status === "completed") return true;
    if (event.end_date && new Date(event.end_date) < new Date()) return true;
    return false;
  }, [event, registration]);

  const handleUnregister = async () => {
    if (!window.confirm("Are you sure you want to unregister from this event?"))
      return;
    try {
      await api_requests(`api/participant/cancel-registration/${id}`, "DELETE");
      setIsRegistered(false);
      alert("Unregistered successfully");
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!event) return <p>Event not found.</p>;

  return (
    <div>
      <Navbar />
      <h2>{event.name}</h2>
      <p>{event.description}</p>

      <p>
        <strong>Type:</strong> {event.event_type}
      </p>
      <p>
        <strong>Eligibility:</strong> {event.eligibility}
      </p>
      <p>
        <strong>Status:</strong> {event.status}
      </p>
      <p>
        <strong>Organizer:</strong> {event.created_by?.organizer_name || "N/A"}
      </p>

      <p>
        <strong>Registration Deadline:</strong>{" "}
        {new Date(event.registration_deadline).toLocaleString()}
      </p>
      <p>
        <strong>Start:</strong> {new Date(event.start_date).toLocaleString()}
      </p>
      <p>
        <strong>End:</strong> {new Date(event.end_date).toLocaleString()}
      </p>
      <p>
        <strong>Fee:</strong> {event.registration_fee}
      </p>
      <p>
        <strong>Limit:</strong> {event.registration_limit ?? "N/A"}
      </p>

      {availability &&
        !isMerchandise &&
        availability.registration_limit !== null && (
          <p>
            <strong>Spots:</strong> {availability.registered_count}/
            {availability.registration_limit}{" "}
            {availability.isFull
              ? "(Full)"
              : `(Remaining: ${availability.remaining})`}
          </p>
        )}

      {availability && isMerchandise && (
        <p>
          <strong>Stock:</strong> {availability.stock}{" "}
          {availability.outOfStock ? "(Out of stock)" : ""}
        </p>
      )}
      <p>
        <strong>Tags:</strong> {(event.event_tags || []).join(", ")}
      </p>

      {role === "participant" && (
        <>
          {!isMerchandise ? (
            <>
              {(event.custom_form || []).length > 0 && (
                <div
                  style={{
                    border: "1px solid #ddd",
                    padding: 12,
                    marginTop: 12,
                  }}
                >
                  <h3>Registration Form</h3>
                  <div>
                    <input
                      placeholder="Team name (optional)"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                  </div>
                  {(event.custom_form || []).map((f) => {
                    const key = f.field_id || f.label;
                    if (f.type === "dropdown") {
                      return (
                        <div key={key} style={{ marginTop: 8 }}>
                          <label>
                            {f.label}
                            {f.required ? " *" : ""}
                          </label>
                          <select
                            value={formResponse[key] || ""}
                            onChange={(e) =>
                              setFormResponse((p) => ({
                                ...p,
                                [key]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Select</option>
                            {(f.options || []).map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    if (f.type === "checkbox") {
                      return (
                        <div key={key} style={{ marginTop: 8 }}>
                          <label>
                            <input
                              type="checkbox"
                              checked={!!formResponse[key]}
                              onChange={(e) =>
                                setFormResponse((p) => ({
                                  ...p,
                                  [key]: e.target.checked,
                                }))
                              }
                            />{" "}
                            {f.label}
                            {f.required ? " *" : ""}
                          </label>
                        </div>
                      );
                    }
                    if (f.type === "file") {
                      return (
                        <div key={key} style={{ marginTop: 8 }}>
                          <label>
                            {f.label}
                            {f.required ? " *" : ""}
                          </label>
                          <input
                            type="file"
                            onChange={async (e) => {
                              const file = e.target.files && e.target.files[0];
                              if (!file) return;
                              const dataBase64 = await fileToBase64(file);
                              setFormResponse((p) => ({
                                ...p,
                                [key]: {
                                  filename: file.name,
                                  mime: file.type,
                                  dataBase64,
                                },
                              }));
                            }}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={key} style={{ marginTop: 8 }}>
                        <label>
                          {f.label}
                          {f.required ? " *" : ""}
                        </label>
                        <input
                          value={formResponse[key] || ""}
                          onChange={(e) =>
                            setFormResponse((p) => ({
                              ...p,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={handleRegister} disabled={!canRegister}>
                {isRegistered && event.status !== "closed"
                  ? "Already registered"
                  : deadlinePassed
                    ? "Deadline passed"
                    : isFull
                      ? "Registration full"
                      : event.status === "draft"
                        ? "Not open"
                        : event.status === "closed"
                          ? "Event closed"
                          : "Register"}
              </button>

              {isRegistered && event.status !== "closed" && (
                <button onClick={handleUnregister}>Unregister</button>
              )}
            </>
          ) : (
            <>
              <div className="card" style={{ marginTop: 12 }}>
                <h3>Purchase Merchandise</h3>
                <div className="form-row">
                  {(event.item_details?.sizes || []).length > 0 && (
                    <div className="form-group">
                      <label>Size</label>
                      <select
                        value={merch.size}
                        onChange={(e) =>
                          setMerch((p) => ({ ...p, size: e.target.value }))
                        }
                      >
                        <option value="">Select size</option>
                        {(event.item_details?.sizes || []).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {(event.item_details?.colors || []).length > 0 && (
                    <div className="form-group">
                      <label>Color</label>
                      <select
                        value={merch.color}
                        onChange={(e) =>
                          setMerch((p) => ({ ...p, color: e.target.value }))
                        }
                      >
                        <option value="">Select color</option>
                        {(event.item_details?.colors || []).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={merch.quantity}
                      onChange={(e) =>
                        setMerch((p) => ({
                          ...p,
                          quantity: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                <p>
                  <strong>Total:</strong> ₹
                  {(event.registration_fee || 0) * (merch.quantity || 1)}
                </p>

                {/* Payment Proof Upload Section */}
                <div
                  className="card"
                  style={{ background: "var(--bg-secondary)", marginTop: 12 }}
                >
                  <h4>Payment Verification Required</h4>
                  <p className="text-secondary" style={{ fontSize: 14 }}>
                    Upload your payment proof (screenshot/receipt). Your order
                    will be reviewed by the organizer.
                  </p>
                  <div className="form-group">
                    <label>Payment Proof Image (Max 2MB)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePaymentProofUpload}
                    />
                  </div>
                  {paymentProof && (
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={paymentProof}
                        alt="Payment proof preview"
                        style={{
                          maxWidth: 200,
                          maxHeight: 150,
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <button
                        onClick={() => setPaymentProof(null)}
                        className="small danger"
                        style={{ marginLeft: 8 }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-1" style={{ marginTop: 16 }}>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={!canPurchase || !paymentProof}
                  >
                    {deadlinePassed
                      ? "Deadline passed"
                      : outOfStock
                        ? "Out of stock"
                        : !paymentProof
                          ? "Upload payment proof"
                          : "Place Order"}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Discussion Forum Link */}
      {isRegistered && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Discussion Forum</h3>
          <p className="text-secondary">
            Join the discussion with other participants and the organizer.
          </p>
          <Link to={`/events/${id}/discussion`}>
            <button className="secondary">Open Discussion</button>
          </Link>
        </div>
      )}

      {/* Feedback Section - Only for completed events */}
      {role === "participant" && isRegistered && isEventCompleted && (
        <div id="feedback" className="card" style={{ marginTop: 16 }}>
          <h3>Event Feedback</h3>
          {feedbackSubmitted ? (
            <div className="alert alert-success">
              Thank you! Your feedback has been submitted.
            </div>
          ) : (
            <>
              <p className="text-secondary">
                Share your anonymous feedback about this event.
              </p>

              <div className="form-group">
                <label>Rating</label>
                <div className="stars" style={{ fontSize: 28 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`star ${star <= feedbackRating ? "filled" : ""}`}
                      onClick={() => setFeedbackRating(star)}
                      style={{ cursor: "pointer" }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Comments (Optional)</label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Share your experience..."
                  rows={3}
                />
              </div>

              <button
                onClick={handleFeedbackSubmit}
                disabled={feedbackRating === 0}
              >
                Submit Feedback
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default EventDetails;
