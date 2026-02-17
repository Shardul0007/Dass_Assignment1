    import Navbar from "../services/NavBar";
import { Link } from "react-router-dom";

function AdminDashboard() {
  return (
    <div>
      <Navbar />
      <h2>Admin Dashboard</h2>
      <ul>
        <li>
          <Link to="/admin/create-organizer">Manage Clubs/Organizers</Link>
        </li>
        <li>
          <Link to="/admin/password-reset-requests">
            Password Reset Requests
          </Link>
        </li>
      </ul>
    </div>
  );
}

export default AdminDashboard;
