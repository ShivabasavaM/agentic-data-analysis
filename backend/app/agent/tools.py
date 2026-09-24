import os
import re
import pandas as pd
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
from typing import List, Optional, Any

ALLOWED_COLUMNS = ["id", "date", "region", "product", "units", "unit_price", "discount", "revenue"]
ALLOWED_OPS = ["eq", "gt", "lt", "gte", "lte"]
ALLOWED_AGGS = ["sum", "mean", "median", "min", "max", "count"]

class FilterDef(BaseModel):
    column: str = Field(description="Column to filter on")
    operator: str = Field(description="Operator: eq, gt, lt, gte, lte")
    value: Any = Field(description="Value to compare. For dates, MUST be strictly YYYY-MM-DD format.")

class DataOpInput(BaseModel):
    filters: Optional[List[FilterDef]] = Field(None, description="Filters to apply before aggregation.")
    group_by: Optional[str] = Field(None, description="Column to group by, if any.")
    agg_column: Optional[str] = Field(None, description="Column to perform arithmetic on. Leave empty if agg_op is 'count'.")
    agg_op: Optional[str] = Field(None, description="Arithmetic operation (sum, mean, median, count, min, max).")

@tool("execute_data_operation", args_schema=DataOpInput)
def execute_data_operation(
    filters: Optional[List[FilterDef]] = None, 
    group_by: Optional[str] = None, 
    agg_column: Optional[str] = None, 
    agg_op: Optional[str] = None,
    config: RunnableConfig = None
) -> str:
    """Executes a deterministic data analysis operation on the CSV. Use this for ALL math."""
    try:
        # 1. Path Traversal Defense
        file_id = config.get("configurable", {}).get("file_id", "default") if config else "default"
        if file_id != "default" and not re.match(r"^[a-f0-9\-]{36}$", file_id):
            return "Execution Error: Invalid file_id format. Access denied."
            
        safe_file_id = os.path.basename(file_id)
        # Dynamically resolve absolute path to the data folder
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file_path = os.path.join(base_dir, "data", "project_2.csv") if safe_file_id == "default" else os.path.join(base_dir, "data", f"{safe_file_id}.csv")
        if not os.path.exists(file_path):
            return f"Execution Error: Dataset not found."

        # 2. Data Leakage Fix: Drop rows where real data is missing
        df = pd.read_csv(file_path).dropna(subset=['date', 'region', 'product'])
        
        # 3. Validate Revenue Assumptions
        if 'discount' in df.columns:
            if df['discount'].max() > 1 or df['discount'].min() < 0:
                 return "Execution Error: 'discount' column values must be between 0 and 1. Cannot calculate revenue."
                 
        if 'revenue' not in df.columns and all(c in df.columns for c in ['units', 'unit_price', 'discount']):
            df['revenue'] = df['units'] * df['unit_price'] * (1 - df['discount'])
        
        # 4. Strict Filtering & Type Casting
        if filters:
            for f in filters:
                if f.column not in ALLOWED_COLUMNS: return f"Validation Error: Column '{f.column}' does not exist."
                if f.operator not in ALLOWED_OPS: return f"Validation Error: Unsupported operator '{f.operator}'."
                
                target_col = df[f.column]
                
                # 4a. Handle Strict ISO Date Parsing
                if f.column == "date":
                    try:
                        target_col = pd.to_datetime(target_col)
                        val = pd.to_datetime(f.value, format='%Y-%m-%d', errors='raise')
                    except ValueError:
                        return f"Validation Error: Date '{f.value}' is not YYYY-MM-DD. Correct the format and retry."
                
                # 4b. Handle Case-Insensitive String Matching
                elif pd.api.types.is_string_dtype(target_col):
                    target_col = target_col.str.lower().str.strip()
                    val = str(f.value).lower().strip()
                
                # 4c. Handle Numeric Casting Guardrail
                elif pd.api.types.is_numeric_dtype(target_col):
                    try:
                        val = float(f.value)
                    except ValueError:
                        return f"Validation Error: Column '{f.column}' is numeric, but you passed '{f.value}'."
                
                # Fallback for booleans/other types
                else:
                    val = f.value
                
                # Apply the mathematical operator securely
                if f.operator == "eq": df = df[target_col == val]
                elif f.operator == "gt": df = df[target_col > val]
                elif f.operator == "lt": df = df[target_col < val]
                elif f.operator == "gte": df = df[target_col >= val]
                elif f.operator == "lte": df = df[target_col <= val]

        if df.empty:
            return "Execution Error: 0 rows match the requested filters. DO NOT RETRY. Tell the user no data matches."

        # 5. Fix Dead Code: Handle Count explicitly FIRST
        if agg_op == "count":
            if group_by:
                if group_by not in ALLOWED_COLUMNS: return f"Validation Error: Invalid group_by '{group_by}'."
                result = df.groupby(group_by).size().to_dict()
                return f"Grouped by {group_by}, count: {result}"
            else:
                return f"Execution Result: Total count is {len(df)}"

        # 6. Guardrail for missing arguments
        if not agg_column or not agg_op:
             return "Validation Error: You must provide 'agg_column' and 'agg_op' (e.g., 'sum'). DO NOT RETRY."

        # 7. Standard Aggregation
        if agg_column not in ALLOWED_COLUMNS:
            return f"Validation Error: Cannot aggregate '{agg_column}'."
        if agg_op not in ALLOWED_AGGS:
            return f"Validation Error: Invalid aggregation '{agg_op}'."

        if group_by:
            if group_by not in ALLOWED_COLUMNS: return f"Validation Error: Invalid group_by '{group_by}'."
            result = df.groupby(group_by)[agg_column].agg(agg_op).to_dict()
            return f"Grouped by {group_by}, {agg_op} of {agg_column}: {result}"
        else:
            result = df[agg_column].agg(agg_op)
            return f"Total {agg_op} of {agg_column}: {result}"
            
    except Exception as e:
        return f"Execution Error: {str(e)}"