# BINHAZ PREMIUM BAKERY — Management System

A production-ready Progressive Web App for bakery management with multi-tenant branch support, employee tracking, attendance, and payroll.

## Key Features

- **Shift Management**: Assign employees to Morning, Evening, or Both shifts.
- **Enhanced Attendance**: Track specific bakery tasks (Mixing, Baking, etc.) and add custom remarks per entry.
- **Advanced Search**: Filter attendance records by employee, shift, task, branch, and date range.
- **Dual PDF Reporting**: Generate compact **Summary** or comprehensive **Detailed** payroll reports.
- **PWA Ready**: Installable on mobile/desktop with offline attendance marking support.

## Tech Stack

- **Frontend:** React 18 + Vite + PWA (vite-plugin-pwa)
- **Backend:** Node.js + Express
- **Database:** SQLite + Prisma ORM
- **Auth:** JWT + bcryptjs (pure JS)
- **Reporting:** jsPDF + autoTable

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker (optional)

### 1. Backend Setup

```bash
cd server
npm install
cp .env .env.local  # Edit as needed

# Push database schema, seed SUPER_ADMIN & Default Task Types
npx prisma db push
node prisma/seed.js
```

### 2. Frontend Setup

```bash
cd client
npm install
```

### 3. Run Development

Start both servers:

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

### 4. Login

- **Email:** `admin@binhaz.com` (default)
- **Password:** `Admin@123` (default)
- You will be prompted to change your password on first login.

---

## API Endpoints

| Method | Endpoint                        | Auth          | Description                          |
| ------ | ------------------------------- | ------------- | ------------------------------------ |
| POST   | `/api/auth/login`               | Public        | Login                                |
| POST   | `/api/auth/change-password`     | Authenticated | Change password                      |
| GET    | `/api/dashboard`                | Authenticated | Dashboard stats                      |
| POST   | `/api/users`                    | Admin+        | Create admin user                    |
| GET    | `/api/users`                    | Admin+        | List users                           |
| POST   | `/api/branches`                 | SUPER_ADMIN   | Create branch                        |
| GET    | `/api/branches`                 | Authenticated | List branches                        |
| POST   | `/api/employees`                | Admin+        | Create employee (with shift)         |
| GET    | `/api/employees`                | Authenticated | List employees                       |
| POST   | `/api/attendance`               | Admin+        | Bulk mark (with shift/task/remark)   |
| GET    | `/api/attendance`               | Authenticated | Get attendance by date/shift         |
| GET    | `/api/attendance/search`        | Authenticated | Advanced filterable search           |
| POST   | `/api/attendance/lock`          | Admin+        | Lock attendance for a day            |
| GET    | `/api/task-types`               | Authenticated | List preset tasks (Mixing, etc.)     |
| POST   | `/api/payroll/generate`         | SUPER_ADMIN   | Generate payroll (optional shift)    |
| GET    | `/api/payroll`                  | Authenticated | Get payroll data                     |
| GET    | `/api/payroll/:id/detailed-data`| SUPER_ADMIN   | Get full data for detailed PDF       |
| GET    | `/api/audit-logs`               | SUPER_ADMIN   | Paginated audit logs                 |

---

## Docker Deployment (Production)

### Build & Run

```bash
docker compose up --build -d
```

The app will be available at **http://localhost:4000**.
In production mode, the backend serves the optimized React frontend.

---

## Roles

| Role         | Capabilities                                          |
| ------------ | ----------------------------------------------------- |
| SUPER_ADMIN  | Full access: branches, all employees, all payrolls    |
| ADMIN        | Branch-scoped: own employees, attendance entry        |

---

## Project Structure

```
binhaz/
├── server/                  # Express backend
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.js          # Seed Admin + Task Types
│   ├── src/
│   │   ├── index.js         # Server entry
│   │   ├── routes/           # API routes (employees, attendance, etc)
│   │   └── lib/              # Prisma client + audit helper
│   └── package.json
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── pages/           # Components like Attendance, Payroll, Search
│   │   ├── utils/           # API client + offline queue
│   │   └── index.css        # Premium Design System
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```
