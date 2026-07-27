# ANSI C AI Tutor - FastAPI Backend (FAISS Semantic Search Edition)

Welcome to the **ANSI C AI Tutor** backend! This is a modular, high-quality, production-ready FastAPI application built to teach strict **ANSI C (C89/C90)** programming concepts using state-of-the-art offline **RAG (Retrieval-Augmented Generation)** techniques.

This edition features automated PDF indexing, persistent semantic vector database caching with **FAISS**, text extraction using **PyMuPDF**, and vector embedding representation using **Sentence-Transformers**.

---

## 🚀 Key Features

1. **Automated Startup Indexing**: On first startup, the backend automatically scans the `books/` folder for `ansi_c.pdf`. If found, it parses it page-by-page, generates vector embeddings, and structures a FAISS index.
2. **Persistent Vector Database Caching**: Computed embeddings are written locally to the `vector_store/` directory. Subsequent server boots load the FAISS database instantly in milliseconds, completely avoiding reprocessing!
3. **Semantic RAG Retrieval**: Integrates `all-MiniLM-L6-v2` to map natural language Q&A queries to high-dimensional space, performing semantic similarity searches via FAISS to retrieve the top matching reference paragraphs.
4. **Strict ANSI C Static Analysis**: An offline, rule-based static analyzer checking standard C89 restrictions:
   - Flagging single-line `//` comments (which are C99).
   - Flagging variable declarations after statements (which must be at block-starts in C89).
   - Flagging non-standard function entries like `void main()`.
   - Recommending standard block formatting and code structure automatically.
5. **Multi-LLM Service**: Seamlessly integrates with Google Gemini or OpenAI APIs with graceful offline static fallbacks if API keys are not supplied.

---

## 📂 Project Structure & File Guide

Below is the complete architectural layout of this project with an explanation of each component:

```text
ansi_c_ai_tutor/
├── books/                          # Folder for default reference PDFs.
│   └── ansi_c.pdf                  # Place your ANSI C guide here (automatically indexed on boot).
├── vector_store/                   # Generated FAISS vector index cache (persistent).
│   ├── index.faiss                 # Persistent FAISS index binary.
│   └── index.pkl                   # Text mappings and page number metadata.
├── app/
│   ├── __init__.py                 # Declares the 'app' directory as a Python package.
│   ├── main.py                     # App bootstrapper: loads startup lifespan hooks for auto-indexing.
│   ├── core/
│   │   ├── __init__.py             # Declares the 'core' directory as a Python package.
│   │   └── config.py               # Manages environment configs and folder paths.
│   ├── api/
│   │   ├── __init__.py             # Declares the 'api' directory as a Python package.
│   │   └── v1/
│   │       ├── __init__.py         # Declares the 'v1' directory as a Python package.
│   │       ├── api.py              # Main router assembly merging health and tutor controllers.
│   │       └── endpoints/
│   │           ├── __init__.py     # Declares endpoints as a Python package.
│   │           ├── health.py       # Exposes system statuses and active API configurations.
│   │           └── tutor.py        # Connects code analysis requests and semantic Q&A endpoints.
│   ├── schemas/
│   │   ├── __init__.py             # Declares the 'schemas' directory as a Python package.
│   │   └── tutor.py                # Contains Pydantic models verifying requests and responses.
│   └── services/
│       ├── __init__.py             # Declares the 'services' directory as a Python package.
│       ├── ai_service.py           # Connects to Gemini/OpenAI; contains the offline C89 rules engine.
│       └── vector_service.py       # Handles PyMuPDF extraction, FAISS persistence, and semantic searches.
├── Dockerfile                      # Multistage optimized production container build.
├── docker-compose.yml              # Docker Compose mapping books and vector volumes for local persistence.
├── requirements.txt                # Pinned production python dependency list.
├── .gitignore                      # Instructs Git to skip caches, virtual environments, and generated FAISS store.
├── .env.example                    # Sample configuration variables for key management.
└── README.md                       # Comprehensive guide and file descriptions (this file).
```

