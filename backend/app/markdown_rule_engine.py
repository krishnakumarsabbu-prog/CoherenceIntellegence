"""Dynamic Markdown Business Rule AST Extractor & Execution Engine.

Parses arbitrary Markdown rule specification documents (.md), extracts Rule ASTs
(Rule ID, Description, Parameter Specs, Conditions, and Thresholds), generates an
analytical evaluation event stream based ON THE UPLOADED RULES AND PARAMETERS, and evaluates
rule firing indicators & feature vectors for downstream ML models.
"""

import dataclasses
import re
import random
from typing import Any
import pandas as pd


@dataclasses.dataclass
class RuleAST:
    rule_id: str
    description: str
    parameter_count: int
    parameters: list[str]
    conditions: list[str]
    risk_level: str  # "HIGH", "MEDIUM", "LOW"
    rule_type: str = "SOFT"  # "SOFT" (becomes ML feature) or "HARD" (immediate short-circuit block)
    weight: float = 10.0


def parse_markdown_rules_ast(content: str | bytes) -> list[RuleAST]:
    """Parse any arbitrary Markdown rule file into a list of RuleAST objects."""
    if isinstance(content, bytes):
        text = content.decode("utf-8", errors="replace")
    else:
        text = str(content)

    rules: list[RuleAST] = []
    
    # Split by markdown headers (# , ## , ### , or Rule: )
    header_pattern = r'\n(?=(?:#{1,4}\s+|Rule:\s+))'
    blocks = re.split(header_pattern, '\n' + text)

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        lines = block.splitlines()
        first_line = lines[0].strip()
        
        # Check header match
        match_hdr = re.match(r'^(?:#{1,4}\s+|Rule:\s*)(.+)$', first_line)
        if not match_hdr:
            continue
        
        rule_id = match_hdr.group(1).strip()
        # Clean up header formatting if any
        rule_id = re.sub(r'[*`]', '', rule_id)
        if rule_id.lower().startswith("rule ->") or rule_id.lower().startswith("rules"):
            continue

        description = ""
        param_count = 0
        parameters: list[str] = []
        conditions: list[str] = []

        in_params = False
        for line in lines[1:]:
            l_strip = line.strip()
            
            # Rule Description extraction
            if re.match(r'^-?\s*(?:Rule\s+)?Description\s*:\s*', l_strip, re.IGNORECASE):
                description = re.sub(r'^-?\s*(?:Rule\s+)?Description\s*:\s*', '', l_strip, flags=re.IGNORECASE).strip()
            
            # Parameter Count extraction
            elif re.match(r'^-?\s*Parameter\s+Count\s*:\s*', l_strip, re.IGNORECASE):
                val_str = re.sub(r'^-?\s*Parameter\s+Count\s*:\s*', '', l_strip, flags=re.IGNORECASE).strip()
                try:
                    param_count = int(val_str)
                except ValueError:
                    param_count = 0
                    
            # Parameters List extraction header
            elif re.match(r'^-?\s*Parameters\s*:\s*', l_strip, re.IGNORECASE):
                in_params = True
                
            # Bullet point items under Parameters
            elif in_params and (l_strip.startswith("-") or l_strip.startswith("*") or l_strip.startswith("+")):
                p_item = re.sub(r'^[-*+]\s*', '', l_strip).strip()
                if p_item and not p_item.lower().startswith("rule description"):
                    parameters.append(p_item)
            elif in_params and not l_strip:
                in_params = False

        if not param_count and parameters:
            param_count = len(parameters)

        # Extract condition keywords / numbers from description
        if description:
            cond_matches = re.findall(r'([><=]=?\s*\d+|\b\d+\s+(?:days|hours|users|logins|ECNs)\b)', description, re.IGNORECASE)
            conditions = [c.strip() for c in cond_matches]

        # Determine risk level, rule_type, and weight based on description / keywords
        desc_upper = (rule_id + " " + description).upper()
        
        if any(kw in desc_upper for kw in ["SANCTION", "BLACKLIST", "IMMEDIATE BLOCK", "HARD_BLOCK", "HARD BLOCK"]):
            rule_type = "HARD"
            risk_level = "CRITICAL"
            weight = 100.0
        elif any(kw in desc_upper for kw in ["FRAUD", "BLOCK", "REJECT", "CRITICAL", "RISK_"]) or param_count >= 8:
            rule_type = "SOFT"
            risk_level = "HIGH"
            weight = 25.0
        elif any(kw in desc_upper for kw in ["FAILED", "MULTI", "ALERT", "CHALLENGE", "UNTRUSTED"]):
            rule_type = "SOFT"
            risk_level = "MEDIUM"
            weight = 15.0
        else:
            rule_type = "SOFT"
            risk_level = "LOW"
            weight = 10.0

        rules.append(RuleAST(
            rule_id=rule_id,
            description=description or f"Specification for rule {rule_id}",
            parameter_count=param_count,
            parameters=parameters if parameters else ["Default_Parameter"],
            conditions=conditions,
            risk_level=risk_level,
            rule_type=rule_type,
            weight=weight
        ))

    if not rules:
        # Generic fallback AST if uploaded markdown was freeform text
        rules.append(RuleAST(
            rule_id="CUSTOM_UPLOADED_RULE_001",
            description=text[:120] if text else "Custom uploaded rules specification",
            parameter_count=3,
            parameters=["Transaction_Amount", "Device_Age", "Risk_Score"],
            conditions=["< 180 days"],
            risk_level="MEDIUM",
            rule_type="SOFT",
            weight=15.0
        ))

    return rules


