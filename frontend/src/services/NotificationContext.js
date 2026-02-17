import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { api_requests } from "./api";

const NotificationContext = createContext();

const SOCKET_URL = process.env.REACT_APP_API_BASE || "http://localhost:3500";

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [subscribedEvents, setSubscribedEvents] = useState([]);
  const socketRef = useRef(null);
  const role = localStorage.getItem("role");

  // Load subscribed events (participant's registered events)
  useEffect(() => {
    const loadSubscribedEvents = async () => {
      if (role !== "participant") return;
      try {
        const regs = await api_requests("api/participant/my-registrations", "GET");
        const eventIds = regs
          .filter(r => r.event?._id)
          .map(r => ({ id: r.event._id, name: r.event.name }));
        setSubscribedEvents(eventIds);
      } catch (err) {
        console.error("Failed to load subscribed events:", err);
      }
    };
    loadSubscribedEvents();
  }, [role]);

  // Setup WebSocket connection for global notifications
  useEffect(() => {
    if (role !== "participant" || subscribedEvents.length === 0) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    // Join all subscribed event rooms
    subscribedEvents.forEach(event => {
      socketRef.current.emit("join-event", event.id);
    });

    // Listen for new messages from any subscribed event
    socketRef.current.on("new-message", (message) => {
      const eventName = subscribedEvents.find(e => e.id === message.event)?.name || "an event";
      const authorName = message.author?.first_name || message.author?.organizer_name || "Someone";
      
      const notification = {
        id: Date.now(),
        type: "message",
        eventId: message.event,
        eventName,
        message: `${authorName} posted in "${eventName}"`,
        preview: message.content?.slice(0, 50) + (message.content?.length > 50 ? "..." : ""),
        timestamp: new Date(),
        read: false,
      };

      setNotifications(prev => [notification, ...prev].slice(0, 20)); // Keep last 20
      setUnreadCount(prev => prev + 1);
    });

    // Listen for announcements
    socketRef.current.on("new-announcement", (message) => {
      const eventName = subscribedEvents.find(e => e.id === message.event)?.name || "an event";
      
      const notification = {
        id: Date.now(),
        type: "announcement",
        eventId: message.event,
        eventName,
        message: `📢 Announcement in "${eventName}"`,
        preview: message.content?.slice(0, 50) + (message.content?.length > 50 ? "..." : ""),
        timestamp: new Date(),
        read: false,
      };

      setNotifications(prev => [notification, ...prev].slice(0, 20));
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [role, subscribedEvents]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
