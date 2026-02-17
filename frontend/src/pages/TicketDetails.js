import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

function TicketDetails() {
  const { ticketId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState(null);
  const [qrBase64, setQrBase64] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await api_requests(
          `api/participant/tickets/${ticketId}`,
          "GET",
        );
        setTicket(data?.ticket || null);
        setQrBase64(data?.qrBase64 || "");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [ticketId]);

  return (
    <div>
      <Navbar />
      <h2>Ticket Details</h2>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : !ticket ? (
        <p>Ticket not found.</p>
      ) : (
        <>
          <p>
            <strong>Ticket ID:</strong> {ticket.ticketId}
          </p>
          <p>
            <strong>Event:</strong> {ticket.event?.name || "N/A"}{" "}
            {ticket.event?._id && (
              <Link to={`/events/${ticket.event._id}`}>View event</Link>
            )}
          </p>
          <p>
            <strong>Participant:</strong>{" "}
            {(ticket.participant?.first_name || "") +
              " " +
              (ticket.participant?.last_name || "")}
          </p>
          {qrBase64 && (
            <div>
              <h3>QR</h3>
              <img alt="Ticket QR" src={qrBase64} style={{ maxWidth: 260 }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TicketDetails;