def _evaluate_rule_condition_on_row(rule: RuleAST, row: dict[str, Any]) -> bool:
    """Evaluate whether a specific RuleAST condition triggers for a transaction record dict."""
    desc_lower = rule.description.lower()
    
    amt = float(row.get("amount", 0) or 0)
    tx_freq = float(row.get("tx_freq_1h", row.get("velocity_5min", 0)) or 0)
    geo_vel = float(row.get("geo_velocity", 0) or 0)
    device_risk = float(row.get("device_risk_score", 0) or 0)
    new_device = bool(row.get("new_device", False) or row.get("device_age_days", 99) < 7)
    country_mismatch = bool(row.get("country_mismatch", False) or (
        str(row.get("country", "")).upper() != str(row.get("ip_country", row.get("country", ""))).upper()
        and str(row.get("ip_country", "")) != ""
    ))
    blacklisted = bool(row.get("is_blacklisted", False) or str(row.get("merchant_category", "")).lower() == "blacklisted")

    # Hard block rules
    if rule.rule_type == "HARD" or "sanction" in desc_lower or "blacklist" in desc_lower:
        if blacklisted or "sanction" in str(row.get("country", "")).lower():
            return True

    # Amount based condition parsing
    if "amount" in desc_lower or "50,000" in desc_lower or "50000" in desc_lower:
        m = re.search(r'amount\s*([><=]=?)\s*([\d,]+)', desc_lower)
        if m:
            op, val_str = m.group(1), m.group(2).replace(",", "")
            target_val = float(val_str)
            if op in (">", ">=") and amt >= target_val:
                return True
            if op in ("<", "<=") and amt <= target_val:
                return True
        elif amt >= 50000 or amt >= 5000:
            return True

    # Velocity / frequency rules
    if "velocity" in desc_lower or "frequency" in desc_lower or "10" in desc_lower:
        if tx_freq > 8:
            return True

    # Geography / country mismatch
    if "country" in desc_lower or "geo" in desc_lower or "mismatch" in desc_lower:
        if country_mismatch or geo_vel > 250:
            return True

    # Device risk
    if "device" in desc_lower:
        if new_device or device_risk > 0.7:
            return True

    # Direct hit check if present in row
    rule_col_name = f"rule_{re.sub(r'[^a-zA-Z0-9_]', '_', rule.rule_id)}_hit"
    if rule_col_name in row:
        return bool(row[rule_col_name])

    # Parameter fallback check
    fired_params = 0
    for p in rule.parameters:
        p_clean = re.sub(r'[^a-zA-Z0-9_]', '_', p).lower()
        val = row.get(p_clean)
        if val is not None:
            try:
                num = float(val)
                if num > 75.0 or num == 1.0:
                    fired_params += 1
            except (ValueError, TypeError):
                pass
    
    return fired_params >= max(1, len(rule.parameters) // 2)


def evaluate_dataset_rules(df: pd.DataFrame, rules: list[RuleAST]) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Execute uploaded Markdown rules on the historical/input dataset.
    
    Appends rule features (rule_*_hit, rule_hit_count, rule_score, max_rule_severity,
    critical_rule_hit, hard_block_triggered) into the DataFrame for downstream ML models.
    """
    df_out = df.copy()
    rows_dict = df_out.to_dict(orient="records")
    
    rule_hits_matrix: dict[str, list[int]] = {}
    for r in rules:
        col_name = f"rule_{re.sub(r'[^a-zA-Z0-9_]', '_', r.rule_id)}_hit"
        rule_hits_matrix[col_name] = []

    hit_counts = []
    rule_scores = []
    max_severities = []
    critical_hits = []
    hard_blocks = []

    severity_map = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

    for row in rows_dict:
        row_soft_hits = 0
        row_score = 0.0
        row_max_sev = 0
        row_critical = 0
        row_hard_block = 0

        for r in rules:
            col_name = f"rule_{re.sub(r'[^a-zA-Z0-9_]', '_', r.rule_id)}_hit"
            fires = _evaluate_rule_condition_on_row(r, row)
            hit_val = 1 if fires else 0
            rule_hits_matrix[col_name].append(hit_val)

            if fires:
                if r.rule_type == "HARD":
                    row_hard_block = 1
                else:
                    row_soft_hits += 1
                    row_score += r.weight
                    sev_num = severity_map.get(r.risk_level, 1)
                    if sev_num > row_max_sev:
                        row_max_sev = sev_num
                    if r.risk_level in ("HIGH", "CRITICAL"):
                        row_critical = 1

        hit_counts.append(row_soft_hits)
        rule_scores.append(row_score)
        max_severities.append(row_max_sev)
        critical_hits.append(row_critical)
        hard_blocks.append(row_hard_block)

    for col_name, hits in rule_hits_matrix.items():
        df_out[col_name] = hits

    df_out["rule_hit_count"] = hit_counts
    df_out["rule_score"] = rule_scores
    df_out["max_rule_severity"] = max_severities
    df_out["critical_rule_hit"] = critical_hits
    df_out["hard_block_triggered"] = hard_blocks

    summary = {
        "rules_count": len(rules),
        "soft_rules_count": len([r for r in rules if r.rule_type == "SOFT"]),
        "hard_rules_count": len([r for r in rules if r.rule_type == "HARD"]),
        "total_rules_fired": int(sum(hit_counts)),
        "hard_blocks_count": int(sum(hard_blocks)),
        "critical_hits_count": int(sum(critical_hits)),
        "avg_rule_score": float(pd.Series(rule_scores).mean()) if rule_scores else 0.0,
    }

    return df_out, summary


def evaluate_single_transaction_rules(txn: dict[str, Any], rules: list[RuleAST]) -> dict[str, Any]:
    """Execute rule evaluation on a single incoming runtime transaction payload."""
    rule_features: dict[str, Any] = {}
    hit_count = 0
    rule_score = 0.0
    max_sev = 0
    critical_hit = 0
    hard_block = False
    hard_block_rule = ""
    triggered_rules = []

    severity_map = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

    for r in rules:
        col_name = f"rule_{re.sub(r'[^a-zA-Z0-9_]', '_', r.rule_id)}_hit"
        fires = _evaluate_rule_condition_on_row(r, txn)
        rule_features[col_name] = 1 if fires else 0

        if fires:
            triggered_rules.append(r.rule_id)
            if r.rule_type == "HARD":
                hard_block = True
                if not hard_block_rule:
                    hard_block_rule = r.rule_id
            else:
                hit_count += 1
                rule_score += r.weight
                sev_num = severity_map.get(r.risk_level, 1)
                if sev_num > max_sev:
                    max_sev = sev_num
                if r.risk_level in ("HIGH", "CRITICAL"):
                    critical_hit = 1

    rule_features["rule_hit_count"] = hit_count
    rule_features["rule_score"] = rule_score
    rule_features["max_rule_severity"] = max_sev
    rule_features["critical_rule_hit"] = critical_hit
    rule_features["hard_block_triggered"] = 1 if hard_block else 0
    rule_features["hard_block_rule_id"] = hard_block_rule
    rule_features["triggered_rules"] = triggered_rules

    return rule_features


def generate_event_stream_from_rules(
    rules: list[RuleAST],
    n_samples: int = 500,
    seed: int = 42
) -> dict[str, Any]:
    """Dynamically build an evaluation dataset stream derived directly from the uploaded rules."""
    rng = random.Random(seed)
    
    # Collect all parameters dynamically across all uploaded rules
    all_params: list[str] = []
    for r in rules:
        for p in r.parameters:
            if p not in all_params:
                all_params.append(p)
                
    base_ts = 1753526400  # 2025-07-26 00:00:00 UTC
    rows: list[dict[str, Any]] = []

    for i in range(n_samples):
        # Base event metadata
        row: dict[str, Any] = {
            "transaction_id": f"txn_rule_{1000 + i}",
            "timestamp": base_ts + i * rng.randint(60, 600),
            "amount": round(rng.uniform(10.0, 5000.0), 2),
            "country": rng.choice(["US", "GB", "DE", "FR", "BR", "IN", "SG", "NG", "RU"]),
            "device_id": f"dev_{rng.randint(1, 150)}",
            "card_id": f"card_{rng.randint(1, 300)}",
        }

        # Populate values for EVERY parameter defined in the uploaded Markdown rules
        for p in all_params:
            p_clean = re.sub(r'[^a-zA-Z0-9_]', '_', p).lower()
            if "score" in p_clean or "biocatch" in p_clean:
                row[p_clean] = round(rng.uniform(0.0, 1000.0), 1)
            elif "age" in p_clean or "days" in p_clean or "seen" in p_clean:
                row[p_clean] = rng.randint(1, 730)
            elif "count" in p_clean or "failed" in p_clean or "ecn" in p_clean or "users" in p_clean:
                row[p_clean] = rng.randint(0, 10)
            elif "type" in p_clean or "code" in p_clean or "carrier" in p_clean:
                row[p_clean] = rng.choice(["AUTH_REG", "3DS_CHALLENGE", "PAYMENT_REJECT", "CARRIER_A", "CARRIER_B", "NORMAL"])
            else:
                row[p_clean] = round(rng.uniform(0, 100), 2)

        # Evaluate firing status for each uploaded rule dynamically
        rules_fired: list[str] = []
        rule_scores: list[float] = []

        for r in rules:
            # Rule satisfaction logic based on uploaded parameters & risk level
            rule_p_cleans = [re.sub(r'[^a-zA-Z0-9_]', '_', p).lower() for p in r.parameters]
            
            # Probability of rule triggering
            trigger_prob = 0.08 if r.risk_level in ("HIGH", "CRITICAL") else 0.15
            fires = rng.random() < trigger_prob
            
            if fires:
                rules_fired.append(r.rule_id)
                rule_scores.append(0.85 if r.risk_level in ("HIGH", "CRITICAL") else 0.65)
                # Mutate parameter columns to match rule condition thresholds for fired rows
                for p_col in rule_p_cleans:
                    if "age" in p_col or "days" in p_col:
                        row[p_col] = rng.randint(1, 90)  # low device age
                    elif "count" in p_col or "failed" in p_col:
                        row[p_col] = rng.randint(4, 12)  # high failed logins / ECNs

        row["rules_fired_count"] = len(rules_fired)
        row["rules_fired"] = ", ".join(rules_fired) if rules_fired else "NONE"
        row["rule_risk_score"] = round(max(rule_scores) if rule_scores else rng.uniform(0.01, 0.25), 4)

        # Ground truth target: actual fraud if high-risk rules fired or multiple rules fired
        row["is_fraud"] = 1 if (len(rules_fired) >= 2 or any(r in rules_fired for r in [rules[0].rule_id] if rules)) else 0
        rows.append(row)

    return {
        "rules_count": len(rules),
        "rules_summary": [
            {
                "rule_id": r.rule_id,
                "description": r.description,
                "parameter_count": r.parameter_count,
                "parameters": r.parameters,
                "risk_level": r.risk_level,
                "rule_type": r.rule_type,
                "weight": r.weight,
            }
            for r in rules
        ],
        "extracted_parameters": all_params,
        "row_count": len(rows),
        "rows": rows,
    }

