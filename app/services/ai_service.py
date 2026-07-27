import requests
import re
import time
import logging
import traceback
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.schemas.tutor import CodeAnalysisResponse, CComplianceIssue, QuestionResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AIService")

class AIService:
    def __init__(self):
        # Configure local Ollama connection settings from Pydantic configs
        self.ollama_base = settings.OLLAMA_URL
        self.ollama_model = settings.OLLAMA_MODEL
        self.ollama_enabled = False
        
        # Memory caches for 0.0-second instant repeat response times
        self.qa_cache: Dict[str, QuestionResponse] = {}
        self.analysis_cache: Dict[str, CodeAnalysisResponse] = {}
        
        # Verify daemon and model tags on launch using synchronous requests
        self._check_ollama_health()

    def _check_ollama_health(self) -> None:
        """
        Validates Ollama connection synchronously. Matches 'tinyllama' model specifically.
        """
        try:
            logger.info(f"STARTUP DIAGNOSTICS: Connecting to local Ollama daemon at {self.ollama_base}...")
            
            resp = requests.get(f"{self.ollama_base}/api/tags", timeout=3.0)
            
            if resp.status_code == 200:
                logger.info("STARTUP DIAGNOSTICS SUCCESS: Ollama daemon is active!")
                models_data = resp.json().get("models", [])
                
                exact_model = None
                configured_model_lower = self.ollama_model.lower()
                base_name = configured_model_lower.split(":")[0]
                
                for m in models_data:
                    name = m["name"].lower()
                    if configured_model_lower in name or base_name in name:
                        exact_model = m["name"]
                        break
                
                if exact_model:
                    self.ollama_model = exact_model
                    self.ollama_enabled = True
                    logger.info(f"STARTUP DIAGNOSTICS SUCCESS: Resolved local model to '{self.ollama_model}'!")
                else:
                    installed_names = [m["name"] for m in models_data]
                    logger.warning(
                        f"\n======================================================================\n"
                        f"STARTUP DIAGNOSTICS WARNING: Model '{self.ollama_model}' not found in Ollama!\n"
                        f"Installed tags: {installed_names}\n"
                        f"Run: ollama pull {self.ollama_model}\n"
                        f"Fallback mode active.\n"
                        f"======================================================================\n"
                    )
            else:
                logger.warning(f"STARTUP DIAGNOSTICS WARNING: Ollama returned status {resp.status_code}.")
                
        except Exception as e:
            logger.warning(
                f"\n======================================================================\n"
                f"STARTUP DIAGNOSTICS WARNING: Local Ollama daemon is not active at {self.ollama_base}!\n"
                f"Connection details: {str(e)}\n"
                f"Tutoring backend will fall back to local C89 static checker rules.\n"
                f"======================================================================\n"
            )

    def test_hello_ollama(self) -> str:
        """
        Standalone test function that sends 'Hello' to the model.
        Logs details required by diagnostic pass.
        """
        url = f"{self.ollama_base}/api/generate"
        payload = {
            "model": self.ollama_model,
            "prompt": "Hello",
            "stream": False
        }
        logger.info(f"OLLAMA TEST RUN URL: {url}")
        logger.info(f"OLLAMA TEST RUN PAYLOAD: {payload}")
        
        start = time.time()
        try:
            response = requests.post(url, json=payload, timeout=240)
            duration = time.time() - start
            logger.info(f"OLLAMA TEST RUN STATUS: {response.status_code}")
            logger.info(f"OLLAMA TEST RUN RESPONSE TEXT LENGTH: {len(response.text)}")
            logger.info(f"OLLAMA TEST RUN DURATION: {duration:.2f}s")
            
            # Verify we receive the body before post-processing
            logger.info(f"OLLAMA TEST RUN RAW BODY PREVIEW: {response.text[:200]}")
            
            if response.status_code == 200:
                data = response.json()
                return data.get("response", "No response key found.")
            else:
                return f"Error: Status {response.status_code}"
        except Exception as e:
            duration = time.time() - start
            logger.error(f"OLLAMA TEST RUN EXCEPTION after {duration:.2f}s: {str(e)}")
            return f"Failed: {str(e)}"

    async def warmup_model(self) -> None:
        """
        Startup Warmup: Sends a lightweight background request to load model weights.
        Exposes diagnostic verification checks.
        """
        if not self.ollama_enabled:
            return

        logger.info(f"WARMUP: Pre-loading local model weights '{self.ollama_model}' into memory...")
        # Run the diagnostic test function on boot to pre-load model and check connectivity
        self.test_hello_ollama()

    async def analyze_c_code(self, code: str, strict_ansi: bool = True) -> CodeAnalysisResponse:
        """
        Analyzes C source code. Features caching and structured JSON outputs.
        """
        total_start = time.time()
        logger.info("C code analysis request received.")
        
        cache_key = f"{code}_{strict_ansi}"
        if cache_key in self.analysis_cache:
            logger.info("CACHE HIT: Serving code analysis instantly from memory!")
            return self.analysis_cache[cache_key]

        if self.ollama_enabled:
            try:
                system_prompt = self._get_analysis_system_prompt(strict_ansi)
                prompt = (
                    f"System instructions:\n{system_prompt}\n\n"
                    f"Analyze the following C source code:\n\n```c\n{code}\n```"
                )
                
                logger.info(f"OLLAMA REQUEST URL: {self.ollama_base}/api/generate")
                logger.info(f"OLLAMA REQUEST PROMPT LENGTH: {len(prompt)} characters")
                
                ollama_start = time.time()
                payload = {
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 500
                    }
                }
                logger.info(f"OLLAMA REQUEST PAYLOAD: {payload}")
                logger.info(f"Ollama request started for model '{self.ollama_model}' with timeout 120s...")
                
                response = requests.post(f"{self.ollama_base}/api/generate", json=payload, timeout=120)
                ollama_duration = time.time() - ollama_start
                total_duration = time.time() - total_start
                
                logger.info(f"OLLAMA RESPONSE STATUS: {response.status_code}")
                logger.info(f"OLLAMA RESPONSE LENGTH: {len(response.text)} characters")
                logger.info(f"OLLAMA GENERATION DURATION: {ollama_duration:.2f} seconds")
                logger.info(f"OLLAMA RAW RESPONSE BODY: {response.text}")
                logger.info(f"Code analysis completed. Ollama generation duration: {ollama_duration:.2f}s. Total duration: {total_duration:.2f}s.")
                
                if response.status_code != 200:
                    logger.error(f"Ollama returned HTTP Error Status {response.status_code}: {response.text}")
                    fallback_res = self._local_ansi_c_analyzer(code, strict_ansi)
                    fallback_res.feedback = f"Ollama HTTP Error: {response.text}\n\n" + fallback_res.feedback
                    return fallback_res
                
                try:
                    data = response.json()
                except Exception as json_err:
                    logger.error(f"JSON Parse Error during code analysis: {str(json_err)}")
                    fallback_res = self._local_ansi_c_analyzer(code, strict_ansi)
                    fallback_res.feedback = "Ollama returned invalid JSON.\n\n" + fallback_res.feedback
                    return fallback_res

                if "response" not in data:
                    logger.error(f"Missing 'response' key in code analysis data: {data}")
                    fallback_res = self._local_ansi_c_analyzer(code, strict_ansi)
                    fallback_res.feedback = f"Invalid Ollama response: {data}\n\n" + fallback_res.feedback
                    return fallback_res
                
                raw_content = data["response"]
                clean_content = self._clean_json_markdown(raw_content)
                response_model = CodeAnalysisResponse.model_validate_json(clean_content)
                
                self.analysis_cache[cache_key] = response_model
                return response_model
                
            except Exception as e:
                total_duration = time.time() - total_start
                logger.error(f"OLLAMA FULL ERROR DURING CODE ANALYSIS: {str(e)}\n{traceback.format_exc()}")
                fallback_res = self._local_ansi_c_analyzer(code, strict_ansi)
                fallback_res.feedback = (
                    "### ⚠️ Local Inference Exception\n\n"
                    f"Local C code analysis failed due to exception: {str(e)}.\n\n" + fallback_res.feedback
                )
                return fallback_res

        logger.info("Local static C89 analyzer fallback active (Ollama disabled).")
        return self._local_ansi_c_analyzer(code, strict_ansi)

    async def ask_tutor_question(
        self, 
        question: str, 
        code_context: Optional[str] = None, 
        pdf_contexts: List[Dict[str, Any]] = None
    ) -> QuestionResponse:
        """
        Answers C programming questions using local Ollama model.
        Implemented fully synchronously using requests with 120s timeout and 500 tokens cap.
        """
        total_start = time.time()
        logger.info(f"Question received: '{question}'")
        
        cache_key = f"{question}_{code_context or ''}"
        if cache_key in self.qa_cache:
            logger.info("CACHE HIT: Serving tutoring response instantly from memory!")
            return self.qa_cache[cache_key]

        # FAISS Context Extraction: combine all retrieved chunks
        context_parts = []
        sources = []
        if pdf_contexts:
            logger.info(f"Processing {len(pdf_contexts)} retrieved chunks from FAISS...")
            for chunk in pdf_contexts:
                context_parts.append(f"Source: {chunk['source']} (Page {chunk['page']})\n{chunk['content']}")
                if chunk["source"] not in sources:
                    sources.append(chunk["source"])
        else:
            logger.info("No FAISS chunks provided/retrieved.")

        context_text = "\n\n".join(context_parts) if context_parts else "No reference context active."

        if self.ollama_enabled:
            try:
                # Replace prompt with the stronger educational prompt
                prompt = f"""You are an expert ANSI C Programming Tutor.

Use ONLY the supplied textbook context.

Rules:
* Answer the student's question directly.
* Be accurate and concise.
* Explain concepts in beginner-friendly language.
* Use examples whenever appropriate.
* Use simple ANSI C terminology.
* If the answer is not present in the provided context, clearly state that.
* Avoid repeating the question.
* Avoid unnecessary textbook quotations.
* Prefer explanation over copying source text.
* Do NOT include any introductory or explanatory text in the Program section. Start the Program section directly with the C code block.
* You MUST always output all four sections in this exact order: Definition:, Explanation:, Syntax:, and Program:. Do NOT skip or omit any section under any circumstances.
* In the Syntax section, if there is no special syntax, write "Not applicable" or show a basic declaration.
* In the Program section, you MUST always write a full, compileable ANSI C program demonstrating the concept.
* You MUST format your response strictly using the following structure:

Definition:
<short definition>

Explanation:
<beginner-friendly explanation>

Syntax:
<syntax rules if applicable, or state "Not applicable" if not relevant>

Program:
```c
// full compileable ANSI C program demonstrating the concept
```

Context:
{context_text}

Question:
{question}

Answer:"""

                logger.info(f"OLLAMA REQUEST URL: {self.ollama_base}/api/generate")
                logger.info(f"OLLAMA REQUEST PROMPT LENGTH: {len(prompt)} characters")
                
                ollama_start = time.time()
                payload = {
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 800
                    }
                }
                logger.info(f"OLLAMA REQUEST PAYLOAD: {payload}")
                logger.info(f"Ollama request started for model '{self.ollama_model}' with timeout 240s...")
                
                response = requests.post(f"{self.ollama_base}/api/generate", json=payload, timeout=240)
                ollama_duration = time.time() - ollama_start
                total_duration = time.time() - total_start
                
                logger.info(f"OLLAMA RESPONSE STATUS: {response.status_code}")
                logger.info(f"OLLAMA RESPONSE LENGTH: {len(response.text)} characters")
                logger.info(f"OLLAMA GENERATION DURATION: {ollama_duration:.2f} seconds")
                logger.info(f"OLLAMA RAW RESPONSE BODY: {response.text}")
                logger.info(f"Ollama response received. Status code: {response.status_code}. Response text length: {len(response.text)} chars.")
                logger.info(f"Ollama generation duration: {ollama_duration:.2f}s. Total request duration: {total_duration:.2f}s.")
                
                if response.status_code != 200:
                    logger.error(f"Ollama returned HTTP Error Status {response.status_code}: {response.text}")
                    fallback_answer = (
                        "[Fallback Mode Active - Local AI generation failed. Serving retrieved textbook context directly.]\n\n"
                        "Definition:\n"
                        "Refer to the textbook context below.\n\n"
                        "Explanation:\n"
                        f"{context_text}\n\n"
                        "Syntax:\n"
                        "Not applicable (Fallback mode active).\n\n"
                        "Program:\n"
                        "```c\n"
                        "/* Not applicable (Fallback mode active) */\n"
                        "```"
                    )
                    return QuestionResponse(answer=fallback_answer, sources_used=sources)

                try:
                    data = response.json()
                except Exception as json_err:
                    logger.error(f"JSON Parse Error from Ollama: {str(json_err)}")
                    fallback_answer = (
                        "[Fallback Mode Active - Ollama returned invalid JSON. Serving retrieved textbook context directly.]\n\n"
                        "Definition:\n"
                        "Refer to the textbook context below.\n\n"
                        "Explanation:\n"
                        f"{context_text}\n\n"
                        "Syntax:\n"
                        "Not applicable (Fallback mode active).\n\n"
                        "Program:\n"
                        "```c\n"
                        "/* Not applicable (Fallback mode active) */\n"
                        "```"
                    )
                    return QuestionResponse(answer=fallback_answer, sources_used=sources)

                if "response" not in data:
                    logger.error(f"Missing 'response' key in Ollama payload: {data}")
                    fallback_answer = (
                        "[Fallback Mode Active - Invalid Ollama response structure. Serving retrieved textbook context directly.]\n\n"
                        "Definition:\n"
                        "Refer to the textbook context below.\n\n"
                        "Explanation:\n"
                        f"{context_text}\n\n"
                        "Syntax:\n"
                        "Not applicable (Fallback mode active).\n\n"
                        "Program:\n"
                        "```c\n"
                        "/* Not applicable (Fallback mode active) */\n"
                        "```"
                    )
                    return QuestionResponse(answer=fallback_answer, sources_used=sources)

                raw_answer = data["response"]
                processed_answer = self._clean_final_answer(raw_answer)
                
                response_model = QuestionResponse(answer=processed_answer, sources_used=sources)
                self.qa_cache[cache_key] = response_model
                return response_model

            except Exception as e:
                total_duration = time.time() - total_start
                logger.error(f"OLLAMA FULL ERROR DURING Q&A GENERATION: {str(e)}\n{traceback.format_exc()}")
                fallback_answer = (
                    "[Fallback Mode Active - Local AI generation failed or timed out. Serving retrieved textbook context directly.]\n\n"
                    "Definition:\n"
                    "Refer to the textbook context below.\n\n"
                    "Explanation:\n"
                    f"{context_text}\n\n"
                    "Syntax:\n"
                    "Not applicable (Fallback mode active).\n\n"
                    "Program:\n"
                    "```c\n"
                    "/* Not applicable (Fallback mode active) */\n"
                    "```"
                )
                return QuestionResponse(answer=fallback_answer, sources_used=sources)
        else:
            fallback_answer = (
                "[Fallback Mode Active - Local Ollama is offline. Serving retrieved textbook context directly.]\n\n"
                "Definition:\n"
                "Refer to the textbook context below.\n\n"
                "Explanation:\n"
                f"{context_text}\n\n"
                "Syntax:\n"
                "Not applicable (Fallback mode active).\n\n"
                "Program:\n"
                "```c\n"
                "/* Not applicable (Fallback mode active) */\n"
                "```"
            )
            return QuestionResponse(answer=fallback_answer, sources_used=sources)

    def _extract_text_from_dict(self, data: Any) -> str:
        if not isinstance(data, dict):
            return str(data)
            
        # Case 1: Keys are the section names
        sections_dict = {}
        for k, v in data.items():
            k_lower = k.lower().strip()
            if "definition" in k_lower:
                sections_dict["Definition"] = str(v)
            elif "explanation" in k_lower:
                sections_dict["Explanation"] = str(v)
            elif "syntax" in k_lower:
                sections_dict["Syntax"] = str(v)
            elif "program" in k_lower or "code" in k_lower:
                sections_dict["Program"] = str(v)
                
        if len(sections_dict) >= 2: # Found at least 2 sections
            parts = []
            for h in ["Definition", "Explanation", "Syntax", "Program"]:
                if h in sections_dict:
                    parts.append(f"{h}:\n{sections_dict[h]}")
            return "\n\n".join(parts)
            
        # Case 2: Dictionary contains a single text field like "response", "answer", "text"
        for key in ["response", "answer", "text", "output", "result"]:
            if key in data:
                return str(data[key])
                
        # Case 3: Just return all values joined by newlines
        return "\n\n".join(f"{k}:\n{v}" for k, v in data.items())

    def _parse_to_sections(self, text: str) -> Dict[str, str]:
        sections = {"Definition": "", "Explanation": "", "Syntax": "", "Program": ""}
        
        # Normalize and find occurrences of headers
        pattern = r"(?:^|\n)\s*(?:\d+\.\s*)?(?:\*\*|###|##|-)?\s*(Definition|Explanation|Syntax|Program)\b(?:\s*Text)?\s*(?:\*\*)?\s*[:\-]?\s*"
        matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
        
        if not matches:
            pattern_loose = r"\b(Definition|Explanation|Syntax|Program)\b"
            matches = list(re.finditer(pattern_loose, text, flags=re.IGNORECASE))
            
        if not matches:
            sections["Explanation"] = text
            return sections
            
        matches.sort(key=lambda x: x.start())
        
        for i, match in enumerate(matches):
            header = match.group(1).capitalize()
            start_pos = match.end()
            end_pos = matches[i+1].start() if i + 1 < len(matches) else len(text)
            
            content = text[start_pos:end_pos].strip()
            if sections[header]:
                sections[header] += "\n\n" + content
            else:
                sections[header] = content
                
        first_match_start = matches[0].start()
        preamble = text[:first_match_start].strip()
        if preamble:
            first_header = matches[0].group(1).capitalize()
            sections[first_header] = preamble + "\n\n" + sections[first_header]
            
        return sections

    def _format_sections(self, sections: Dict[str, str]) -> str:
        formatted_parts = []
        
        # 1. Definition
        def_content = sections.get("Definition", "").strip()
        if not def_content:
            def_content = "Not available."
        formatted_parts.append(f"Definition:\n{def_content}")
        
        # 2. Explanation
        exp_content = sections.get("Explanation", "").strip()
        if not exp_content:
            exp_content = "Not available."
        formatted_parts.append(f"Explanation:\n{exp_content}")
        
        # 3. Syntax
        syn_content = sections.get("Syntax", "").strip()
        if not syn_content:
            syn_content = "Not available."
        formatted_parts.append(f"Syntax:\n{syn_content}")
        
        # 4. Program
        prog_content = sections.get("Program", "").strip()
        if not prog_content:
            prog_content = "Not available."
            
        if prog_content == "Not available.":
            code_body = "/* Not available. */"
        else:
            code_block_match = re.search(r"```\w*\s*([\s\S]*?)\s*```", prog_content)
            if code_block_match:
                code_body = code_block_match.group(1).strip()
            else:
                code_body = prog_content
                
        formatted_parts.append(f"Program:\n```c\n{code_body}\n```")
        
        return "\n\n".join(formatted_parts)

    def _clean_final_response(self, raw_text: str) -> str:
        """Cleans and formats the LLM response for display by delegating to _clean_final_answer."""
        return self._clean_final_answer(raw_text)

    def _clean_final_answer(self, answer: str) -> str:
        if not answer:
            return ""

        # 1. Replace escaped characters
        answer = answer.replace("\\r\\n", "\n")
        answer = answer.replace("\\n", "\n")
        answer = answer.replace("\\t", "\t")
        answer = answer.replace('\\"', '"')
        answer = answer.replace("\\\\", "\\")

        # 2. Remove leading conversational elements
        import re
        patterns = [
            r"^\s*Assistant:\s*",
            r"^\s*Sure!\s*",
            r"^\s*Certainly!\s*",
            r"^\s*Here is the answer:\s*",
        ]
        changed = True
        while changed:
            changed = False
            for pattern in patterns:
                new_answer = re.sub(pattern, "", answer, flags=re.IGNORECASE)
                if new_answer != answer:
                    answer = new_answer
                    changed = True

        # 3. Parse into sections
        sections = {"Definition": "", "Explanation": "", "Syntax": "", "Program": ""}
        
        header_pattern = r"(?:^|\n)\s*(?:\d+\.\s*)?(?:\*\*|###|##|-)?\s*(Definition|Explanation|Syntax|Program)\b(?:\s*Text)?\s*(?:\*\*)?\s*[:\-]?\s*"
        matches = list(re.finditer(header_pattern, answer, flags=re.IGNORECASE))
        
        if not matches:
            loose_pattern = r"\b(Definition|Explanation|Syntax|Program)\b"
            matches = list(re.finditer(loose_pattern, answer, flags=re.IGNORECASE))
            
        if not matches:
            sections["Explanation"] = answer.strip()
        else:
            matches.sort(key=lambda x: x.start())
            for i, match in enumerate(matches):
                header = match.group(1).capitalize()
                start_pos = match.end()
                end_pos = matches[i+1].start() if i + 1 < len(matches) else len(answer)
                
                content = answer[start_pos:end_pos].strip()
                if sections[header]:
                    sections[header] += "\n\n" + content
                else:
                    sections[header] = content
                    
            # If there is a preamble before the first match, prepend it to the first section
            first_match_start = matches[0].start()
            preamble = answer[:first_match_start].strip()
            if preamble:
                first_header = matches[0].group(1).capitalize()
                sections[first_header] = preamble + "\n\n" + sections[first_header]

        # 4. Format and reconstruct the sections
        formatted_parts = []
        
        # Definition
        def_content = sections.get("Definition", "").strip()
        if not def_content:
            def_content = "Not available."
        formatted_parts.append(f"Definition:\n{def_content}")
        
        # Explanation
        exp_content = sections.get("Explanation", "").strip()
        if not exp_content:
            exp_content = "Not available."
        formatted_parts.append(f"Explanation:\n{exp_content}")
        
        # Syntax
        syn_content = sections.get("Syntax", "").strip()
        if not syn_content:
            syn_content = "Not available."
        formatted_parts.append(f"Syntax:\n{syn_content}")
        
        # Program
        prog_content = sections.get("Program", "").strip()
        if not prog_content:
            prog_content = "Not available."
            
        if prog_content == "Not available.":
            code_body = "/* Not available. */"
        else:
            code_block_match = re.search(r"```\w*\s*([\s\S]*?)\s*```", prog_content)
            if code_block_match:
                code_body = code_block_match.group(1).strip()
            else:
                code_body = prog_content
                
        formatted_parts.append(f"Program:\n```c\n{code_body}\n```")
        
        final_answer = "\n\n".join(formatted_parts)
        final_answer = re.sub(r"\n{3,}", "\n\n", final_answer)
        return final_answer.strip()

    def _get_analysis_system_prompt(self, strict_ansi: bool) -> str:
        strict_text = (
            "Strictly enforce ANSI C89/C90 constraints. Any newer standard features (C99, C11, C23) "
            "like `//` comments, loop-scoped variables `for(int i...)`, variable-length arrays, "
            "or mixed declarations and statements must be flagged as non-compliant errors."
            if strict_ansi else
            "Flag potential runtime issues, standard warnings, memory leaks, and general compiler warnings."
        )

        return f"""You are an elite automated ANSI C Code Tutor. Analyze the C code provided by the student.
{strict_text}

Provide output in JSON format ONLY, conforming strictly to this schema structure:
{{
  "is_compliant": bool,
  "compliance_score": int (0 to 100),
  "issues": [
    {{
      "line_number": int or null,
      "severity": "error" | "warning" | "suggestion",
      "description": "Clear explanation of the violation",
      "standard_ref": "ANSI C Section reference or rule name"
    }}
  ],
  "feedback": "A warm, pedagogical breakdown of the findings, detailing why rules exist and how to think about memory/compiler structures.",
  "improved_code": "Fully corrected, beautifully formatted ANSI C code"
}}
"""

    def _clean_json_markdown(self, raw_text: str) -> str:
        clean = raw_text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        elif clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        return clean.strip()

    def _local_ansi_c_analyzer(self, code: str, strict_ansi: bool) -> CodeAnalysisResponse:
        issues = []
        lines = code.split("\n")
        
        # 1. Single-line comments check
        if strict_ansi:
            for idx, line in enumerate(lines):
                clean_line = re.sub(r'".*?"', '""', line)
                if "//" in clean_line:
                    issues.append(CComplianceIssue(
                        line_number=idx + 1,
                        severity="error",
                        description="Single-line comment '//' is a C99 addition. ANSI C89 only supports block comments '/* ... */'.",
                        standard_ref="C89 Section 3.1.9"
                    ))

        # 2. Loop variable declarations check
        for idx, line in enumerate(lines):
            if re.search(r'\bfor\s*\(\s*int\s+\w+', line):
                issues.append(CComplianceIssue(
                    line_number=idx + 1,
                    severity="error",
                    description="Declaring variables inside 'for' loop (e.g. 'for(int i = 0; ...)') is C99. In C89, variables must be declared at the block scope start.",
                    standard_ref="C89 Section 3.6.2"
                ))

        # 3. void main() entry signature check
        for idx, line in enumerate(lines):
            if re.search(r'\bvoid\s+main\s*\(', line):
                issues.append(CComplianceIssue(
                    line_number=idx + 1,
                    severity="warning",
                    description="'void main()' is non-standard. Use 'int main(void)' or 'int main(int argc, char *argv[])' with an explicit return.",
                    standard_ref="C89 Section 2.1.2.2"
                ))

        # 4. Mixed declarations check (declarations after statements)
        if strict_ansi:
            in_function = False
            statement_seen = False
            for idx, line in enumerate(lines):
                stripped = line.strip()
                if not stripped:
                    continue
                if stripped.endswith("{"):
                    in_function = True
                    statement_seen = False
                    continue
                if stripped.startswith("}"):
                    in_function = False
                    statement_seen = False
                    continue
                
                if in_function:
                    is_decl = re.match(r'^(int|char|float|double|long|short|unsigned|signed|struct|void)\s+\w+', stripped)
                    is_stmt = not is_decl and not stripped.startswith("/*") and not stripped.startswith("*") and not stripped.startswith("{")
                    
                    if is_stmt:
                        statement_seen = True
                    elif is_decl and statement_seen:
                        issues.append(CComplianceIssue(
                            line_number=idx + 1,
                            severity="error",
                            description="Variable declaration found after an executable statement. ANSI C89 requires variables at the top of the block.",
                            standard_ref="C89 Section 3.6.2"
                        ))

        deductions = len(issues) * 15
        score = max(100 - deductions, 40)
        is_compliant = len(issues) == 0

        if is_compliant:
            feedback = (
                "Excellent work! Your code is fully compliant with the ANSI C89 standard. "
                "All variables are declared at the beginning of their blocks, entry signatures "
                "are correct, and comment structures match standard requirements."
            )
            improved_code = code
        else:
            feedback = (
                f"We found {len(issues)} ANSI C89 compliance issues in your code. "
                "In C89/C90, block-scoped declarations must strictly precede execution statements. Check details to solve them."
            )
            improved_code = self._local_improve_code_mock(code)

        return CodeAnalysisResponse(
            is_compliant=is_compliant,
            compliance_score=score,
            issues=issues,
            feedback=feedback,
            improved_code=improved_code
        )

    def _local_improve_code_mock(self, code: str) -> str:
        improved = code
        improved = re.sub(r'//\s*(.*)', r'/* \1 */', improved)
        improved = re.sub(r'\bvoid\s+main\s*\(\s*\)', r'int main(void)', improved)
        return improved

    async def aclose(self) -> None:
        """
        Kept for boot compatibility.
        """
        pass

# Instantiate the service
ai_service = AIService()