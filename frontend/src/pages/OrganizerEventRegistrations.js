import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

const toCsv = (rows) => {
  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  return rows.map((r) => r.map(escape).join(",")).join("\n");
};

function OrganizerEventRegistrations() {
  const { id } = useParams();
  const [registrations, setRegistrations] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [attendanceFilter, setAttendanceFilter] = useState("All");
  const [participantTypeFilter, setParticipantTypeFilter] = useState("All");
  const [teamQ, setTeamQ] = useState("");
  const [sortBy, setSortBy] = useState("Newest");
  const [ticketId, setTicketId] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");

  const updateAttendance = async (registrationId, attendance) => {
    try {
      await api_requests(`api/organizer/event/${id}/attendance`, "PATCH", {
        registrationId,
        attendance,
      });
      setRegistrations((prev) =>
        prev.map((r) => (r._id === registrationId ? { ...r, attendance } : r)),
      );
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const ev = await api_requests(`api/events/${id}`, "GET");
        setEvent(ev || null);
        const data = await api_requests(
          `api/organizer/event/${id}/registrations`,
          "GET",
        );
        setRegistrations(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  const stats = useMemo(() => {
    const fee = Number(event?.registration_fee || 0);
    const activeRegs = registrations.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return s === "registered" || s === "completed";
    });
    const totalRegs = activeRegs.length;
    const paidRegs = activeRegs.filter(
      (r) => String(r.payment_status) === "paid",
    );
    const paidCount = paidRegs.length;
    const attendanceCount = activeRegs.filter((r) => !!r.attendance).length;
    let revenue = 0;
    if ((event?.event_type || "") === "Merchandise") {
      const totalQty = paidRegs.reduce(
        (s, r) => s + Number(r?.merch?.quantity || 1),
        0,
      );
      revenue = fee * totalQty;
    } else {
      revenue = fee * paidCount;
    }
    return { totalRegs, paidCount, attendanceCount, revenue };
  }, [event, registrations]);

  const teamStats = useMemo(() => {
    if ((event?.event_type || "") !== "Normal") {
      return { teamsTotal: 0, teamsComplete: 0, completionRate: 0 };
    }
    const active = registrations.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return s === "registered" || s === "completed";
    });
    const teamMap = new Map();
    for (const r of active) {
      const name = typeof r.team_name === "string" ? r.team_name.trim() : "";
      if (!name) continue;
      const t = teamMap.get(name) || { members: 0, attended: 0 };
      t.members += 1;
      if (r.attendance) t.attended += 1;
      teamMap.set(name, t);
    }
    const teams = Array.from(teamMap.values());
    const teamsTotal = teams.length;
    const teamsComplete = teams.filter(
      (t) => t.members > 0 && t.attended === t.members,
    ).length;
    const completionRate = teamsTotal ? teamsComplete / teamsTotal : 0;
    return { teamsTotal, teamsComplete, completionRate };
  }, [event, registrations]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const team = teamQ.toLowerCase().trim();
    let rows = registrations.filter((r) => {
      const p = r.participant || {};
      const hay = `${p.first_name || ""} ${p.last_name || ""} ${p.email || ""}`
        .toLowerCase()
        .trim();
      const teamName = (r.team_name || "").toString().toLowerCase();
      const matchesText = !s ? true : hay.includes(s);
      const matchesTeam = !team ? true : teamName.includes(team);

      const st = String(r.status || "");
      const pay = String(r.payment_status || "");
      const pt = String(p.participant_type || "");

      const matchesStatus = statusFilter === "All" ? true : st === statusFilter;
      const matchesPay = paymentFilter === "All" ? true : pay === paymentFilter;
      const matchesType =
        participantTypeFilter === "All" ? true : pt === participantTypeFilter;
      const matchesAttendance =
        attendanceFilter === "All"
          ? true
          : attendanceFilter === "Attended"
            ? !!r.attendance
            : !r.attendance;

      return (
        matchesText &&
        matchesTeam &&
        matchesStatus &&
        matchesPay &&
        matchesType &&
        matchesAttendance
      );
    });

    rows = rows.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortBy === "Oldest" ? ta - tb : tb - ta;
    });

    return rows;
  }, [
    registrations,
    q,
    teamQ,
    statusFilter,
    paymentFilter,
    attendanceFilter,
    participantTypeFilter,
    sortBy,
  ]);

  const exportCsv = () => {
    const rows = [
      [
        "First Name",
        "Last Name",
        "Email",
        "Participant Type",
        "Org/College",
        "Contact",
        "Reg Date",
      ],
      ...filtered.map((r) => {
        const p = r.participant || {};
        return [
          p.first_name,
          p.last_name,
          p.email,
          p.participant_type,
          p.organisation_name,
          p.contact_number,
          r.createdAt ? new Date(r.createdAt).toISOString() : "",
        ];
      }),
    ];

    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verifyTicket = async () => {
    const value = ticketId.trim();
    if (!value) return;
    try {
      setVerifyMsg("");
      const res = await api_requests("api/organizer/verify-ticket", "POST", {
        ticketId: value,
      });
      setVerifyMsg(res?.message || "Verified");
      setTicketId("");
      const data = await api_requests(
        `api/organizer/event/${id}/registrations`,
        "GET",
      );
      setRegistrations(Array.isArray(data) ? data : []);
    } catch (err) {
      setVerifyMsg(err.message);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div>
      <Navbar />
      <h2>Event Registrations</h2>

      {event && (
        <div className="card">
          <div
            className="flex justify-between items-center"
            style={{ marginBottom: 16 }}
          >
            <h3 style={{ margin: 0 }}>Overview</h3>
            <div className="flex gap-1">
              <Link to={`/organizer/event/${id}/scanner`}>
                <button className="secondary">QR Scanner</button>
              </Link>
              <Link to={`/organizer/event/${id}/feedback`}>
                <button className="secondary">View Feedback</button>
              </Link>
              <Link to={`/events/${id}/discussion`}>
                <button className="secondary">Discussion</button>
              </Link>
            </div>
          </div>
          <p>
            <strong>Name:</strong> {event.name}
          </p>
          <p>
            <strong>Type:</strong> {event.event_type} | <strong>Status:</strong>{" "}
            {event.status}
          </p>
          <p>
            <strong>Dates:</strong>{" "}
            {new Date(event.start_date).toLocaleString()} —{" "}
            {new Date(event.end_date).toLocaleString()}
          </p>
          <p>
            <strong>Eligibility:</strong> {event.eligibility} |{" "}
            <strong>Fee:</strong> {event.registration_fee}
          </p>

          <h3>Analytics</h3>
          <p>
            Registrations: {stats.totalRegs} | Paid: {stats.paidCount} |
            Revenue: {stats.revenue} | Attendance: {stats.attendanceCount}
          </p>

          {(event.event_type || "") === "Normal" && (
            <p>
              <strong>Team completion:</strong> {teamStats.teamsComplete}/
              {teamStats.teamsTotal} (
              {Math.round(teamStats.completionRate * 100)}%)
            </p>
          )}
        </div>
      )}
      <div>
        <input
          placeholder="Search by name/email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          placeholder="Filter by team name"
          value={teamQ}
          onChange={(e) => setTeamQ(e.target.value)}
          style={{ marginLeft: 8 }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="All">All statuses</option>
          <option value="registered">registered</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
          <option value="rejected">rejected</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="All">All payments</option>
          <option value="paid">paid</option>
          <option value="pending">pending</option>
        </select>

        <select
          value={attendanceFilter}
          onChange={(e) => setAttendanceFilter(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="All">All attendance</option>
          <option value="Attended">attended</option>
          <option value="NotAttended">not attended</option>
        </select>

        <select
          value={participantTypeFilter}
          onChange={(e) => setParticipantTypeFilter(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="All">All types</option>
          <option value="IIIT">IIIT</option>
          <option value="Non-IIIT">Non-IIIT</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="Newest">Newest</option>
          <option value="Oldest">Oldest</option>
        </select>

        <button onClick={exportCsv}>Export CSV</button>
      </div>

      <div style={{ marginTop: 10, border: "1px solid #ddd", padding: 12 }}>
        <h3>Verify Ticket (Entry)</h3>
        <input
          placeholder="Paste Ticket ID (e.g. FEST-...)"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
        />
        <button onClick={verifyTicket}>Verify</button>
        {verifyMsg && <p>{verifyMsg}</p>}
      </div>

      {filtered.length === 0 ? (
        <p>No registrations.</p>
      ) : (
        <ul>
          {filtered.map((r) => (
            <li
              key={r._id}
              style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}
            >
              <p>
                <strong>Name:</strong>{" "}
                {(r.participant?.first_name || "") +
                  " " +
                  (r.participant?.last_name || "")}
              </p>
              <p>
                <strong>Email:</strong> {r.participant?.email}
              </p>
              <p>
                <strong>Type:</strong> {r.participant?.participant_type}
              </p>
              <p>
                <strong>Org:</strong> {r.participant?.organisation_name}
              </p>
              <p>
                <strong>Contact:</strong> {r.participant?.contact_number}
              </p>
              <p>
                <strong>Registered:</strong>{" "}
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
              </p>

              <p>
                <strong>Ticket:</strong> {r.ticketId || "N/A"}
              </p>
              <p>
                <strong>Status:</strong> {r.status}
              </p>
              <p>
                <strong>Payment:</strong> {r.payment_status}
              </p>

              <label style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={!!r.attendance}
                  onChange={(e) => updateAttendance(r._id, e.target.checked)}
                />{" "}
                Mark attended
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default OrganizerEventRegistrations;
