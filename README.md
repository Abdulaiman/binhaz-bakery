# BINHAZ PREMIUM BAKERY — Management System

A production-ready Progressive Web App for bakery management with multi-tenant branch support, employee tracking, attendance, and payroll.

## Tech Stack

- **Frontend:** React 18 + Vite + PWA (vite-plugin-pwa)
- **Backend:** Node.js + Express
- **Database:** SQLite + Prisma ORM
- **Auth:** JWT + bcryptjs (pure JS)
- **Deployment:** Docker ready

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Backend Setup

```bash
cd server
npm install
cp .env .env.local  # Edit as needed

# Push database schema & seed SUPER_ADMIN
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

- **Email:** `admin@binhaz.com`
- **Password:** `Admin@123`
- You will be prompted to change your password on first login.

---

## Environment Variables

| Variable               | Default              | Description                    |
| ---------------------- | -------------------- | ------------------------------ |
| `DATABASE_URL`         | `file:./dev.db`      | SQLite database path           |
| `JWT_SECRET`           | (set in .env)        | Secret for JWT signing         |
| `PORT`                 | `4000`               | API server port                |
| `SUPER_ADMIN_EMAIL`    | `admin@binhaz.com`   | Initial admin email            |
| `SUPER_ADMIN_PASSWORD` | `Admin@123`          | Initial admin password         |

---

## API Endpoints

| Method | Endpoint                    | Auth          | Description                |
| ------ | --------------------------- | ------------- | -------------------------- |
| POST   | `/api/auth/login`           | Public        | Login                      |
| POST   | `/api/auth/change-password` | Authenticated | Change password            |
| GET    | `/api/dashboard`            | Authenticated | Dashboard stats            |
| POST   | `/api/users`                | Admin+        | Create admin user          |
| GET    | `/api/users`                | Admin+        | List users                 |
| POST   | `/api/branches`             | SUPER_ADMIN   | Create branch              |
| GET    | `/api/branches`             | Authenticated | List branches              |
| POST   | `/api/employees`            | Admin+        | Create employee            |
| GET    | `/api/employees`            | Authenticated | List employees             |
| PUT    | `/api/employees/:id`        | Admin+        | Update employee            |
| DELETE | `/api/employees/:id`        | Admin+        | Soft delete employee       |
| POST   | `/api/attendance`           | Admin+        | Bulk mark attendance       |
| GET    | `/api/attendance`           | Authenticated | Get attendance by date     |
| POST   | `/api/attendance/lock`      | Admin+        | Lock attendance for a day  |
| POST   | `/api/payroll/generate`     | Admin+        | Generate monthly payroll   |
| GET    | `/api/payroll`              | Authenticated | Get payroll data           |
| GET    | `/api/audit-logs`           | Admin+        | Paginated audit logs       |

---

## Docker Deployment

### Build & Run

```bash
docker-compose up --build
```

The app will be available at http://localhost:4000 (front-end is served by the backend in production mode).

### Render Deployment

1. Push code to a Git repository
2. Create a new **Web Service** on [Render](https://render.com)
3. Set build command: `docker build -t binhaz .`
4. Set start command: `docker run -p 4000:4000 binhaz`
5. Add environment variables in Render dashboard
6. Add a persistent disk mounted at `/app/server/data`

### Vercel Deployment (Frontend only)

1. Deploy the `client/` folder to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Set environment variable for API URL (point to your backend host)
5. Deploy the backend separately (Render, Railway, etc.)

---

## Roles

| Role         | Capabilities                                          |
| ------------ | ----------------------------------------------------- |
| SUPER_ADMIN  | Full access: branches, all employees, all payrolls    |
| ADMIN        | Branch-scoped: own employees, attendance, payroll     |

---

## PWA Features

- ✅ Installable on mobile/desktop
- ✅ Offline attendance marking with queue
- ✅ Background sync when connection restores
- ✅ Cached static assets and API responses

---

## Project Structure

```
binhaz/
├── server/                  # Express backend
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.js          # Seed SUPER_ADMIN
│   ├── src/
│   │   ├── index.js         # Server entry
│   │   ├── middleware/       # Auth + RBAC
│   │   ├── routes/           # API routes
│   │   └── lib/              # Prisma client + audit helper
│   └── package.json
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── pages/           # All page components
│   │   ├── components/      # Layout, Sidebar, ProtectedRoute
│   │   ├── context/         # AuthContext
│   │   ├── utils/           # API client + offline queue
│   │   └── index.css        # Design system
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```
