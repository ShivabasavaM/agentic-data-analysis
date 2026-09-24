import shutil
import uuid
import os
import re
import traceback
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.agent.graph import graph
from langchain_core.messages import HumanMessage

router = APIRouter()

class QueryRequest(BaseModel):
    query: str
    file_id: str = "default"
    thread_id: str = "default_thread"

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB limit

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # 1. Validate Content-Type
    if file.content_type not in ["text/csv", "application/vnd.ms-excel"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV is allowed.")
    
    # 2. Validate File Size
    file.file.seek(0, os.SEEK_END)
    if file.file.tell() > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5MB.")
    file.file.seek(0) # Reset cursor after checking size
    
    # 3. Generate strict UUID (Fixes Path Traversal)
    # 3. Generate strict UUID (Fixes Path Traversal)
    file_id = str(uuid.uuid4())
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "data", f"{file_id}.csv")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"message": "File uploaded successfully", "file_id": file_id}

@router.post("/chat")
async def chat(request: QueryRequest):
    if request.file_id != "default" and not re.match(r"^[a-f0-9\-]{36}$", request.file_id):
         raise HTTPException(status_code=400, detail="Invalid file_id format.")

    state = {"messages": [HumanMessage(content=request.query)], "tool_call_count": 0}
    config = {
        "configurable": {
            "thread_id": request.thread_id,
            "file_id": request.file_id
        },
        "recursion_limit": 10
    }
    
    try:
        result = graph.invoke(state, config=config)
        
        last_message = result["messages"][-1]
        content = last_message.content
        if isinstance(content, list):
            extracted = [b['text'] for b in content if isinstance(b, dict) and 'text' in b]
            content = "".join(extracted).strip()
        elif not isinstance(content, str):
            content = str(content)
            
        operations_trace = []
        # Iterate backwards through history to only grab tools used for the current question
        for msg in reversed(result["messages"]):
            if msg.type == 'human' or type(msg).__name__ == "HumanMessage":
                break
            
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                for tc in msg.tool_calls:
                    operations_trace.insert(0, {"tool": tc['name'], "arguments": tc['args']})

        if not content and operations_trace:
            content = f"Tool executed successfully, but no summary text was returned."
            
        return {"answer": content, "trace": operations_trace}
        
    except Exception as e:
        error_msg = str(e)
        
        # 1. Handle Upstream LLM API Failures
        if "404" in error_msg or "NOT_FOUND" in error_msg:
            raise HTTPException(status_code=503, detail="AI Service Error: The specified model is currently unavailable or misconfigured.")
        elif "429" in error_msg or "quota" in error_msg.lower():
            raise HTTPException(status_code=429, detail="AI Service Error: Rate limit or API quota exceeded.")
            
        # 2. Handle LangGraph Logic/Recursion Failures
        elif "Recursion limit" in error_msg:
            raise HTTPException(status_code=422, detail="System Halted: The agent reached maximum execution depth without resolving the query.")
            
        # 3. Fallback for unhandled internal crashes
        else:
            print(f"Backend Crash Log:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail="Internal Server Error: The analysis engine encountered an unexpected failure.")