---

## 🛠️ Step-by-Step Local Setup

Follow these instructions to run the application on your computer:

### Option A: Running with standard Python (Recommended for fast local testing)

#### 1. Clone or Open Project Directory
Navigate into the backend project root folder:
```bash
cd ansi_c_ai_tutor
```

#### 2. Create a Virtual Environment
Create an isolated python environment to prevent package version conflicts:
```bash
python -m venv .venv
```

#### 3. Activate the Virtual Environment
- **On Windows (PowerShell):**
  ```powershell
  .venv\Scripts\Activate.ps1
  ```
- **On Windows (Command Prompt):**
  ```cmd
  .venv\Scripts\activate.bat
  ```
- **On macOS/Linux:**
  ```bash
  source .venv/bin/activate
  ```

#### 4. Install Dependencies
```bash
pip install -r requirements.txt
```
*Note: Downloading Torch and FAISS may take a brief moment depending on your connection speed.*

#### 5. Configure Environment Variables
Copy the configuration template:
```bash
cp .env.example .env
```
Open `.env` and fill in your API key if you plan to use an LLM (e.g. `GEMINI_API_KEY`). If you leave it blank, the system will run in offline demo mode using the C89 compliance engine and standard answers.

#### 6. Place Your Reference PDF
Place your copy of the ANSI C textbook or study sheet inside the `books/` folder as `ansi_c.pdf`. 

#### 7. Run the FastAPI Server
Launch the development server:
```bash
uvicorn app.main:app --reload
```
On boot, you will see logging alerts:
- **First Boot**: *"No persistent index found. Processing books/ansi_c.pdf..."* followed by chunking and embedding progress bars, finishing with *"FAISS Index saved successfully to vector_store!"*
- **Subsequent Boots**: *"Persistent FAISS index found. Loading from vector_store..."* (loads instantly in milliseconds!)

---

### Option B: Running with Docker

Ensure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your computer.

#### 1. Setup the `.env` File
Create a `.env` file from the template:
```bash
cp .env.example .env
```

#### 2. Place Your PDF
Place your textbook in the local `books/` folder on your host machine as `ansi_c.pdf`.

#### 3. Launch using Docker-Compose
```bash
docker-compose up --build -d
```
The volumes mapped in `docker-compose.yml` automatically link your local `./books/` folder and generate persistent `./vector_store/` files directly on your computer!

---

## 🧪 Interacting with the API

FastAPI provides an automatic, interactive API dashboard where you can test all endpoints directly from your browser.

1. Open your browser and go to: **[http://localhost:8000/docs](http://localhost:8000/docs)**
2. You will see a beautiful interface containing the following endpoints:

### 1. System Health
- **Endpoint**: `GET /api/v1/health`
- **Purpose**: Verifies that the server is online and tells you whether your Gemini or OpenAI API keys are active.

### 2. Strict ANSI C Code Analyzer
- **Endpoint**: `POST /api/v1/tutor/analyze`
- **Purpose**: Submits a C code snippet to check for C89 standards.
- **Example Request Payload**:
  ```json
  {
    "code": "#include <stdio.h>\n\nvoid main() {\n    // Single line comments are C99!\n    printf(\"Hello, World!\");\n}",
    "strict_ansi": true
  }
  ```
- **Response**: Details compliance issues, lists C89 rules violated, and suggests corrected code.

### 3. Interactive Semantic Q&A
- **Endpoint**: `POST /api/v1/tutor/ask`
- **Purpose**: Ask the tutor any question. The system uses FAISS to find semantic matches from `ansi_c.pdf` and grounds the explanation!
- **Example Request Payload**:
  ```json
  {
    "question": "Can I declare an index variable inside a for loop like for(int i=0; i<10; i++) in C89?",
    "code_context": "for(int i = 0; i < 10; i++) {}"
  }
  ```

---

## 🧹 Clean Up (If using Docker)
To stop and remove the Docker containers, run:
```bash
docker-compose down
```
This leaves your local files and persistent vector index database intact!
