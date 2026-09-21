# CivixAI

Agentic AI for Civic Issue Resolution — Ichalkaranji Municipal Corporation, Maharashtra, India

**Download APK:** https://drive.google.com/drive/folders/1-fEsYer28j4Znnks1D6DLUa7r8Xjgz4Y?usp=sharing

**Admin Web Link:** https://civix-ai-admin.vercel.app/

## Demo Video
https://github.com/user-attachments/assets/c42a0b31-dcee-4272-b205-3e9bb19d0065

---

## Overview

CivixAI is a full-stack platform that enables citizens to report municipal issues, track their resolution, and gives administrators real-time visibility — powered by AI for automated issue detection and completion verification.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 6, Django REST Framework, SimpleJWT |
| Database | Neon PostgreSQL (prod) / SQLite (dev) |
| Media Storage | Cloudinary (prod) / Local filesystem (dev) |
| Mobile App | React Native (Expo SDK 55) |
| Admin Dashboard | React 19, Vite 7, Tailwind CSS 3 |
| AI | Google Gemini (`gemini-flash-lite-latest`) |

## Project Structure

```
CivixAI/
├── backend/          Django REST API
│   ├── accounts/     User model, auth, registration
│   ├── issues/       Issue model, CRUD, assignments
│   ├── bins/         Garbage bin tracking
│   ├── ai/           Gemini AI integration (detect, verify, preview)
│   ├── agent/        Agentic AI orchestration, traces, monitoring
│   ├── analytics/    Dashboard stats, ward/category/resolution trends
│   └── civixai/      Settings, URLs, WSGI
├── client-app/       React Native mobile app (Expo)
├── frontend-admin/   React admin dashboard (Vite)
└── README.md
```

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in values
python manage.py migrate
python manage.py seed_demo_data   # optional: seed demo data
python manage.py runserver
```

### Admin Dashboard

```bash
cd frontend-admin
npm install
npm run dev          # starts on http://localhost:5173
```

### Mobile App

```bash
cd client-app
npm install
npx expo start       # scan QR with Expo Go
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Django secret key |
| `DEBUG` | No | `True` (dev) or `False` (prod). Default: `True` |
| `ALLOWED_HOSTS` | No | Comma-separated domains. Default: `localhost,127.0.0.1` |
| `DATABASE_URL` | No | Neon PostgreSQL URL. Leave empty for local SQLite |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name. Leave empty for local filesystem |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated frontend origins (e.g. `https://civix-ai-admin.vercel.app`) |
| `SECURE_SSL_REDIRECT` | No | `True` for production. Default: `False` |

### Mobile App (`client-app/.env`)

```
EXPO_PUBLIC_API_URL=https://civixai-codeakatsuki.onrender.com/api
```

### Admin Dashboard (`frontend-admin/.env`)

```
VITE_API_BASE_URL=https://civixai-codeakatsuki.onrender.com
```

## Deployment

### Backend (Render)

1. Push to GitHub
2. Create a Render Web Service from the `backend/` directory
3. Set environment variables on Render dashboard:
   - `SECRET_KEY`, `DEBUG=False`, `GEMINI_API_KEY`
   - `DATABASE_URL` (Neon PostgreSQL connection string)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `ALLOWED_HOSTS=localhost,127.0.0.1,civixai-codeakatsuki.onrender.com`
   - `CORS_ALLOWED_ORIGINS=https://civix-ai-admin.vercel.app`
4. Render runs `python manage.py migrate` on deploy

### Admin Dashboard (Vercel)

1. Set root directory to `frontend-admin`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variable: `VITE_API_BASE_URL=https://civixai-codeakatsuki.onrender.com`

### Mobile App (APK)

```bash
cd client-app
npx expo install expo-dev-client
npx expo run:android    # requires Android SDK
# or
eas build --platform android
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login/` | POST | Login (returns access + refresh tokens) |
| `/api/auth/register/` | POST | Register citizen/worker |
| `/api/auth/me/` | GET | Current user profile |
| `/api/auth/workers/` | GET | List workers |
| `/api/issues/` | GET/POST | List/create issues |
| `/api/issues/{id}/` | GET/PATCH | Issue detail/update |
| `/api/ai/detect-issue/` | POST | AI issue detection from image |
| `/api/ai/verify-completion/` | POST | AI completion verification |
| `/api/ai/preview-completion/` | POST | AI preview completion |
| `/api/agent/process-complaint/{id}/` | POST | Trigger agent analysis |
| `/api/agent/trace/{id}/` | GET | Agent trace for issue |
| `/api/agent/status/{id}/` | GET | Agent status for issue |
| `/api/analytics/dashboard-stats/` | GET | Dashboard statistics |
| `/api/analytics/wards/` | GET | Ward-wise analytics |
| `/api/analytics/category-trend/` | GET | Category trend data |
| `/api/analytics/resolution-trend/` | GET | Resolution trend data |

## Demo Credentials

### Admin
- `admin@civixai.gov.in` / `admin1234`

### Citizens
| Email | Password |
|-------|----------|
| `priya.sharma@example.com` | `Civix@2024` |
| `amit.jadhav@example.com` | `Civix@2024` |
| `meena.patil@example.com` | `Civix@2024` |
| `rahul.desai@example.com` | `Civix@2024` |

### Workers
| Email | Password | Category |
|-------|----------|----------|
| `suresh.kumar@ichalkaranji.gov.in` | `Civix@2024` | Water |
| `anjali.more@ichalkaranji.gov.in` | `Civix@2024` | Sanitation |
| `vijay.sangle@ichalkaranji.gov.in` | `Civix@2024` | Road |
| `kavita.bhosale@ichalkaranji.gov.in` | `Civix@2024` | Electricity |
| `prakash.gaikwad@ichalkaranji.gov.in` | `Civix@2024` | Traffic |
| `sneha.jadhav@ichalkaranji.gov.in` | `Civix@2024` | Public Facilities |
| `manoj.shinde@ichalkaranji.gov.in` | `Civix@2024` | Road |
| `pooja.patil@ichalkaranji.gov.in` | `Civix@2024` | Water |

### Seed Demo Data

```bash
cd backend
python manage.py seed_demo_data
```

Idempotent — safe to run multiple times. Only seeds when `DATABASE_URL` is configured (Neon PostgreSQL).

## License

MIT
