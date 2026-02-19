import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { session } from "./storage";
import { useNotifications } from "./NotificationContext";

function Navbar() {
  const role = localStorage.getItem("role");
  const { notifications, unreadCount, markAllRead, clearNotifications } =
    useNotifications() || {};
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    session.clear();
    window.location.href = "/";
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && markAllRead) {
      // Mark as read when opening
      setTimeout(() => markAllRead(), 1000);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {role === "participant" && (
        <>
          <Link to="/participant">Dashboard</Link> |{" "}
          <Link to="/events">Browse Events</Link> |{" "}
          <Link to="/organizers">Clubs / Organizers</Link> |{" "}
          <Link to="/profile">Profile</Link> | {/* Notification Bell */}
          <div
            ref={dropdownRef}
            style={{ position: "relative", display: "inline-block" }}
          >
            <button
              onClick={toggleNotifications}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "20px",
                position: "relative",
                padding: "4px 8px",
              }}
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-2px",
                    right: "-2px",
                    background: "#ef4444",
                    color: "white",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  width: "320px",
                  maxHeight: "400px",
                  overflowY: "auto",
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong>Notifications</strong>
                  {notifications?.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      style={{
                        fontSize: "12px",
                        background: "none",
                        border: "none",
                        color: "#666",
                        cursor: "pointer",
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {!notifications || notifications.length === 0 ? (
                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#888",
                    }}
                  >
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <Link
                      key={notif.id}
                      to={`/events/${notif.eventId}/discussion`}
                      onClick={() => setShowNotifications(false)}
                      style={{
                        display: "block",
                        padding: "12px",
                        borderBottom: "1px solid #f0f0f0",
                        textDecoration: "none",
                        color: "inherit",
                        background: notif.read ? "white" : "#f0f7ff",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: notif.read ? "normal" : "bold",
                        }}
                      >
                        {notif.message}
                      </div>
                      {notif.preview && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: "4px",
                          }}
                        >
                          {notif.preview}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#999",
                          marginTop: "4px",
                        }}
                      >
                        {formatTime(notif.timestamp)}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>{" "}
          |{" "}
        </>
      )}

      {role === "organizer" && (
        <>
          <Link to="/organizer">Dashboard</Link> |{" "}
          <Link to="/organizer/my-events">My Events</Link> |{" "}
          <Link to="/organizer/create-event">Create Event</Link> |{" "}
          <Link to="/organizer/merch-orders">Merch Orders</Link> |{" "}
          <Link to="/profile">Profile</Link> |{" "}
        </>
      )}

      {role === "admin" && (
        <>
          <Link to="/admin">Dashboard</Link> |{" "}
          <Link to="/admin/create-organizer">Manage Clubs/Organizers</Link> |{" "}
          <Link to="/admin/password-reset-requests">
            Password Reset Requests
          </Link>{" "}
          |{" "}
        </>
      )}

      <button onClick={handleLogout}>Logout</button>
    </nav>
  );
}

export default Navbar;
