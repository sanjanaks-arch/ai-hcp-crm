# AI-First HCP CRM Module

A full-stack CRM prototype that uses natural language processing to automatically extract structured medical sales interaction logs and store them instantly into a localized relational database.

## 🚀 Features
* **Structured AI Form Extraction:** Uses Groq's engine powered by the Llama 3.3 70B model to map conversational chat notes directly into strict input schemas.
* **Dynamic Calendar Engine:** Resolves conversational, relative date expressions (e.g., "last Sunday", "today") into precise `YYYY-MM-DD` timestamps via frontend hooks.
* **Full-Stack Sync:** Fully integrated architecture utilizing a React (TypeScript) frontend communicating with a FastAPI backend server.
* **Data Persistence:** Automatically commits validated interaction states into a local SQLite database via SQLAlchemy ORM mapping.

## 🛠️ Tech Stack
* **Frontend:** React, TypeScript, Tailwind CSS, Lucide Icons
* **Backend:** FastAPI, Python, LangChain, Pydantic
* **LLM Engine:** Groq API (Llama 3.3 70B Versatile)
* **Database:** SQLite, SQLAlchemy ORM

## 🏃‍♂️ Quick Start Setup

### 1. Backend Configuration
1. Navigate to the backend directory: `cd CMR/backend`
2. Create your local virtual environment: `python -m venv .venv`
3. Activate the environment: `.\.venv\Scripts\Activate.ps1`
4. Install requirements: `pip install fastapi uvicorn sqlalchemy langchain-groq pydantic langchain dateparser python-dotenv`
5. Create a `.env` file and append your API Key: `GROQ_API_KEY=your_key_here`
6. Fire up the server: `uvicorn app.main:app --reload`

### 2. Frontend Configuration
1. Navigate to the frontend directory: `cd CMR/frontend`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open `http://localhost:5173/` in your browser.
