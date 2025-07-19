import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import subprocess
from agents.langgraph_workflow import run_learning_plan_workflow
from models.schemas import PlanRequest, PlanResponse, PlanNode
from pydantic import parse_obj_as

# Add dotenv support
try:
    from dotenv import load_dotenv
    load_dotenv()
    print('[INFO] .env loaded')
    api_key = os.getenv('GROQ_API_KEY', '')
    if api_key:
        print(f'[INFO] GROQ_API_KEY loaded: ...{api_key[-4:]}')
    else:
        print('[WARN] GROQ_API_KEY not found in environment')
except ImportError:
    print('[WARN] python-dotenv not installed; .env will not be loaded')

app = FastAPI()

# Allow frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/plan", response_model=PlanResponse)
async def generate_plan(request: Request):
    body = await request.json()
    plan_obj = PlanRequest(**body)
    result = run_learning_plan_workflow(plan_obj)
    # Parse plan days into Pydantic models
    plan_nodes = parse_obj_as(list[PlanNode], result['plan'])
    return PlanResponse(plan=plan_nodes)

@app.get("/api/daily/{user_id}/{plan_id}")
async def get_daily_content(user_id: str, plan_id: str):
    # TODO: Retrieve today's agenda/resources
    return {"daily": "stub"}

@app.post("/api/progress")
async def update_progress(request: Request):
    # TODO: Update user progress, trigger memory update
    return {"status": "updated"}

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    body = await request.json()
    message = body.get("message", "")
    api_key = os.getenv('GROQ_API_KEY') or 'hard_coded_key'
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama3-8b-8192",
        "messages": [
            {"role": "system", "content": "You are a helpful AI assistant."},
            {"role": "user", "content": message}
        ],
        "max_tokens": 512,
        "temperature": 0.7
    }
    try:
        import requests
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=60
        )
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        return {"response": content}
    except Exception as e:
        print(f"[CHATBOT ERROR] {e}")
        return {"response": "[Error: Could not get response from AI]"}

@app.post("/api/execute/python")
async def execute_python(request: Request):
    data = await request.json()
    code = data.get("code", "")
    try:
        result = subprocess.run(
            ["python3", "-c", code],
            capture_output=True,
            text=True,
            timeout=5
        )
        return {"output": result.stdout or result.stderr}
    except Exception as e:
        return {"error": str(e)} 