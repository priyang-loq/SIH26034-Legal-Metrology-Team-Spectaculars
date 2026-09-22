from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Any

class RuleStatus(str, Enum):
    PASS = "PASS"
    VIOLATION = "VIOLATION"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    NEEDS_REVIEW = "NEEDS_REVIEW"

def format_clause_citation(rule_id: str) -> str:
    """
    Translates an internal rule ID like 'LMPC_6_1_D' into a human-readable
    clause citation like 'Rule 6(1)(d)'.
    """
    if not rule_id.startswith("LMPC_"):
        return rule_id
        
    parts = rule_id.replace("LMPC_", "").split("_")
    if len(parts) == 1:
        return f"Rule {parts[0]}"
    elif len(parts) == 2:
        return f"Rule {parts[0]}({parts[1]})"
    elif len(parts) >= 3:
        return f"Rule {parts[0]}({parts[1]})({parts[2].lower()})"
    return rule_id

class RuleResult(BaseModel):
    rule_id: str
    field: str
    status: RuleStatus
    message: str
    evidence: List[Any] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)
    extracted_value: Any = None
    original_value: Any = None
    officer_override: Any = None
