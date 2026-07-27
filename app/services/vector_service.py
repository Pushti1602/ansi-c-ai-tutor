import os
import pickle
import logging
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VectorService")

try:
    import fitz  # PyMuPDF
    import faiss
    import numpy as np
    from sentence_transformers import SentenceTransformer
    LIBRARIES_AVAILABLE = True
except ImportError as e:
    LIBRARIES_AVAILABLE = False
    logger.error(f"Semantic search libraries not fully installed. Error: {str(e)}")

from app.core.config import settings

class VectorService:
    def __init__(self):
        self.index: Optional[Any] = None
        self.chunks: List[Dict[str, Any]] = []
        self._model: Optional[Any] = None
        
        # Persistent storage configurations
        self.faiss_path = os.path.join(settings.VECTOR_DB_DIR, "index.faiss")
        self.pkl_path = os.path.join(settings.VECTOR_DB_DIR, "index.pkl")

    @property
    def model(self):
        """
        Lazy-loader for SentenceTransformer.
        """
        if self._model is None and LIBRARIES_AVAILABLE:
            logger.info("Loading SentenceTransformer model ('all-MiniLM-L6-v2')...")
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer model loaded successfully!")
        return self._model

    def initialize_index(self) -> None:
        """
        Invoked on application startup.
        Loads existing persistent index or builds one from books/ansi_c.pdf.
        Also warms up the embedding model.
        """
        os.makedirs(settings.BOOKS_DIR, exist_ok=True)
        os.makedirs(settings.VECTOR_DB_DIR, exist_ok=True)

        if not LIBRARIES_AVAILABLE:
            logger.warning("FAISS or PyMuPDF are not installed. Skipping database initialization.")
            return

        # Warm up the embedding model immediately on startup to avoid first-response latency
        logger.info("WARMUP: Pre-loading SentenceTransformer embedding model into memory...")
        _ = self.model

        # 1. Try to load from persistent cache
        if os.path.exists(self.faiss_path) and os.path.exists(self.pkl_path):
            try:
                logger.info("Persistent FAISS index found. Loading from vector_store...")
                self.index = faiss.read_index(self.faiss_path)
                with open(self.pkl_path, "rb") as f:
                    self.chunks = pickle.load(f)
                logger.info(f"Vector index loaded successfully! Chunks active: {len(self.chunks)}")
                return
            except Exception as e:
                logger.error(f"Failed to load persistent FAISS index: {str(e)}. Re-indexing...")

        # 2. If no cache, look for books/ansi_c.pdf
        logger.info(f"No persistent index found. Looking for book at {settings.BOOK_PATH}...")
        if not os.path.exists(settings.BOOK_PATH):
            logger.warning(
                f"\n======================================================================\n"
                f"WARNING: Reference PDF '{settings.BOOK_PATH}' is missing!\n"
                f"Place your C textbook in '{settings.BOOKS_DIR}/' as 'ansi_c.pdf'.\n"
                f"The tutoring backend will run in local mode without RAG on startup.\n"
                f"======================================================================\n"
            )
            return

        # 3. Process PDF and generate embeddings
        try:
            logger.info(f"Found '{settings.BOOK_PATH}'. Extracting text using PyMuPDF...")
            extracted_chunks = self._extract_and_chunk_pdf(settings.BOOK_PATH)
            
            if not extracted_chunks:
                logger.warning("No readable text chunks could be extracted from the PDF.")
                return

            logger.info(f"Extracted {len(extracted_chunks)} text chunks. Generating embeddings...")
            
            # Encode texts
            texts = [chunk["content"] for chunk in extracted_chunks]
            embeddings = self.model.encode(texts, show_progress_bar=True)
            embeddings_np = np.array(embeddings).astype("float32")

            # Initialize and populate FAISS database index
            dimension = embeddings_np.shape[1]
            logger.info(f"Creating FAISS IndexFlatL2 index with dimension {dimension}...")
            self.index = faiss.IndexFlatL2(dimension)
            self.index.add(embeddings_np)
            self.chunks = extracted_chunks

            # Persist index to file system
            logger.info("Saving FAISS index and chunk metadata locally to vector_store...")
            faiss.write_index(self.index, self.faiss_path)
            with open(self.pkl_path, "wb") as f:
                pickle.dump(self.chunks, f)
            logger.info("FAISS vector database successfully written and active!")
            
        except Exception as e:
            logger.error(f"An error occurred during automatic PDF indexing: {str(e)}")

    def _extract_and_chunk_pdf(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Uses PyMuPDF (fitz) to partition text page-by-page.
        """
        doc = fitz.open(file_path)
        chunks = []
        filename = os.path.basename(file_path)

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text()
            if not text:
                continue

            paragraphs = text.split("\n\n")
            for para in paragraphs:
                clean_para = para.replace("\n", " ").strip()
                clean_para = " ".join(clean_para.split())
                
                # Exclude trivial structures
                if len(clean_para) < 60:
                    continue

                chunks.append({
                    "source": filename,
                    "page": page_idx + 1,
                    "content": clean_para
                })
        return chunks

    def search_semantic_context(self, query: str, limit: int = 2) -> List[Dict[str, Any]]:
        """
        Returns top semantic matches from the FAISS database.
        Enforces tutoring prompt efficiency constraints:
        - Retrieves top_k = 2 chunks maximum (or up to limit unique chunks).
        - Removes duplicates and overlapping chunk content.
        - Truncates each chunk to 400 characters maximum before prompt injection.
        """
        if not LIBRARIES_AVAILABLE or self.index is None or not self.chunks:
            return []

        try:
            query_vector = self.model.encode([query])
            query_vector_np = np.array(query_vector).astype("float32")

            # Fetch extra candidates to account for deduplication and overlap filtering
            candidate_limit = max(limit * 2, 4)
            distances, indices = self.index.search(query_vector_np, candidate_limit)
            
            matches = []
            seen_content = set()

            for idx in indices[0]:
                if idx != -1 and idx < len(self.chunks):
                    original_chunk = self.chunks[idx]
                    content = original_chunk["content"].strip()
                    if not content:
                        continue
                    
                    # Normalize whitespace for deduplication
                    content_clean = " ".join(content.split())
                    content_lower = content_clean.lower()
                    
                    # Check for duplicates or overlapping substrings
                    is_dup = False
                    for seen in seen_content:
                        if content_lower in seen or seen in content_lower:
                            is_dup = True
                            break
                    
                    if is_dup:
                        continue
                        
                    seen_content.add(content_lower)
                    
                    # Truncate content to max 400 characters
                    if len(content_clean) > 400:
                        content_clean = content_clean[:400]
                        
                    matches.append({
                        "source": original_chunk["source"],
                        "page": original_chunk["page"],
                        "content": content_clean
                    })
                    
                    if len(matches) >= limit:
                        break
            return matches
        except Exception as e:
            logger.error(f"Error during semantic vector search: {str(e)}")
            return []

vector_service = VectorService()
