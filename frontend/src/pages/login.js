import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api_requests } from "../services/api";

const LoginFunction = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotReason, setForgotReason] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api_requests("api/users/login", "POST", {
        email,
        password,
      });

      localStorage.setItem("token", response.token);
      localStorage.setItem("role", response.role);
      localStorage.setItem("email", email);

      if (response.role === "admin") navigate("/admin");
      else if (response.role === "organizer") navigate("/organizer");
      else navigate("/participant");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotSuccess("");
    setError("");
    try {
      const res = await api_requests("api/users/forgot-password", "POST", {
        email: forgotEmail,
        reason: forgotReason,
      });
      setForgotSuccess(res.message);
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotEmail("");
        setForgotReason("");
        setForgotSuccess("");
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: 80 }}>
      <div className="card">
        <h2 style={{ textAlign: "center", marginBottom: 24 }}>
          Felicity Login
        </h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16 }}>
          Participant?{" "}
          <Link to="/signup" style={{ color: "var(--primary)" }}>
            Create an account
          </Link>
        </p>

        <p style={{ textAlign: "center", marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="secondary"
            style={{ padding: "8px 16px", fontSize: 14 }}
          >
            Organizer? Forgot Password
          </button>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          className="modal-overlay"
          onClick={() => setShowForgotPassword(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Request Password Reset</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              For organizers only. Admin will review your request.
            </p>

            {forgotSuccess && (
              <div className="alert alert-success">{forgotSuccess}</div>
            )}
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleForgotPassword}>
              <div className="form-group">
                <label>Organizer Email</label>
                <input
                  type="email"
                  placeholder="Enter your organizer email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Reason (optional)</label>
                <textarea
                  placeholder="Why do you need a password reset?"
                  value={forgotReason}
                  onChange={(e) => setForgotReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginFunction;
