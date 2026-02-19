import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import Navbar from "../services/NavBar";
import { api_requests } from "../services/api";

function QRScanner() {
  const { id } = useParams(); // event ID
  const [event, setEvent] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [manualInput, setManualInput] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [scanMode, setScanMode] = useState("camera"); // "camera", "file", "manual"
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ev = await api_requests(`api/events/${id}`, "GET");
        setEvent(ev);
        await refreshDashboard();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && cameraActive) {
        html5QrCodeRef.current.stop().catch(console.log);
      }
    };
  }, [cameraActive]);

  const refreshDashboard = async () => {
    try {
      const dash = await api_requests(
        `api/organizer/event/${id}/attendance-dashboard`,
        "GET",
      );
      setDashboard(dash);
    } catch (err) {
      console.log(err);
    }
  };

  const handleScan = async (qrData) => {
    setScanResult(null);
    setError("");

    try {
      const res = await api_requests("api/organizer/scan-qr", "POST", {
        qrData,
        eventId: id,
      });
      setScanResult({ success: true, ...res });
      refreshDashboard();
    } catch (err) {
      setScanResult({
        success: false,
        message: err.message,
        duplicate: err.message?.includes("already"),
      });
    }
  };

  const startCamera = async () => {
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      }

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // On successful scan
          handleScan(decodedText);
          // Optionally stop after scan
          // stopCamera();
        },
        (errorMessage) => {
          // Ignore scan errors (no QR found)
        },
      );
      setCameraActive(true);
    } catch (err) {
      console.error("Error starting camera:", err);
      setError(
        "Could not access camera. Please use file upload or manual input.",
      );
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && cameraActive) {
      await html5QrCodeRef.current.stop();
      setCameraActive(false);
    }
  };

  const handleManualScan = () => {
    if (!manualInput.trim()) return;
    // Try to detect if it's a ticket ID or full QR data
    const input = manualInput.trim();
    if (input.startsWith("{")) {
      handleScan(input);
    } else {
      // It's a ticket ID, wrap it in QR format
      handleScan(JSON.stringify({ ticketId: input }));
    }
    setManualInput("");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader-file");
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      handleScan(decodedText);
    } catch (err) {
      console.error("Error scanning file:", err);
      // Try reading as JSON
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        const text = await file.text();
        handleScan(text);
      } else {
        setError("Could not read QR code from image. Try manual input.");
      }
    }
    e.target.value = "";
  };

  const handleManualOverride = async (registrationId, attendance) => {
    const reason = prompt("Enter reason for manual override:");
    if (reason === null) return;

    try {
      await api_requests(
        `api/organizer/event/${id}/manual-attendance`,
        "PATCH",
        {
          registrationId,
          attendance,
          reason,
        },
      );
      alert("Attendance updated");
      refreshDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  const exportCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const base = String(
        process.env.REACT_APP_API_BASE || "http://localhost:3500",
      ).replace(/\/+$/, "");
      const response = await fetch(
        `${base}/api/organizer/event/${id}/attendance-csv`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        let msg = response.statusText || "Failed to export CSV";
        try {
          if (contentType.includes("application/json")) {
            const data = await response.json();
            msg = data?.message || msg;
          } else {
            const text = await response.text();
            if (text && text.toLowerCase().includes("cannot get")) {
              msg =
                "CSV endpoint not reached. Check REACT_APP_API_BASE (no trailing slash)";
            }
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${event?.name || id}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.message || "Failed to export CSV");
    }
  };

  if (loading)
    return (
      <div className="container">
        <Navbar />
        <p className="loading">Loading...</p>
      </div>
    );
  if (error && !event)
    return (
      <div className="container">
        <Navbar />
        <p className="alert alert-error">{error}</p>
      </div>
    );

  return (
    <div className="container">
      <Navbar />

      <h1>QR Scanner - {event?.name}</h1>

      {/* Stats */}
      {dashboard && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{dashboard.totalRegistrations}</div>
            <div className="stat-label">Total Registered</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--success)" }}>
              {dashboard.scannedCount}
            </div>
            <div className="stat-label">Checked In</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--warning)" }}>
              {dashboard.pendingCount}
            </div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
      )}

      {/* Scanner Section */}
      <div className="card">
        <h3>Scan QR Code</h3>

        {/* Scan Mode Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button
            className={`tab ${scanMode === "camera" ? "active" : ""}`}
            onClick={() => {
              setScanMode("camera");
              if (cameraActive) stopCamera();
            }}
          >
            📷 Camera
          </button>
          <button
            className={`tab ${scanMode === "file" ? "active" : ""}`}
            onClick={() => {
              setScanMode("file");
              if (cameraActive) stopCamera();
            }}
          >
            📁 File Upload
          </button>
          <button
            className={`tab ${scanMode === "manual" ? "active" : ""}`}
            onClick={() => {
              setScanMode("manual");
              if (cameraActive) stopCamera();
            }}
          >
            ⌨️ Manual
          </button>
        </div>

        <div className="qr-scanner-container">
          {/* Camera Mode */}
          {scanMode === "camera" && (
            <div>
              <div
                id="qr-reader"
                style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}
              ></div>
              {!cameraActive ? (
                <button onClick={startCamera} style={{ marginTop: 16 }}>
                  Start Camera
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="secondary"
                  style={{ marginTop: 16 }}
                >
                  Stop Camera
                </button>
              )}
              <p className="text-muted text-center" style={{ marginTop: 8 }}>
                Point camera at QR code to scan
              </p>
            </div>
          )}

          {/* File Upload Mode */}
          {scanMode === "file" && (
            <div>
              <div id="qr-reader-file" style={{ display: "none" }}></div>
              <label
                className="file-upload-label"
                style={{
                  display: "block",
                  padding: 40,
                  border: "2px dashed var(--border)",
                  borderRadius: 8,
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                <p style={{ margin: 0 }}>📁 Click to upload QR code image</p>
                <p className="text-muted" style={{ marginTop: 8 }}>
                  Supports PNG, JPG, etc.
                </p>
              </label>
            </div>
          )}

          {/* Manual Mode */}
          {scanMode === "manual" && (
            <div>
              <p style={{ marginBottom: 16 }}>
                Enter Ticket ID or paste full QR code data
              </p>
              <div
                className="form-row"
                style={{ maxWidth: 500, margin: "0 auto" }}
              >
                <input
                  type="text"
                  placeholder="FEST-xxxxxxxx-xxxx-xxxx..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleManualScan()}
                />
                <button onClick={handleManualScan} style={{ width: "auto" }}>
                  Verify
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        {/* Scan Result */}
        {scanResult && (
          <div
            className={`qr-result ${scanResult.success ? "success" : "error"}`}
          >
            {scanResult.success ? (
              <>
                <h4 style={{ color: "var(--success)", margin: 0 }}>
                  ✓ Entry Allowed
                </h4>
                <p>
                  <strong>Participant:</strong> {scanResult.participant?.name}
                </p>
                <p>
                  <strong>Email:</strong> {scanResult.participant?.email}
                </p>
                <p>
                  <strong>Scanned at:</strong>{" "}
                  {new Date(scanResult.scanned_at).toLocaleString()}
                </p>
              </>
            ) : (
              <>
                <h4 style={{ color: "var(--error)", margin: 0 }}>
                  ✗ {scanResult.duplicate ? "Duplicate Scan" : "Entry Denied"}
                </h4>
                <p>{scanResult.message}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Attendance Lists */}
      <div className="card">
        <div
          className="flex justify-between items-center"
          style={{ marginBottom: 16 }}
        >
          <h3 style={{ margin: 0 }}>Attendance Dashboard</h3>
          <button onClick={exportCSV} className="secondary">
            Export CSV
          </button>
        </div>

        <h4>Not Yet Scanned ({dashboard?.notYetScanned?.length || 0})</h4>
        {dashboard?.notYetScanned?.length === 0 ? (
          <p className="empty-state">All participants have been checked in!</p>
        ) : (
          <ul>
            {dashboard?.notYetScanned?.map((entry) => (
              <li key={entry.registrationId}>
                <div className="flex justify-between items-center">
                  <div>
                    <strong>
                      {entry.participant?.first_name}{" "}
                      {entry.participant?.last_name}
                    </strong>
                    <p style={{ margin: 0 }}>{entry.participant?.email}</p>
                    <span className="badge badge-neutral">
                      Ticket: {entry.ticketId || "N/A"}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleManualOverride(entry.registrationId, true)
                    }
                    className="success small"
                  >
                    Manual Check-in
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h4 style={{ marginTop: 24 }}>
          Checked In ({dashboard?.attendees?.length || 0})
        </h4>
        {dashboard?.attendees?.length === 0 ? (
          <p className="empty-state">No participants checked in yet.</p>
        ) : (
          <ul>
            {dashboard?.attendees?.slice(0, 10).map((entry) => (
              <li key={entry.registrationId}>
                <div className="flex justify-between items-center">
                  <div>
                    <strong>
                      {entry.participant?.first_name}{" "}
                      {entry.participant?.last_name}
                    </strong>
                    <p style={{ margin: 0 }}>{entry.participant?.email}</p>
                    <span className="badge badge-success">
                      Scanned:{" "}
                      {entry.scanned_at
                        ? new Date(entry.scanned_at).toLocaleString()
                        : "Manual"}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleManualOverride(entry.registrationId, false)
                    }
                    className="danger small"
                  >
                    Undo
                  </button>
                </div>
              </li>
            ))}
            {dashboard?.attendees?.length > 10 && (
              <p className="text-muted text-center">
                ...and {dashboard.attendees.length - 10} more
              </p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default QRScanner;
