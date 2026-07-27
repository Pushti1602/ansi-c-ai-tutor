from fastapi import APIRouter, HTTPException, status
from app.schemas.tutor import CodeAnalysisRequest, CodeAnalysisResponse, QuestionRequest, QuestionResponse
from app.services.ai_service import ai_service
from app.services.vector_service import vector_service

router = APIRouter()

@router.post("/analyze", response_model=CodeAnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_code(request: CodeAnalysisRequest):
    """
    Submits C source code for rigid ANSI C standard compliance evaluation.
    Returns compliance score, a list of issues (severity, line number, descriptions),
    pedagogical improvement feedback, and improved C code.
    """
    try:
        response = await ai_service.analyze_c_code(
            code=request.code, 
            strict_ansi=request.strict_ansi
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"C Code analysis failed: {str(e)}"
        )

@router.post("/ask", response_model=QuestionResponse, status_code=status.HTTP_200_OK)
async def ask_question(request: QuestionRequest):
    """
    Asks the tutor a question about C programming.
    Retrieves semantic reference context from the automatically indexed ANSI C textbook
    using FAISS vector search to ground the answer (RAG pattern).
    """
    try:
        # Retrieve relevant text segments using semantic similarity matching
        relevant_chunks = vector_service.search_semantic_context(
            query=request.question, 
            limit=2
        )
        
        # Invoke the AI service to formulate an answer
        response = await ai_service.ask_tutor_question(
            question=request.question,
            code_context=request.code_context,
            pdf_contexts=relevant_chunks
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question processing failed: {str(e)}"
        )