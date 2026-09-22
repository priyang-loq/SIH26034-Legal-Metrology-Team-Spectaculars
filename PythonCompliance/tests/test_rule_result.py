import pytest
import json
from pydantic import ValidationError
from src.rules.result import RuleResult, RuleStatus, format_clause_citation

def test_rule_result_construction():
    for status in RuleStatus:
        res = RuleResult(
            rule_id="LMPC_6_1_A",
            field="manufacturer_packer_importer",
            status=status,
            message=f"Test message for {status.name}",
            evidence=[],
            confidence=0.9
        )
        assert res.status == status

def test_invalid_status_enum():
    with pytest.raises(ValidationError):
        RuleResult(
            rule_id="LMPC_6_1_A",
            field="manufacturer_packer_importer",
            status="INVALID_STATUS_STRING",
            message="Test",
            evidence=[],
            confidence=0.9
        )

def test_rule_id_formatting():
    assert format_clause_citation("LMPC_6_1_D") == "Rule 6(1)(d)"
    assert format_clause_citation("LMPC_6_1_A") == "Rule 6(1)(a)"
    assert format_clause_citation("LMPC_6_2") == "Rule 6(2)"
    assert format_clause_citation("LMPC_7") == "Rule 7"
    
def test_json_serialization():
    res = RuleResult(
        rule_id="LMPC_6_1_D",
        field="mfg_date",
        status=RuleStatus.VIOLATION,
        message="Manufacturing date is missing",
        evidence=["some_evidence_mock"],
        confidence=0.85
    )
    
    # Dump to JSON and load back
    json_str = res.model_dump_json() if hasattr(res, 'model_dump_json') else res.json()
    loaded = json.loads(json_str)
    
    # Reconstruct from JSON to verify round-trip
    reconstructed = RuleResult(**loaded)
    
    assert reconstructed.rule_id == "LMPC_6_1_D"
    assert reconstructed.field == "mfg_date"
    assert reconstructed.status == RuleStatus.VIOLATION
    assert reconstructed.message == "Manufacturing date is missing"
    assert reconstructed.evidence == ["some_evidence_mock"]
    assert reconstructed.confidence == 0.85

def test_confidence_bounds():
    # Should accept 0.0 to 1.0
    valid_res = RuleResult(
        rule_id="LMPC_6_1_D",
        field="mfg_date",
        status=RuleStatus.PASS,
        message="Valid",
        evidence=[],
        confidence=1.0
    )
    assert valid_res.confidence == 1.0
    
    with pytest.raises(ValidationError):
        RuleResult(
            rule_id="LMPC_6_1_D",
            field="mfg_date",
            status=RuleStatus.PASS,
            message="Invalid high",
            evidence=[],
            confidence=1.5
        )
        
    with pytest.raises(ValidationError):
        RuleResult(
            rule_id="LMPC_6_1_D",
            field="mfg_date",
            status=RuleStatus.PASS,
            message="Invalid low",
            evidence=[],
            confidence=-0.1
        )
