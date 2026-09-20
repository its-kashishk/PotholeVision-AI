# 🛣️ PotholeVision AI
### Intelligent Road Damage Detection & Reporting System

> **1M1B AI for Sustainability Virtual Internship** · IBM SkillsBuild × AICTE  
> Primary SDG: **SDG 11** – Sustainable Cities and Communities  
> Secondary: **SDG 9** (Innovation & Infrastructure) · **SDG 13** (Climate Action)

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Features](#-features)
3. [Tech Stack](#-tech-stack)
4. [Prerequisites](#-prerequisites)
5. [Installation & Setup](#-installation--setup)
6. [Environment Variables](#-environment-variables)
7. [Running the Project](#-running-the-project)
8. [Demo Accounts](#-demo-accounts)
9. [API Endpoints](#-api-endpoints)
10. [Project Structure](#-project-structure)
11. [AI Architecture](#-ai-architecture)
12. [Responsible AI](#-responsible-ai)
13. [Deployment](#-deployment)

---

## 🎯 Project Overview

PotholeVision AI is a full-stack web application that empowers citizens to report road hazards and helps municipalities respond faster using AI-powered analysis. The system uses a YOLOv8 computer-vision model (fine-tuned by a third party on the RDD2022 road-damage dataset) to detect potholes and cracks, and Groq-hosted Llama 3 8B to generate explanations, safety precautions, and answer questions about road safety.

**Problem:** Poor road conditions cause 30%+ of road accidents in India, contributing to fuel wastage and increased carbon emissions.

**Solution:** AI-driven citizen reporting platform with automated road-damage detection, interactive hazard maps, municipality dashboards, and sustainability impact tracking.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Authentication | JWT-based login, registration, role-based access |
| 📷 Hazard Reporting | Photo upload, GPS capture, AI instant analysis |
| 🤖 AI Road Detection | Pothole and crack detection with confidence scores and bounding boxes |
| 💬 AI Assistant | Groq LLaMA3-8B chatbot for road safety Q&A |
| 🗺️ Hazard Map | Google Maps with severity filters & heatmap |
| 🏛️ Municipality Hub | Priority queue, bulk actions, analytics charts |
| 🌿 Sustainability | CO₂ tracking, SDG progress, environmental metrics |
| 📄 PDF Reports | AI-generated reports in municipality-ready format |
| 🌙 Dark/Light Mode | Full theme support with system preference detection |

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js + Express.js
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (jsonwebtoken) + bcryptjs
- **AI - Vision:** YOLOv8s road-damage detector (see `ml/README.md` for model card, accuracy caveats and licensing)
- **AI - LLM:** Groq LLaMA3-8B (via Groq Cloud API)
- **Storage:** Cloudinary (image uploads)
- **PDF:** PDFKit
- **Security:** Helmet, express-rate-limit, CORS

### Frontend
- **Framework:** React 18
- **Routing:** React Router v6
- **HTTP:** Axios
- **Charts:** Chart.js + react-chartjs-2
- **Maps:** Google Maps JavaScript API
- **Notifications:** React Toastify
- **Fonts:** Inter + Space Grotesk (Google Fonts)

---

## 📦 Prerequisites

Make sure these are installed before starting:

| Tool | Version | Download |
|---|---|---|
| Node.js | ≥ 18.x | https://nodejs.org |
| npm | ≥ 9.x | Comes with Node.js |
| MongoDB | ≥ 6.x | https://www.mongodb.com/try/download/community |
| Git | Any | https://git-scm.com |

**Optional (for full AI features):**
- Groq Cloud (free) → https://console.groq.com
- Cloudinary account → https://cloudinary.com/users/register_free
- Google Maps API key → https://console.cloud.google.com

---

## 🚀 Installation & Setup

### Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd potholevision
```

### Step 2: Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

Or from the root directory (if using root package.json):
```bash
npm run install:all
```

### Step 2.5: Set Up the Road-Damage Detection Model

The pothole/crack detector is a real YOLOv8 model, not simulated — it needs a one-time
Python setup and a ~90 MB weights download before report submission will work. See
[`ml/README.md`](ml/README.md) for full details, but the short version:

```bash
python3 -m venv ml/.venv
source ml/.venv/bin/activate            # Windows: ml\.venv\Scripts\activate
pip install -r ml/requirements.txt      # pulls PyTorch; several hundred MB
python ml/download_model.py             # downloads + SHA-256 verifies the weights
```

Without this step, `POST /api/reports` and `POST /api/ai/reanalyze/:id` will fail with
a `503 MODEL_UNAVAILABLE` error rather than silently faking a result.

### Step 3: Configure Environment Variables

#### Backend `.env`
```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in:
```env
PORT=5000
NODE_ENV=development

# MongoDB (local)
MONGODB_URI=mongodb://localhost:27017/potholevision

# OR MongoDB Atlas (cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/potholevision

# JWT Secret (use a long random string)
JWT_SECRET=change_this_to_a_very_long_random_secret_key_12345
JWT_EXPIRES_IN=7d

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Groq Cloud API (for LLaMA3 LLM)
GROQ_API_KEY=your_groq_api_key_here



# Frontend URL
FRONTEND_URL=http://localhost:3000
```

#### Frontend `.env`
```bash
cd frontend
cp .env.example .env
```

Open `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Step 4: Start MongoDB
```bash
# On macOS/Linux
mongod

# On Windows (run as Administrator)
net start MongoDB

# OR use MongoDB Atlas (cloud) — no local install needed
```

### Step 5: Seed the Database (Demo Data)
```bash
cd backend
node seed.js
```

This creates:
- 5 demo user accounts
- 40 sample road hazard reports across Indian cities
- Varied severity levels and statuses

---

## 🏃 Running the Project

### Development Mode (Two Terminals)

**Terminal 1 – Backend:**
```bash
cd backend
npm run dev
# Server starts on http://localhost:5000
```

**Terminal 2 – Frontend:**
```bash
cd frontend
npm start
# App opens on http://localhost:3000
```

### Production Mode
```bash
# Build frontend
cd frontend && npm run build

# Start backend (serves API)
cd ../backend && npm start
```

---

## 👤 Demo Accounts

After running `node seed.js`, use these credentials:

| Role | Email | Password |
|---|---|---|
| 👤 Citizen | citizen@demo.com | demo123456 |
| 🏛️ Municipality | municipality@demo.com | demo123456 |
| ⚙️ Admin | admin@demo.com | demo123456 |

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login + get JWT |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/me` | Update profile |

### Reports
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/reports` | Submit new report (multipart/form-data) |
| GET | `/api/reports` | Get all reports (filtered) |
| GET | `/api/reports/:id` | Get single report |
| PATCH | `/api/reports/:id/status` | Update status (municipality) |
| POST | `/api/reports/:id/upvote` | Upvote report |
| GET | `/api/reports/user/my-reports` | Get user's own reports |

### AI
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/chat` | Ask AI assistant |
| POST | `/api/ai/reanalyze/:reportId` | Re-run AI on report |
| GET | `/api/ai/summary/:reportId` | Get AI summary |

### Map
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/map/hazards` | GeoJSON hazards for map |
| GET | `/api/map/nearby` | Hazards near coordinates |
| GET | `/api/map/heatmap` | Heatmap data points |

### Municipality
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/municipality/analytics` | Dashboard analytics |
| GET | `/api/municipality/priority-queue` | Sorted report queue |
| PATCH | `/api/municipality/bulk-status` | Bulk status update |

### Sustainability
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sustainability/metrics` | Environmental metrics + SDG scores |

### PDF
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pdf/report/:reportId` | Download report PDF |
| GET | `/api/pdf/municipality-report` | Download bulk PDF |

---

## 📁 Project Structure

```
potholevision/
├── backend/
│   ├── config/
│   │   └── cloudinary.js        # Cloudinary + Multer config
│   ├── middleware/
│   │   └── auth.js              # JWT protect + restrictTo
│   ├── models/
│   │   ├── User.js              # User schema
│   │   └── Report.js            # Report schema with geo index
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── reports.js           # Report CRUD
│   │   ├── ai.js                # AI chat & analysis
│   │   ├── map.js               # Geospatial queries
│   │   ├── municipality.js      # Admin dashboard
│   │   ├── sustainability.js    # SDG metrics
│   │   └── pdf.js               # PDF generation
│   ├── services/
│   │   └── aiService.js         # YOLOv8 detection + Groq LLaMA3 integration
│   ├── seed.js                  # Database seeder
│   ├── server.js                # Express app entry
│   ├── .env.example             # Environment template
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── common/
│   │   │       └── Layout.js    # Sidebar + Topnav layout
│   │   ├── context/
│   │   │   ├── AuthContext.js   # Global auth state
│   │   │   └── ThemeContext.js  # Dark/light theme
│   │   ├── pages/
│   │   │   ├── LandingPage.js   # Public landing
│   │   │   ├── LoginPage.js     # Auth
│   │   │   ├── RegisterPage.js  # Auth
│   │   │   ├── Dashboard.js     # Citizen dashboard
│   │   │   ├── ReportPage.js    # Submit report
│   │   │   ├── ReportDetailPage.js # View + AI chat
│   │   │   ├── MapPage.js       # Google Maps view
│   │   │   ├── MunicipalityPage.js # Admin hub
│   │   │   └── SustainabilityPage.js # SDG metrics
│   │   ├── styles/
│   │   │   └── global.css       # Full design system
│   │   ├── App.js               # Router
│   │   └── index.js             # Entry point
│   ├── .env.example
│   └── package.json
│
├── package.json                 # Root scripts
└── README.md
```

---

## 🤖 AI Architecture

```
User uploads image
       │
       ▼
[Cloudinary Storage]
       │
       │ Image URL
       ▼
[Node.js / Express Backend]
       │
       │ Temporary local image
       ▼
[Python inference.py]
       │
       ▼
[YOLOv8s Road-Damage Model]
  - Object Detection
  - Pothole / Crack detection
  - Bounding Boxes
  - Confidence Scores
       │
       ▼
[Severity Placeholder]
  - TEMPORARY: medium if detected, low if not
  - Not model output
  - Real severity modeling planned for later phase
       │
       ▼
[Groq-hosted Llama 3 8B]
  - Plain-language explanation
  - Safety precautions
  - System prompt only
  - No RAG
       │
       ▼
[AI Explanation + Safety Precautions]
       │
       ▼
[MongoDB]
       │
       ▼
[React Frontend]
       │
       ▼
[Sustainability Calculator]
  - CO₂ reduction
  - Fuel savings
  - Accident risk score
```

---

## 🛡️ Responsible AI

| Principle | Implementation |
|---|---|
| **Bias Mitigation** | The detection model is a third-party fine-tune trained on the RDD2022 dataset (Japan + India road-damage photos), not on this platform's own submissions. Performance on other regions/road types is untested — see `ml/README.md` limitations. |
| **Transparency** | Confidence scores shown for every detected issue; model card and known limitations documented in `ml/README.md` |
| **Human Review** | Reports with no confident detection are kept and flagged for manual review rather than discarded or guessed |
| **Privacy** | Anonymous reporting option, no data sold |
| **Explainability** | Groq-hosted Llama 3 8B generates a natural-language explanation for every report; a static fallback message is used when no API key is configured |
| **Fairness** | Platform accessible on low-bandwidth; authority-assisted submission for those without smartphones |

---

## 🌐 Deployment

### Backend (Render / Railway)
1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your repo → `backend/` directory
4. Set all environment variables
5. Build command: `npm install`
6. Start command: `npm start`

### Frontend (Vercel / Netlify)
1. Connect GitHub repo to Vercel
2. Set root directory: `frontend`
3. Add env variable: `REACT_APP_API_URL=https://your-backend.onrender.com/api`
4. Deploy

### MongoDB (Atlas)
1. Create free cluster at https://cloud.mongodb.com
2. Whitelist all IPs (0.0.0.0/0) for production
3. Copy connection string to `MONGODB_URI`

---

## 🏆 Resume-Worthy Project Description

> **PotholeVision AI** – Full-Stack AI Road Safety Platform  
> *1M1B AI for Sustainability · IBM SkillsBuild × AICTE*
>
> Built an end-to-end AI-powered web application for citizen road hazard reporting and municipal management.
> Integrated **Groq-hosted Llama 3 8B** for natural language hazard explanations and a road safety chatbot.
> Implemented a **YOLOv8 computer-vision pipeline** for pothole and crack detection with confidence scoring and bounding boxes.
> Designed **Google Maps integration** with geospatial queries, heatmaps, and severity filters.
> Built a **municipality analytics dashboard** with Chart.js, bulk status management, and AI-generated PDF reports.
> Created a **Sustainability Dashboard** tracking CO₂ reduction, fuel savings, and UN SDG progress (SDG 11, 9, 13).
> Stack: React 18, Node.js, Express, MongoDB, Cloudinary, JWT Auth, Groq, Ultralytics/PyTorch, PDFKit.

---

## 🔮 Future Scope

- [ ] React Native mobile app with offline GPS capture
- [ ] Higher-recall / higher-accuracy detection model, ideally fine-tuned on our own labelled Indian road photos (current model's author-reported mAP@0.5 ≈ 0.55 — see `ml/README.md`)
- [ ] WhatsApp Bot integration for reporting without internet
- [ ] Predictive maintenance AI (predict road failure before it happens)
- [ ] IoT sensor integration (road quality sensors)
- [ ] Multi-language support (Hindi, Tamil, Bengali)
- [ ] Government API integration (PM GatiShakti portal)
- [ ] Blockchain audit trail for report accountability

---

*Built with ❤️ for SDG 11 · SDG 9 · SDG 13*
