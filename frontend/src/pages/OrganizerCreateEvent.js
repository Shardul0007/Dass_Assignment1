import { useState } from "react";
import { api_requests } from "../services/api";
import Navbar from "../services/NavBar";

function OrganizerCreateEvent() {
  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    event_type: "Normal",
    eligibility: "All",
    registration_deadline: "",
    registration_limit: "",
    registration_fee: "",
    event_tags: "",
    discord_webhook_url: "",
    merch_sizes: "",
    merch_colors: "",
    merch_stock: "",
    merch_purchase_limit: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      const isMerch = form.event_type === "Merchandise";
      await api_requests("api/organizer/create-event", "POST", {
        ...form,
        registration_limit: Number(form.registration_limit),
        registration_fee: Number(form.registration_fee),
        event_tags: form.event_tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...(isMerch
          ? {
              item_details: {
                sizes: form.merch_sizes
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                colors: form.merch_colors
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                stock: Number(form.merch_stock),
                purchase_limit: Number(form.merch_purchase_limit),
              },
            }
          : {}),
      });
      alert("Event created (Draft). Publish it next.");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <Navbar />
      <h2>Create Event</h2>

      <input name="name" placeholder="Event Name" onChange={handleChange} />
      <textarea
        name="description"
        placeholder="Description"
        onChange={handleChange}
      />

      <input type="datetime-local" name="start_date" onChange={handleChange} />
      <input type="datetime-local" name="end_date" onChange={handleChange} />

      <input
        type="datetime-local"
        name="registration_deadline"
        onChange={handleChange}
      />

      <select name="event_type" onChange={handleChange}>
        <option value="Normal">Normal</option>
        <option value="Merchandise">Merchandise</option>
      </select>

      {form.event_type === "Merchandise" && (
        <div style={{ border: "1px solid #ddd", padding: 12, marginTop: 10 }}>
          <h3>Merchandise Details</h3>
          <input
            name="merch_sizes"
            placeholder="Sizes (comma separated)"
            onChange={handleChange}
          />
          <input
            name="merch_colors"
            placeholder="Colors (comma separated)"
            onChange={handleChange}
          />
          <input
            name="merch_stock"
            placeholder="Stock quantity"
            onChange={handleChange}
          />
          <input
            name="merch_purchase_limit"
            placeholder="Purchase limit per participant"
            onChange={handleChange}
          />
        </div>
      )}

      <select name="eligibility" onChange={handleChange}>
        <option value="All">All</option>
        <option value="IIIT">IIIT Only</option>
      </select>

      <input
        name="registration_limit"
        placeholder="Registration Limit"
        onChange={handleChange}
      />
      <input
        name="registration_fee"
        placeholder="Registration Fee"
        onChange={handleChange}
      />
      <input
        name="event_tags"
        placeholder="Tags (comma separated)"
        onChange={handleChange}
      />

      <input
        name="discord_webhook_url"
        placeholder="Discord Webhook URL (optional)"
        onChange={handleChange}
      />

      <button onClick={handleSubmit}>Create Event</button>
    </div>
  );
}

export default OrganizerCreateEvent;
