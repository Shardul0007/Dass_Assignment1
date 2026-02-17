import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

const SOCKET_URL = "http://localhost:3500";

function EventDiscussion() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [newMessageNotification, setNewMessageNotification] = useState(null);
  const [collapsedThreads, setCollapsedThreads] = useState(new Set());
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const role = localStorage.getItem("role");
  const isOrganizer = role === "organizer" || role === "admin";

  // Build message tree from flat array
  const buildMessageTree = useCallback((flatMessages) => {
    const messageMap = new Map();
    const rootMessages = [];

    // First pass: create map of all messages
    flatMessages.forEach((msg) => {
      messageMap.set(msg._id, { ...msg, replies: [] });
    });

    // Second pass: build tree structure
    flatMessages.forEach((msg) => {
      const messageWithReplies = messageMap.get(msg._id);
      const parentId = msg.parent_message?._id || msg.parent_message;

      if (parentId && messageMap.has(parentId)) {
        messageMap.get(parentId).replies.push(messageWithReplies);
      } else {
        rootMessages.push(messageWithReplies);
      }
    });

    return rootMessages;
  }, []);

  const toggleThread = (messageId) => {
    setCollapsedThreads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const countReplies = (msg) => {
    let count = msg.replies?.length || 0;
    msg.replies?.forEach((reply) => {
      count += countReplies(reply);
    });
    return count;
  };

  const fetchMessages = useCallback(async () => {
    try {
      const endpoint = isOrganizer
        ? `api/organizer/event/${id}/discussion`
        : `api/participant/event/${id}/discussion`;
      const data = await api_requests(endpoint, "GET");
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!err.message.includes("403")) {
        setError(err.message);
      }
    }
  }, [id, isOrganizer]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ev = await api_requests(`api/events/${id}`, "GET");
        setEvent(ev);
        await fetchMessages();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Initialize Socket.IO connection
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    // Join the event room
    socketRef.current.emit("join-event", id);

    // Listen for new messages
    socketRef.current.on("new-message", (message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
      // Show notification for new message
      setNewMessageNotification(
        `New message from ${message.author?.first_name || message.author?.organizer_name || "User"}`,
      );
      setTimeout(() => setNewMessageNotification(null), 3000);
    });

    // Listen for new announcements
    socketRef.current.on("new-announcement", (message) => {
      setNewMessageNotification(
        `📢 New announcement: ${message.content.slice(0, 50)}...`,
      );
      setTimeout(() => setNewMessageNotification(null), 5000);
    });

    // Listen for reaction updates
    socketRef.current.on("reaction-update", ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m)),
      );
    });

    // Listen for pin updates
    socketRef.current.on("message-pinned", ({ messageId, is_pinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, is_pinned } : m)),
      );
    });

    // Listen for delete events
    socketRef.current.on("message-deleted", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? {
                ...m,
                is_deleted: true,
                content: "[Message deleted by organizer]",
              }
            : m,
        ),
      );
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-event", id);
        socketRef.current.disconnect();
      }
    };
  }, [id, fetchMessages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const endpoint = isOrganizer
        ? `api/organizer/event/${id}/discussion`
        : `api/participant/event/${id}/discussion`;

      const body = {
        content: newMessage,
        ...(isOrganizer && isAnnouncement ? { isAnnouncement: true } : {}),
        ...(replyTo ? { parentMessageId: replyTo._id } : {}),
      };

      await api_requests(endpoint, "POST", body);
      setNewMessage("");
      setIsAnnouncement(false);
      setReplyTo(null);
      // Message will be added via socket
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReact = async (messageId, reaction) => {
    try {
      await api_requests(
        `api/participant/discussion/${messageId}/react`,
        "POST",
        { reaction },
      );
      // Reaction will be updated via socket
    } catch (err) {
      console.log(err);
    }
  };

  const handlePin = async (messageId) => {
    try {
      await api_requests(`api/organizer/discussion/${messageId}/pin`, "PATCH");
      // Pin status will be updated via socket
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await api_requests(`api/organizer/discussion/${messageId}`, "DELETE");
      // Delete will be reflected via socket
    } catch (err) {
      alert(err.message);
    }
  };

  const getAuthorName = (author) => {
    if (author?.role === "organizer") {
      return author?.organizer_name || "Organizer";
    }
    return (
      `${author?.first_name || ""} ${author?.last_name || ""}`.trim() ||
      "Anonymous"
    );
  };

  const getRoleLabel = (author) => {
    if (author?.role === "organizer") return "Organizer";
    if (author?.role === "admin") return "Admin";
    return "Participant";
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Group messages: pinned first, then build tree for regular messages
  const pinnedMessages = messages.filter((m) => m.is_pinned && !m.is_deleted);
  const regularMessages = messages.filter((m) => !m.is_pinned && !m.is_deleted);
  const messageTree = buildMessageTree(regularMessages);

  // Recursive message component for threading
  const MessageItem = ({ msg, depth = 0 }) => {
    const hasReplies = msg.replies && msg.replies.length > 0;
    const isCollapsed = collapsedThreads.has(msg._id);
    const replyCount = countReplies(msg);
    const maxDepth = 8; // Maximum nesting depth

    return (
      <div
        className="message-thread"
        style={{
          marginLeft: depth > 0 ? Math.min(depth, maxDepth) * 20 : 0,
          borderLeft: depth > 0 ? "3px solid #e2e8f0" : "none",
          paddingLeft: depth > 0 ? 12 : 0,
          marginTop: depth > 0 ? 8 : 0,
        }}
      >
        <div className={`message ${msg.is_deleted ? "deleted" : ""}`}>
          <div className="flex justify-between items-center">
            <div>
              <span className="message-author">
                {getAuthorName(msg.author)}
              </span>
              <span
                className={`badge ${msg.author?.role === "organizer" ? "badge-primary" : "badge-neutral"}`}
              >
                {getRoleLabel(msg.author)}
              </span>
              {depth > 0 && (
                <span
                  className="badge"
                  style={{
                    marginLeft: 4,
                    fontSize: "0.7rem",
                    background: "#f1f5f9",
                  }}
                >
                  Reply
                </span>
              )}
            </div>
            <span className="message-time">
              {new Date(msg.createdAt).toLocaleString()}
            </span>
          </div>

          <p className="message-content">{msg.content}</p>

          <div
            className="flex justify-between items-center"
            style={{ marginTop: 8 }}
          >
            <div className="reactions">
              {["👍", "❤️", "🎉"].map((emoji) => {
                const count = msg.reactions?.[emoji]?.length || 0;
                return (
                  <button
                    key={emoji}
                    className="reaction"
                    onClick={() => handleReact(msg._id, emoji)}
                  >
                    {emoji} {count > 0 && count}
                  </button>
                );
              })}
              <button className="reaction" onClick={() => setReplyTo(msg)}>
                ↩️ Reply
              </button>
              {hasReplies && (
                <button
                  className="reaction"
                  onClick={() => toggleThread(msg._id)}
                  style={{ fontWeight: "bold" }}
                >
                  {isCollapsed
                    ? `▶ Show ${replyCount} repl${replyCount === 1 ? "y" : "ies"}`
                    : `▼ Hide replies`}
                </button>
              )}
            </div>
            {isOrganizer && (
              <div className="flex gap-1">
                <button
                  onClick={() => handlePin(msg._id)}
                  className="small secondary"
                >
                  Pin
                </button>
                <button
                  onClick={() => handleDelete(msg._id)}
                  className="small danger"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Render nested replies */}
        {hasReplies && !isCollapsed && (
          <div className="replies">
            {msg.replies.map((reply) => (
              <MessageItem key={reply._id} msg={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
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

      <h1>Discussion - {event?.name}</h1>

      {/* Real-time Notification */}
      {newMessageNotification && (
        <div
          className="alert alert-info"
          style={{
            position: "fixed",
            top: 70,
            right: 20,
            zIndex: 1000,
            animation: "slideIn 0.3s ease",
          }}
        >
          🔔 {newMessageNotification}
        </div>
      )}

      {/* Connection Status */}
      <div style={{ marginBottom: 12 }}>
        <span className="badge badge-success">
          🟢 Live - Real-time updates enabled
        </span>
      </div>

      {/* Pinned Messages */}
      {pinnedMessages.length > 0 && (
        <div className="card">
          <h3>📌 Pinned Messages</h3>
          {pinnedMessages.map((msg) => (
            <div
              key={msg._id}
              className={`message ${msg.is_announcement ? "announcement" : "pinned"}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="message-author">
                    {getAuthorName(msg.author)}
                  </span>
                  <span
                    className={`badge ${msg.author?.role === "organizer" ? "badge-primary" : "badge-neutral"}`}
                  >
                    {getRoleLabel(msg.author)}
                  </span>
                  {msg.is_announcement && (
                    <span
                      className="badge badge-warning"
                      style={{ marginLeft: 4 }}
                    >
                      Announcement
                    </span>
                  )}
                </div>
                <span className="message-time">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="message-content">{msg.content}</p>

              <div
                className="flex justify-between items-center"
                style={{ marginTop: 8 }}
              >
                <div className="reactions">
                  {["👍", "❤️", "🎉"].map((emoji) => {
                    const count = msg.reactions?.[emoji]?.length || 0;
                    return (
                      <button
                        key={emoji}
                        className="reaction"
                        onClick={() => handleReact(msg._id, emoji)}
                      >
                        {emoji} {count > 0 && count}
                      </button>
                    );
                  })}
                </div>
                {isOrganizer && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePin(msg._id)}
                      className="small secondary"
                    >
                      Unpin
                    </button>
                    <button
                      onClick={() => handleDelete(msg._id)}
                      className="small danger"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message Input */}
      <div className="card">
        <form onSubmit={handleSubmit}>
          {replyTo && (
            <div className="alert alert-info" style={{ marginBottom: 12 }}>
              Replying to: "{replyTo.content.slice(0, 50)}..."
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="small secondary"
                style={{ marginLeft: 8 }}
              >
                Cancel
              </button>
            </div>
          )}

          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write a message..."
            rows={3}
            style={{ marginBottom: 12 }}
          />

          <div className="flex justify-between items-center">
            <div>
              {isOrganizer && (
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAnnouncement}
                    onChange={(e) => setIsAnnouncement(e.target.checked)}
                  />
                  Post as Announcement
                </label>
              )}
            </div>
            <button type="submit" disabled={!newMessage.trim()}>
              Send Message
            </button>
          </div>
        </form>
      </div>

      {/* Regular Messages - Threaded View */}
      <div className="card">
        <h3>Discussion ({regularMessages.length} messages)</h3>

        {messageTree.length === 0 ? (
          <div className="empty-state">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messageTree.map((msg) => (
            <MessageItem key={msg._id} msg={msg} depth={0} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default EventDiscussion;
