import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { NotificationProvider } from "./services/NotificationContext";
import LoginFunction from "./pages/login";
import SignupFunction from "./pages/Signup";
import ParticipantDashboard from "./pages/ParticipantDashboard";
import Events from "./pages/Events";
import OrganizerCreateEvent from "./pages/OrganizerCreateEvent";
import ProtectedRoute from "./components/ProtectedRoutes";
import AdminCreateOrganizer from "./pages/AdminCreateOrganizer";
import OrganizerMyEvents from "./pages/OrganizerMyEvents";
import EventDetails from "./pages/Eventdetails";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import Organizers from "./pages/Organizers";
import OrganizerEventRegistrations from "./pages/OrganizerEventRegistrations";
import PasswordResetRequests from "./pages/PasswordResetRequests";
import OrganizerDetails from "./pages/OrganizerDetails";
import TicketDetails from "./pages/TicketDetails";
// Advanced Features
import QRScanner from "./pages/QRScanner";
import MerchOrders from "./pages/MerchOrders";
import EventFeedback from "./pages/EventFeedback";
import EventDiscussion from "./pages/EventDiscussion";

const RootRedirect = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token) return <LoginFunction />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "organizer") return <Navigate to="/organizer" replace />;
  if (role === "participant") return <Navigate to="/participant" replace />;
  return <LoginFunction />;
};

function App() {
  return (
    <NotificationProvider>
      <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/signup" element={<SignupFunction />} />

        <Route
          path="/participant"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <ParticipantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute
              allowedRoles={["participant", "admin", "organizer"]}
            >
              <Events />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute
              allowedRoles={["participant", "admin", "organizer"]}
            >
              <EventDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/:ticketId"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <TicketDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizers"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <Organizers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizers/:id"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <OrganizerDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute
              allowedRoles={["participant", "organizer", "admin"]}
            >
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer"
          element={
            <ProtectedRoute allowedRoles={["admin", "organizer"]}>
              <OrganizerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/create-event"
          element={
            <ProtectedRoute allowedRoles={["admin", "organizer"]}>
              <OrganizerCreateEvent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/my-events"
          element={
            <ProtectedRoute allowedRoles={["admin", "organizer"]}>
              <OrganizerMyEvents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/event/:id/registrations"
          element={
            <ProtectedRoute allowedRoles={["admin", "organizer"]}>
              <OrganizerEventRegistrations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/create-organizer"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminCreateOrganizer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/password-reset-requests"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <PasswordResetRequests />
            </ProtectedRoute>
          }
        />

        {/* Advanced Features Routes */}
        <Route
          path="/organizer/event/:id/scanner"
          element={
            <ProtectedRoute allowedRoles={["admin", "organizer"]}>
              <QRScanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/merch-orders"
          element={
            <ProtectedRoute allowedRoles={["admin", "organizer"]}>
              <MerchOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/event/:id/feedback"
          element={
            <ProtectedRoute allowedRoles={["admin", "organizer"]}>
              <EventFeedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id/discussion"
          element={
            <ProtectedRoute
              allowedRoles={["participant", "admin", "organizer"]}
            >
              <EventDiscussion />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </NotificationProvider>
  );
}

export default App;
