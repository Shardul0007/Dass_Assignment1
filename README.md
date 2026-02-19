# Event Management System - DASS Assignment 1

## Student Info

- **Roll Number:** 2024101077

---

## Table of Contents

1. [Libraries & Frameworks](#libraries--frameworks)
2. [Advanced Features Implemented](#advanced-features-implemented-part-2---30-marks)
3. [Setup & Installation](#setup--installation-instructions)
4. [Project Structure](#project-structure)
5. [API Endpoints](#api-endpoints)
6. [Marks Breakdown](#total-marks-breakdown)

---

## Libraries & Frameworks

### Backend Libraries

| Library          | Version | Purpose               | Justification                                                                                                                                                |
| ---------------- | ------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Express.js**   | 4.18.2  | Web framework         | Industry-standard Node.js framework. Minimal, flexible, and well-documented. Provides robust routing, middleware support, and easy REST API creation.        |
| **Mongoose**     | 8.0.0   | MongoDB ODM           | Provides schema validation, type casting, query building, and business logic hooks. Makes MongoDB operations safe and predictable with model-based approach. |
| **bcryptjs**     | 3.0.3   | Password hashing      | Secure password hashing with salt rounds. Pure JavaScript implementation works everywhere without native dependencies.                                       |
| **jsonwebtoken** | 9.0.2   | JWT authentication    | Stateless authentication tokens for API security. Widely adopted standard (RFC 7519) for secure token-based auth.                                            |
| **Socket.IO**    | 4.8.3   | WebSocket server      | Real-time bidirectional communication for discussion forum. Handles fallback to polling, reconnection, and room-based messaging out of the box.              |
| **nodemailer**   | 6.9.7   | Email sending         | Sends ticket confirmations, password reset emails. Supports multiple transports (SMTP, Gmail) with simple configuration.                                     |
| **qrcode**       | 1.5.3   | QR code generation    | Generates QR codes for tickets. Small, fast, and produces both data URLs and PNG buffers.                                                                    |
| **uuid**         | 9.0.1   | Unique ID generation  | Generates unique ticket IDs. RFC-compliant UUIDs ensure no collisions.                                                                                       |
| **cors**         | 2.8.5   | CORS middleware       | Enables cross-origin requests from frontend. Simple configuration for allowed origins, methods, and headers.                                                 |
| **dotenv**       | 16.3.1  | Environment variables | Loads `.env` configuration. Keeps secrets out of code; standard practice for configuration management.                                                       |

### Frontend Libraries

| Library              | Version | Purpose             | Justification                                                                                                                                    |
| -------------------- | ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **React**            | 18.2.0  | UI library          | Component-based architecture with virtual DOM. Industry standard with vast ecosystem, hooks for state management, and excellent developer tools. |
| **React Router DOM** | 6.20.0  | Client-side routing | Declarative routing with nested routes, protected routes, and URL parameters. Enables SPA navigation without page reloads.                       |
| **Socket.IO Client** | 4.7.2   | WebSocket client    | Pairs with backend Socket.IO for real-time discussion. Automatic reconnection, event-based messaging, room support.                              |
| **html5-qrcode**     | 2.3.8   | QR code scanning    | Camera-based QR scanning for attendance. Supports multiple cameras, file upload, and works across browsers without plugins.                      |
| **React Scripts**    | 5.0.1   | Build tooling       | Zero-config Webpack/Babel setup from Create React App. Handles bundling, hot reload, and production builds.                                      |

### Why No UI Framework (Tailwind/Bootstrap/Material-UI)?

- **Minimal dependencies**: Reduces bundle size and potential security vulnerabilities
- **Full control**: Custom CSS allows exact styling without fighting framework defaults
- **Learning focus**: Demonstrates understanding of CSS fundamentals
- **Lightweight**: No overhead from unused components; only styles actually needed are included

---

## Advanced Features Implemented (Part 2 - 30 Marks)

### Feature Selection Justification

I selected features that **build upon each other** and the existing base features:

- **QR Attendance** extends the existing QR ticket generation
- **Merch Payment Workflow** extends the existing merchandise event type
- **Discussion Forum** adds value to event registration
- **Password Reset** completes the authentication system
- **Feedback** provides closure for completed events

---

### Tier A Features (2 × 8 = 16 Marks)

#### 1. QR Code Based Attendance Marking with Manual Overrides [8 Marks]

**Location:**

- Backend: `backend/src/routes/organizer.js` (lines 665-950)
- Frontend: `frontend/src/pages/QRScanner.js`

**Design Choices:**

| Decision             | Choice                                 | Reasoning                                                                             |
| -------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| Scanning library     | html5-qrcode                           | Works on mobile/desktop, supports both camera and file upload, no native dependencies |
| QR data format       | JSON with ticketId, participant, event | Self-contained verification - no database lookup needed for basic validation          |
| Duplicate prevention | Database flag `attendance: true`       | Prevents double-scanning; persists across sessions                                    |
| Manual override      | Separate API with audit log            | Accountability - tracks who overrode, when, and why                                   |

**Implementation Approach:**

1. **Camera scanning**: Initialize html5-qrcode with device camera, decode on detection
2. **Validation flow**: Parse QR JSON → Verify ticket exists → Check not already scanned → Mark attendance
3. **Dashboard**: Real-time stats fetched from aggregation query counting `attendance: true`
4. **CSV export**: Server-side CSV generation with all participant details for offline records

**Technical Decisions:**

- QR payload includes participation details to enable offline validation scenarios
- Audit log stored in ticket document as embedded array (not separate collection) for atomic updates
- Used MongoDB aggregation for attendance statistics to handle large participant counts efficiently

---

#### 2. Merchandise Payment Approval Workflow for Organizers [8 Marks]

**Location:**

- Backend: `backend/src/routes/organizer.js`, `backend/src/routes/participant.js`
- Frontend: `frontend/src/pages/MerchOrders.js`, `frontend/src/pages/Eventdetails.js`

**Design Choices:**

| Decision              | Choice                               | Reasoning                                                   |
| --------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Payment proof storage | Base64 in registration document      | Simple, no file server needed; bounded by 2MB limit         |
| State machine         | pending_approval → approved/rejected | Clear workflow; prevents race conditions                    |
| Stock management      | Decrement only on approval           | Prevents overselling; atomic operation                      |
| QR generation         | Only after approval                  | Ensures no valid ticket exists without payment verification |

**Implementation Approach:**

1. **Order placement**: Participant uploads proof → Creates registration with `merch_payment_status: "pending_approval"`
2. **Organizer review**: Fetches all orders with proof images, displays in tabbed interface
3. **Approval flow**:
   - Validates stock available
   - Atomically decrements stock
   - Generates ticket with QR code
   - Sends confirmation email
   - Updates status to `approved`
4. **Rejection flow**: Updates status, stores reason, no stock/ticket changes

**Technical Decisions:**

- Used MongoDB `findOneAndUpdate` with `$inc: {-qty}` for atomic stock decrement
- Image stored as base64 data URL to avoid file upload complexity
- Separate `merch_payment_status` field (not reusing `payment_status`) for clear distinction

---

### Tier B Features (2 × 6 = 12 Marks)

#### 3. Organizer Password Reset Workflow [6 Marks]

**Location:**

- Backend: `backend/src/routes/user.js`, `backend/src/routes/admin.js`
- Model: `backend/src/models/passwordResetRequestModel.js`
- Frontend: `frontend/src/pages/PasswordResetRequests.js`, `frontend/src/pages/login.js`

**Design Choices:**

| Decision           | Choice                    | Reasoning                                               |
| ------------------ | ------------------------- | ------------------------------------------------------- |
| Request initiation | From login page (no auth) | Locked-out users can't authenticate; must be accessible |
| Verification       | Admin approval required   | Prevents unauthorized resets; human verification        |
| New password       | Auto-generated, emailed   | Secure temporary password; user can change later        |
| Request storage    | Separate collection       | Clean data model; easy querying and status tracking     |

**Implementation Approach:**

1. **Request submission**: Organizer enters club name and reason on login page
2. **Admin review**: Admin sees all pending requests with details
3. **Approval**:
   - Generate 10-character random password
   - Hash and update organizer's password
   - Email new password to organizer
   - Update request status to `approved`
4. **Rejection**: Update status with admin's reason

**Technical Decisions:**

- Used `crypto.randomBytes()` for secure password generation
- Password shown to admin once (for phone support scenarios)
- Requests retained permanently for audit trail

---

#### 4. Real-Time Discussion Forum for Events [6 Marks]

**Location:**

- Backend: `backend/index.js` (Socket.IO), `backend/src/routes/participant.js`, `backend/src/routes/organizer.js`
- Model: `backend/src/models/discussionModel.js`
- Frontend: `frontend/src/pages/EventDiscussion.js`, `frontend/src/services/NotificationContext.js`

**Design Choices:**

| Decision           | Choice                        | Reasoning                                                                           |
| ------------------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| Real-time protocol | Socket.IO                     | Handles WebSocket with polling fallback; built-in rooms for event-specific channels |
| Message threading  | Parent reference in document  | Simple tree structure; enables collapse/expand                                      |
| Notifications      | Global context with bell icon | Users notified of activity in subscribed events even when on other pages            |
| Moderation         | Soft delete + pin             | Preserves conversation flow; highlights important messages                          |

**Implementation Approach:**

1. **Connection**: On page load, connect to Socket.IO and join event room
2. **Messaging**: POST message → Server saves → Emits to room → All clients append
3. **Threading**: Messages reference `parent_message` → Frontend builds tree → Renders nested
4. **Reactions**: Click emoji → Server updates array → Broadcasts to room
5. **Global notifications**: Separate context maintains socket for all subscribed events

**Technical Decisions:**

- Used Socket.IO rooms (not broadcast) to limit messages to event participants
- Stored reactions as array `[{user, emoji}]` to prevent duplicates per user
- Announcements auto-pin and emit special event for highlighted notification
- Message tree built client-side from flat array for simpler backend

---

### Tier C Features (1 × 2 = 2 Marks)

#### 5. Anonymous Feedback System for Events [2 Marks]

**Location:**

- Backend: `backend/src/routes/participant.js`, `backend/src/routes/organizer.js`
- Model: `backend/src/models/feedbackModel.js`
- Frontend: `frontend/src/pages/EventFeedback.js`, `frontend/src/pages/Eventdetails.js`

**Design Choices:**

| Decision   | Choice                                 | Reasoning                                 |
| ---------- | -------------------------------------- | ----------------------------------------- |
| Anonymity  | No author shown to organizer           | Encourages honest feedback                |
| Validation | One feedback per participant per event | Compound unique index prevents duplicates |
| Visibility | Only for completed events              | Feedback makes sense after event ends     |
| Display    | Star rating distribution + comments    | Visual summary with detailed breakdowns   |

**Implementation Approach:**

1. **Submission**: Form appears on event page when event is closed
2. **Storage**: Rating (1-5) and optional comment saved with participant reference
3. **Display**: Organizer sees count per rating, average, and anonymous comments

---

## Setup & Installation Instructions

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### Environment Variables

Create `backend/.env`:

```env
PORT=3500
MONGO_URL=mongodb://localhost:27017/event_management
JWT_SECRET=your_jwt_secret_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

Create `frontend/.env` (optional, defaults to localhost:3500):

```env
REACT_APP_API_BASE=http://localhost:3500
```

### Installation Steps

```bash
# 1. Clone/extract the project
cd 2024101077

# 2. Install and start backend
cd backend
npm install
npm start
# Server runs on http://localhost:3500

# 3. Install and start frontend (new terminal)
cd ../frontend
npm install
npm start
# App runs on http://localhost:3000
```

### Default Admin Account

- Email: `admin@admin.com`
- Password: `admin123`

---

## Project Structure

```
2024101077/
├── README.md
├── deployment.txt
├── features.txt
├── backend/
│   ├── index.js                 # Express + Socket.IO server
│   ├── package.json
│   └── src/
│       ├── controller/          # Route handlers
│       ├── middleware/
│       │   └── auth.js          # JWT authentication
│       ├── models/
│       │   ├── userModel.js
│       │   ├── eventModel.js
│       │   ├── registrationModel.js
│       │   ├── ticketModel.js
│       │   ├── feedbackModel.js         # [NEW] Feedback
│       │   ├── discussionModel.js       # [NEW] Discussion
│       │   └── passwordResetRequestModel.js  # [NEW] Password reset
│       ├── routes/
│       │   ├── user.js          # Auth routes
│       │   ├── admin.js         # Admin operations
│       │   ├── organizer.js     # Organizer operations
│       │   ├── participant.js   # Participant operations
│       │   └── events.js        # Public event routes
│       └── utils/
│           ├── sendTicketEmail.js
│           └── sendPasswordResetEmail.js  # [NEW]
└── frontend/
    ├── package.json
    └── src/
        ├── App.js               # Routes configuration
        ├── index.js
        ├── index.css            # Global styles
        ├── components/
        │   └── ProtectedRoutes.js
        ├── pages/
        │   ├── login.js
        │   ├── Signup.js
        │   ├── Events.js
        │   ├── Eventdetails.js
        │   ├── ParticipantDashboard.js
        │   ├── OrganizerDashboard.js
        │   ├── AdminDashboard.js
        │   ├── QRScanner.js             # [NEW] Attendance
        │   ├── MerchOrders.js           # [NEW] Payment approval
        │   ├── EventFeedback.js         # [NEW] Feedback view
        │   ├── EventDiscussion.js       # [NEW] Real-time chat
        │   ├── PasswordResetRequests.js # [NEW] Admin reset page
        │   └── ...
        └── services/
            ├── api.js           # API helper
            ├── storage.js       # localStorage wrapper
            ├── NavBar.js        # Navigation with notifications
            └── NotificationContext.js  # [NEW] Global notifications
```

---

## API Endpoints

### Authentication

- `POST /api/users/signup` - Register new participant
- `POST /api/users/login` - Login (all roles)
- `POST /api/users/forgot-password` - Request password reset (organizers)

### Participant Routes

- `GET /api/participant/my-events` - Get registered events
- `GET /api/participant/my-registrations` - Get all registrations
- `POST /api/participant/register-event` - Register for Normal event
- `POST /api/participant/purchase-merchandise` - Buy merchandise (instant)
- `POST /api/participant/place-merchandise-order` - Order merch with payment proof
- `DELETE /api/participant/cancel-registration/:eventId` - Cancel registration
- `POST /api/participant/feedback` - Submit event feedback
- `GET /api/participant/event/:eventId/discussion` - Get discussion messages
- `POST /api/participant/event/:eventId/discussion` - Post message
- `POST /api/participant/discussion/:messageId/react` - Add reaction

### Organizer Routes

- `POST /api/organizer/create-event` - Create new event
- `PATCH /api/organizer/event/:id` - Update event
- `DELETE /api/organizer/event/:id` - Delete event
- `PATCH /api/organizer/event/:id/status` - Change event status
- `POST /api/organizer/scan-qr` - Scan ticket QR
- `GET /api/organizer/event/:id/attendance-dashboard` - Attendance stats
- `GET /api/organizer/event/:id/attendance-csv` - Export CSV
- `PATCH /api/organizer/event/:id/manual-attendance` - Override attendance
- `GET /api/organizer/merch-orders` - View merchandise orders
- `PATCH /api/organizer/merch-order/:id/approve` - Approve order
- `PATCH /api/organizer/merch-order/:id/reject` - Reject order
- `GET /api/organizer/event/:id/feedback` - View feedback
- `POST /api/organizer/event/:id/discussion` - Post message/announcement
- `PATCH /api/organizer/discussion/:messageId/pin` - Pin/unpin
- `DELETE /api/organizer/discussion/:messageId` - Delete message

### Admin Routes

- `POST /api/admin/create-organizer` - Create organizer account
- `GET /api/admin/password-reset-requests` - View reset requests
- `POST /api/admin/password-reset-requests/:id/approve` - Approve reset
- `POST /api/admin/password-reset-requests/:id/reject` - Reject reset

### WebSocket Events (Socket.IO)

- `join-event` - Join event room for real-time updates
- `leave-event` - Leave event room
- `new-message` - Emitted when new message posted
- `new-announcement` - Emitted when organizer posts announcement
- `reaction-update` - Emitted when reaction is added/removed
- `message-pinned` - Emitted when message pin status changes
- `message-deleted` - Emitted when message is deleted

---

## Total Marks Breakdown

| Tier      | Feature                                  | Marks  |
| --------- | ---------------------------------------- | ------ |
| A         | QR Code Attendance with Manual Overrides | 8      |
| A         | Merchandise Payment Approval Workflow    | 8      |
| B         | Organizer Password Reset Workflow        | 6      |
| B         | Real-Time Discussion Forum               | 6      |
| C         | Anonymous Feedback System                | 2      |
| **Total** |                                          | **30** |

---

## Notes

- All features are fully functional with both frontend and backend implementations
- Real-time features require the backend WebSocket server to be running
- Email features require valid SMTP credentials in `.env`
- QR scanning works best on devices with cameras (mobile/laptop webcam)
