from pydantic import BaseModel, Field
from typing import List, Optional


# --- C Code Analysis Schemas ---

class CodeAnalysisRequest(BaseModel):
    code: str = Field(
        ...,
        description="The ANSI C source code to analyze.",
        example="#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}"
    )
    strict_ansi: bool = Field(
        True,
        description="Whether to strictly enforce ANSI C89/C90 standard rules."
    )


class CComplianceIssue(BaseModel):
    line_number: Optional[int] = Field(
        None,
        description="Line number of the issue if detectable."
    )
    severity: str = Field(
        ...,
        description="Severity level: 'error', 'warning', or 'suggestion'."
    )
    description: str = Field(
        ...,
        description="Explanation of why this violates ANSI C standards or is bad practice."
    )
    standard_ref: Optional[str] = Field(
        None,
        description="ANSI C standard section reference if applicable."
    )


class CodeAnalysisResponse(BaseModel):
    is_compliant: bool = Field(
        ...,
        description="True if code follows standard ANSI C guidelines without major errors."
    )
    compliance_score: int = Field(
        ...,
        description="Compliance score from 0 (lowest) to 100 (fully compliant)."
    )
    issues: List[CComplianceIssue] = Field(
        default_factory=list,
        description="List of detected compliance issues or code smells."
    )
    feedback: str = Field(
        ...,
        description="In-depth pedagogical feedback explaining how the student can improve."
    )
    improved_code: Optional[str] = Field(
        None,
        description="An optimized, compliant version of the student's code."
    )


# --- ANSI C Q&A Schemas ---

class QuestionRequest(BaseModel):
    question: str = Field(
        ...,
        description="The query about C programming or ANSI C specifications."
    )
    code_context: Optional[str] = Field(
        None,
        description="Optional C code snippet related to the question."
    )


class QuestionResponse(BaseModel):
    answer: str = Field(
        ...,
        description="Rich pedagogical answer explaining the C programming concepts."
    )
    sources_used: List[str] = Field(
        default_factory=list,
        description="References or PDF filenames/pages used to answer this query."
    )