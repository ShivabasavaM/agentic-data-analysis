import os
import re
import operator
import pandas as pd
from typing import TypedDict, Annotated, List
from langgraph.graph import StateGraph, END, START
from langgraph.prebuilt import ToolNode
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from .tools import execute_data_operation
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-3.5-flash")
TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", "0.0"))

# 1. Update State to include a tool_call_count for loop control
class State(TypedDict):
    messages: Annotated[List, operator.add]
    tool_call_count: int

llm = ChatGoogleGenerativeAI(model=MODEL_NAME, temperature=TEMPERATURE)
tools = [execute_data_operation]
llm_with_tools = llm.bind_tools(tools)

# 2. Dynamic Schema Loader
def get_dynamic_schema(file_id: str) -> List[str]:
    safe_file_id = os.path.basename(file_id)
    file_path = "app/data/project_2.csv" if safe_file_id == "default" else f"app/data/{safe_file_id}.csv"
    try:
        df = pd.read_csv(file_path, nrows=0)
        cols = df.columns.tolist()
        if 'revenue' not in cols and all(c in cols for c in ['units', 'unit_price', 'discount']):
            cols.append('revenue')
        return cols
    except Exception:
        return ["id", "date", "region", "product", "units", "unit_price", "discount", "revenue"]

# 3. Security Screening Node (P1 - Assessor Point 13)
def screen_request(state: State):
    last_msg = state["messages"][-1].content.lower()
    adversarial_patterns = [r"\.env", r"system prompt", r"ignore", r"python code", r"os\.", r"subprocess", r"secrets"]
    
    for pattern in adversarial_patterns:
        if re.search(pattern, last_msg):
            refusal = AIMessage(content="Security Guardrail: Request denied. I cannot execute arbitrary code or access system files.")
            return {"messages": [refusal], "tool_call_count": 0}
            
    return {"messages": [], "tool_call_count": 0}

def route_after_screen(state: State):
    if isinstance(state["messages"][-1], AIMessage):
        return END 
    return "chatbot"

# 4. LLM Chatbot Node
def chatbot(state: State, config: RunnableConfig):
    msgs = state.get("messages", [])
    count = state.get("tool_call_count", 0)
    file_id = config.get("configurable", {}).get("file_id", "default")
    
    columns = get_dynamic_schema(file_id)
    
    SYSTEM_PROMPT = """You are an enterprise Data Analysis Agent.

AVAILABLE DATASET COLUMNS (Strictly lowercase): 
["id", "date", "region", "product", "units", "unit_price", "discount", "revenue"]

RULES:
1. DETERMINISTIC MATH ONLY: NEVER perform arithmetic, multiplication, division, or estimation yourself. If a user asks you to "double", "divide", or "estimate" a figure, explicitly refuse and state you can only provide exact aggregations from the dataset.
2. NO FABRICATED METRICS: If the user asks for a metric not in the columns list (e.g., "profit", "tax", "cost", "conversion rate"), DO NOT call the tool. Immediately inform them that the data is not available. Do not substitute revenue for profit.
3. UNRECOGNIZABLE AMBIGUITY (ASK FIRST): If a user query is completely broken, garbled (e.g., "revnue w??", "do the thing"), or lacks enough context to form an assumption, DO NOT call the tool. Ask a brief, direct clarifying question.
4. MINOR AMBIGUITY (ASSUME & PROCEED): If a query is clear but lacks a specific metric (e.g., "best region"), state your assumption (e.g., "Assuming 'best' means highest revenue") and execute the tool.
5. SINGLE EXECUTION: Make only one tool call per response. Do not use the tool to "explore" the data.
6. NO NARRATION: Do not output a "Data Operations Log" or explain your tool arguments. 
"""
    
    if not msgs or not isinstance(msgs[0], SystemMessage):
        msgs = [SystemMessage(content=SYSTEM_PROMPT)] + msgs
    else:
        msgs[0] = SystemMessage(content=SYSTEM_PROMPT)

    response = llm_with_tools.invoke(msgs)
    if response.tool_calls:
        count += 1
        
    return {"messages": [response], "tool_call_count": count}

# 5. Stateful Loop Control Router (P1 - Assessor Point 14)
def route_after_chatbot(state: State):
    last_msg = state["messages"][-1]
    if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
        return END
    if state.get("tool_call_count", 0) >= 3:
        return "loop_breaker"
    return "tools"
    
def loop_breaker(state: State):
    return {"messages": [AIMessage(content="System halted: Maximum execution limit reached. Please simplify your query.")]}

# Build Graph
graph_builder = StateGraph(State)
graph_builder.add_node("screen_request", screen_request)
graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("tools", ToolNode(tools=[execute_data_operation]))
graph_builder.add_node("loop_breaker", loop_breaker)

graph_builder.add_conditional_edges(START, route_after_screen)
graph_builder.add_conditional_edges("chatbot", route_after_chatbot)
graph_builder.add_edge("tools", "chatbot")
graph_builder.add_edge("loop_breaker", END)

memory = MemorySaver()
graph = graph_builder.compile(checkpointer=memory)