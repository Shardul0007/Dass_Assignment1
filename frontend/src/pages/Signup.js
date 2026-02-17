import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api_requests } from "../services/api";

const SignupFunction = () => {
  const navigate = useNavigate();
  const [form, setform] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    participant_type: "",
    organisation_name: "",
    contact_number: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setform({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.participant_type) return "Select participant type.";
    if (form.participant_type === "IIIT") {
      const ok =
        form.email.endsWith("@students.iiit.ac.in") ||
        form.email.endsWith("@research.iiit.ac.in");
      if (!ok) return "IIIT participants must use an IIIT email.";
    }
    return "";
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    try {
      await api_requests("api/users/signup", "POST", form);

      // Backend signup does not return a JWT, so we immediately login
      // to enable post-signup onboarding/preferences.
      const login = await api_requests("api/users/login", "POST", {
        email: form.email,
        password: form.password,
      });
      localStorage.setItem("token", login.token);
      localStorage.setItem("role", login.role);
      localStorage.setItem("email", form.email);

      navigate("/profile");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 500, marginTop: 40 }}>
      <div className="card">
        <h2 style={{ textAlign: "center", marginBottom: 24 }}>
          Participant Signup
        </h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSignUp}>
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                name="first_name"
                placeholder="First Name"
                value={form.first_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                name="last_name"
                placeholder="Last Name"
                value={form.last_name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Contact Number</label>
            <input
              name="contact_number"
              placeholder="Contact Number"
              value={form.contact_number}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Participant Type</label>
            <select
              name="participant_type"
              value={form.participant_type}
              onChange={handleChange}
              required
            >
              <option value="">Select participant type</option>
              <option value="IIIT">IIIT</option>
              <option value="Non-IIIT">Non-IIIT</option>
            </select>
          </div>

          <div className="form-group">
            <label>College / Organisation</label>
            <input
              name="organisation_name"
              placeholder="College / Organisation"
              value={form.organisation_name}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" style={{ width: "100%", marginTop: 8 }}>
            Signup
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16 }}>
          Already have an account?{" "}
          <Link to="/" style={{ color: "var(--primary)" }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupFunction;
