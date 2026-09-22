import pytest
from unittest.mock import patch, MagicMock

from src.rules.engine import evaluate_general_rules
from src.rules.result import RuleResult, RuleStatus

@pytest.fixture
def mock_checks():
    with patch("src.rules.engine.check_manufacturer") as m1, \
         patch("src.rules.engine.check_product_name") as m2, \
         patch("src.rules.engine.check_quantity") as m3, \
         patch("src.rules.engine.check_manufacturing_date") as m4, \
         patch("src.rules.engine.check_mrp") as m5, \
         patch("src.rules.engine.check_dimensions") as m6, \
         patch("src.rules.engine.check_consumer_care") as m7:
         
        # Set up mock returns
        m1.return_value = RuleResult(rule_id="LMPC_6_1_A", field="manufacturer", status=RuleStatus.PASS, message="", evidence=[], confidence=1.0)
        m2.return_value = RuleResult(rule_id="LMPC_6_1_B", field="common_name", status=RuleStatus.PASS, message="", evidence=[], confidence=1.0)
        m3.return_value = RuleResult(rule_id="LMPC_6_1_C", field="net_quantity", status=RuleStatus.PASS, message="", evidence=[], confidence=1.0)
        m4.return_value = RuleResult(rule_id="LMPC_6_1_D", field="mfg_date", status=RuleStatus.PASS, message="", evidence=[], confidence=1.0)
        m5.return_value = RuleResult(rule_id="LMPC_6_1_E", field="mrp", status=RuleStatus.PASS, message="", evidence=[], confidence=1.0)
        m6.return_value = RuleResult(rule_id="LMPC_6_1_F", field="dimensions", status=RuleStatus.PASS, message="", evidence=[], confidence=1.0)
        m7.return_value = RuleResult(rule_id="LMPC_6_2", field="consumer_care", status=RuleStatus.PASS, message="", evidence=[], confidence=1.0)
        
        yield {
            "manufacturer_packer_importer": m1,
            "common_name": m2,
            "net_quantity": m3,
            "mfg_date": m4,
            "mrp": m5,
            "dimensions": m6,
            "consumer_care": m7
        }

@pytest.fixture
def dummy_fields():
    return {
        "manufacturer_packer_importer": MagicMock(),
        "common_name": MagicMock(),
        "net_quantity": MagicMock(),
        "mfg_date": MagicMock(),
        "mrp": MagicMock(),
        "dimensions": MagicMock(),
        "consumer_care": {"phone": MagicMock(), "email": MagicMock()}
    }

def test_general_category(mock_checks, dummy_fields):
    res = evaluate_general_rules("general", dummy_fields)
    assert len(res) == 8
    for k, check in mock_checks.items():
        if k != "dimensions":
            check.assert_called_once()
        
def test_food_category(mock_checks, dummy_fields):
    res = evaluate_general_rules("food", dummy_fields)
    assert len(res) == 8
    for r in res:
        from src.rules.result import RuleStatus
        assert r.status == RuleStatus.NOT_APPLICABLE
    for check in mock_checks.values():
        check.assert_not_called()

def test_cosmetic_category(mock_checks, dummy_fields):
    res = evaluate_general_rules("cosmetic", dummy_fields)
    assert len(res) == 8
    mock_checks["mrp"].assert_not_called()
    mock_checks["mfg_date"].assert_called_once()
    
    mrp_res = next(r for r in res if r.rule_id == "LMPC_6_1_E")
    assert mrp_res.status == RuleStatus.NOT_APPLICABLE
    assert "exempt" in mrp_res.message.lower()

def test_alcohol_category(mock_checks, dummy_fields):
    res = evaluate_general_rules("alcohol", dummy_fields)
    assert len(res) == 8
    mock_checks["mrp"].assert_not_called()
    
    mrp_res = next(r for r in res if r.rule_id == "LMPC_6_1_E")
    assert mrp_res.status == RuleStatus.NOT_APPLICABLE

def test_bidi_incense_bidi(mock_checks, dummy_fields):
    res = evaluate_general_rules("bidi_incense", dummy_fields, sub_category="bidi")
    assert len(res) == 8
    mock_checks["mfg_date"].assert_not_called()
    mock_checks["mrp"].assert_not_called()
    
    mfg_res = next(r for r in res if r.rule_id == "LMPC_6_1_D")
    mrp_res = next(r for r in res if r.rule_id == "LMPC_6_1_E")
    assert mfg_res.status == RuleStatus.NOT_APPLICABLE
    assert mrp_res.status == RuleStatus.NOT_APPLICABLE

def test_bidi_incense_incense(mock_checks, dummy_fields):
    res = evaluate_general_rules("bidi_incense", dummy_fields, sub_category="incense")
    assert len(res) == 8
    mock_checks["mfg_date"].assert_not_called()
    mock_checks["mrp"].assert_called_once()
    
    mfg_res = next(r for r in res if r.rule_id == "LMPC_6_1_D")
    assert mfg_res.status == RuleStatus.NOT_APPLICABLE

def test_lpg_apm_true(mock_checks, dummy_fields):
    res = evaluate_general_rules("lpg_cylinder", dummy_fields, is_apm=True)
    assert len(res) == 8
    mock_checks["mfg_date"].assert_not_called()
    mock_checks["mrp"].assert_not_called()
    
    mrp_res = next(r for r in res if r.rule_id == "LMPC_6_1_E")
    assert mrp_res.status == RuleStatus.NOT_APPLICABLE

def test_lpg_apm_false(mock_checks, dummy_fields):
    res = evaluate_general_rules("lpg_cylinder", dummy_fields, is_apm=False)
    assert len(res) == 8
    mock_checks["mfg_date"].assert_not_called()
    mock_checks["mrp"].assert_called_once()

def test_lpg_apm_none(mock_checks, dummy_fields):
    res = evaluate_general_rules("lpg_cylinder", dummy_fields, is_apm=None)
    assert len(res) == 8
    mock_checks["mfg_date"].assert_not_called()
    mock_checks["mrp"].assert_not_called()
    
    mrp_res = next(r for r in res if r.rule_id == "LMPC_6_1_E")
    assert mrp_res.status == RuleStatus.NEEDS_REVIEW
    assert "unknown" in mrp_res.message.lower()

def test_invalid_category(dummy_fields):
    with pytest.raises(ValueError, match="Invalid category"):
        evaluate_general_rules("nonexistent_category", dummy_fields)
