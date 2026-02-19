import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { io } from "socket.io-client";
import { api_requests } from "./api";

const NotificationContext = createContext();

const SOCKET_URL = process.env.REACT_APP_API_BASE || "http://localhost:3500";

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [subscribedEvents, setSubscribedEvents] = useState([]);
  const socketRef = useRef(null);

  // App doesn't re-render NotificationProvider on route navigation.
  // Keep role/token in state so login/logout updates are picked up.
  const [auth, setAuth] = useState(() => ({
    role: localStorage.getItem("role"),
    token: localStorage.getItem("token"),
  }));

  useEffect(() => {
    const sync = () => {
      const next = {
        role: localStorage.getItem("role"),
        token: localStorage.getItem("token"),
      };
      setAuth((prev) =>
        prev.role === next.role && prev.token === next.token ? prev : next,
      );
    };
    const id = setInterval(sync, 1000);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const getEventId = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") return String(v._id || v.id || "");
    return String(v);
  };

  // Load subscribed events (participant's registered events)
  useEffect(() => {
    const loadSubscribedEvents = async () => {
      if (auth.role !== "participant" || !auth.token) {
        setSubscribedEvents([]);
        return;
      }
      try {
        const regs = await api_requests(
          "api/participant/my-registrations",
          "GET",
        );
        const eventIds = regs
          .filter((r) => r.event?._id)
          .map((r) => ({ id: r.event._id, name: r.event.name }));
        setSubscribedEvents(eventIds);
      } catch (err) {
        console.error("Failed to load subscribed events:", err);
      }
    };
    loadSubscribedEvents();
  }, [auth.role, auth.token]);

  // Setup WebSocket connection for global notifications
  useEffect(() => {
    if (auth.role !== "participant" || !auth.token) return;

    if (subscribedEvents.length === 0) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    // Join all subscribed event rooms
    subscribedEvents.forEach((event) => {
      socketRef.current.emit("join-event", event.id);
    });

    // Listen for new messages from any subscribed event
    socketRef.current.on("new-message", (message) => {
      const eventId = getEventId(message?.event);
      const eventName =
        subscribedEvents.find((e) => String(e.id) === String(eventId))?.name ||
        "an event";
      const authorName =
        message.author?.first_name ||
        message.author?.organizer_name ||
        "Someone";

      const notification = {
        id: Date.now(),
        type: "message",
        eventId,
        eventName,
        message: `${authorName} posted in "${eventName}"`,
        preview:
          message.content?.slice(0, 50) +
          (message.content?.length > 50 ? "..." : ""),
        timestamp: new Date(),
        read: false,
      };

      setNotifications((prev) => [notification, ...prev].slice(0, 20)); // Keep last 20
      setUnreadCount((prev) => prev + 1);
    });

    // Listen for announcements
    socketRef.current.on("new-announcement", (message) => {
      const eventId = getEventId(message?.event);
      const eventName =
        subscribedEvents.find((e) => String(e.id) === String(eventId))?.name ||
        "an event";

      const notification = {
        id: Date.now(),
        type: "announcement",
        eventId,
        eventName,
        message: `📢 Announcement in "${eventName}"`,
        preview:
          message.content?.slice(0, 50) +
          (message.content?.length > 50 ? "..." : ""),
        timestamp: new Date(),
        read: false,
      };

      setNotifications((prev) => [notification, ...prev].slice(0, 20));
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [auth.role, auth.token, subscribedEvents]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAllRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
