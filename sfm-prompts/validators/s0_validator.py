#!/usr/bin/env python3
"""
SFM S0 Stage Runtime Validator
يفحص ملفات S0 JSON ويكشف:
- هيكل النودات (node structure) — 8 نود بالضبط
- تهريب الحلول (solution/tech leakage)
- جودة المحتوى (content quality)
- تطابق البوابة (gate consistency)
- Provenance (traceability metadata)
"""

import json
import sys
import re
from pathlib import Path


# ═══════════════════════════════════════
# Banned Words — S0 Solution Ban
# ═══════════════════════════════════════

S0_SOLUTION_BAN_AR = [
    "نظام", "مركزي", "مركزية", "آلي", "آلياً", "أتمتة",
    "واجهة", "تطبيق", "قاعدة بيانات", "منصة", "برمجة",
    "خادم", "سيرفر", "شاشة", "رقمي", "إلكتروني", "أونلاين",
]

# False positives: "آلية" (mechanism) ≠ "آلي" (automated)
AR_FALSE_POSITIVES = ["آلية", "آليات"]

S0_SOLUTION_BAN_EN = [
    "laravel", "next.js", "nextjs", "react", "node", "php", "codeigniter",
    "postgresql", "mysql", "mongodb", "sqlite", "redis", "kafka",
    "microservices", "kubernetes", "docker", "api endpoints",
    "vue", "angular", "express", "django", "flask", "spring",
    "graphql", "rest api", "websocket", "nginx", "aws", "azure", "gcp",
    "crud", "ui", "frontend", "backend", "endpoint", "migration",
    "deploy", "database", "schema", "software", "tool", "solution",
    "framework", "architecture", "dashboard",
]

# ═══════════════════════════════════════
# Required S0 Node Prefixes
# ═══════════════════════════════════════

REQUIRED_NODE_PREFIXES = [
    "group",
    "stage-0",
    "insight-node",
    "outcome-node",
    "direction-node",
    "gate-problem",
    "alignment-gate",
    "evidence-node",
]

# ═══════════════════════════════════════
# Governance Keywords (at least 1 required in Insight)
# ═══════════════════════════════════════

GOVERNANCE_KEYWORDS = [
    "حوكمة", "governance", "إدارة", "رقابة", "إسناد", "اسناد",
    "مساءلة", "صلاحيات", "ضبط", "تنظيم", "مسؤولية", "اعتماد",
    "سلطة", "قرار",
]

# ═══════════════════════════════════════
# Outcome Required Dimensions (all 3 required)
# ═══════════════════════════════════════

OUTCOME_DIMENSIONS = {
    "Data Integrity / موثوقية البيانات": [
        "موثوقية", "سلامة البيانات", "data integrity", "دقة البيانات",
        "بيانات موثوقة", "صحة البيانات", "جودة البيانات", "بيانات دقيقة",
    ],
    "Process Governance / حوكمة الإجراءات": [
        "حوكمة", "governance", "إجراءات", "اجراءات", "إسناد", "اسناد",
        "صلاحيات", "مساءلة", "رقابة", "ضبط", "تنظيم",
    ],
    "Availability / توفر واستقرار": [
        "توفر", "استقرار", "availability", "operational stability",
        "تشغيلي", "تعطل", "انقطاع", "استمرارية", "جاهزية",
    ],
}

# ═══════════════════════════════════════
# Invented Number Pattern
# ═══════════════════════════════════════

INVENTED_NUMBER_PATTERN = re.compile(r'\b(\d{1,3})\s*%')


class ValidationResult:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.passed = []

    def error(self, validator, message, node_id=None, field=None):
        loc = f" [{node_id}]" if node_id else ""
        fld = f" .{field}" if field else ""
        self.errors.append(f"💀 [{validator}]{loc}{fld}: {message}")

    def warn(self, validator, message, node_id=None, field=None):
        loc = f" [{node_id}]" if node_id else ""
        fld = f" .{field}" if field else ""
        self.warnings.append(f"⚠️ [{validator}]{loc}{fld}: {message}")

    def ok(self, validator, message):
        self.passed.append(f"✅ [{validator}]: {message}")

    @property
    def is_valid(self):
        return len(self.errors) == 0

    def report(self):
        lines = []
        lines.append("═" * 60)
        lines.append(" SFM S0 Validator Report")
        lines.append("═" * 60)
        lines.append("")

        if self.passed:
            lines.append("── Passed ──")
            for p in self.passed:
                lines.append(f"  {p}")
            lines.append("")

        if self.warnings:
            lines.append("── Warnings ──")
            for w in self.warnings:
                lines.append(f"  {w}")
            lines.append("")

        if self.errors:
            lines.append("── ERRORS (file rejected) ──")
            for e in self.errors:
                lines.append(f"  {e}")
            lines.append("")

        lines.append("─" * 60)
        total = len(self.passed) + len(self.warnings) + len(self.errors)
        lines.append(f"Result: {'❌ S0_INVALID' if self.errors else '✅ S0_VALID'}")
        lines.append(f"Passed: {len(self.passed)}/{total}  "
                      f"Warnings: {len(self.warnings)}  "
                      f"Errors: {len(self.errors)}")
        lines.append("═" * 60)
        return "\n".join(lines)


def get_node_by_prefix(nodes, prefix):
    for n in nodes:
        if isinstance(n.get("id"), str) and n["id"].startswith(prefix):
            return n
    return None


def get_node_data(nodes, prefix):
    node = get_node_by_prefix(nodes, prefix)
    if node:
        return node.get("data", {})
    return {}


def collect_all_text(nodes):
    parts = []
    for n in nodes:
        d = n.get("data", {})
        for key in ["description", "justification", "owner"]:
            if d.get(key):
                parts.append(str(d[key]))
        for key in ["aiResponsibilities", "humanResponsibilities", "gateChecklist"]:
            if isinstance(d.get(key), list):
                parts.extend([str(x) for x in d[key]])
    return " ".join(parts)


# ═══════════════════════════════════════
# Validator 1: Node Structure
# ═══════════════════════════════════════

def validate_node_structure(data, result):
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    if not nodes:
        result.error("node-structure", "No nodes found")
        return

    if "exportedAt" not in data or not data["exportedAt"]:
        result.error("node-structure", "Missing or empty 'exportedAt' field")
    else:
        result.ok("node-structure", "exportedAt present")

    # Check all required node prefixes
    for prefix in REQUIRED_NODE_PREFIXES:
        found = get_node_by_prefix(nodes, prefix)
        if not found:
            result.error("node-structure", f"Missing required node with prefix '{prefix}'")
        else:
            result.ok("node-structure", f"Node '{prefix}' found: {found['id']}")

    # Check total node count (should be 8)
    if len(nodes) != 8:
        result.warn("node-structure", f"Expected 8 nodes, found {len(nodes)}")

    # Find group node
    group_node = get_node_by_prefix(nodes, "group")
    if not group_node:
        return

    group_id = group_node["id"]

    # Check parentId + extent for all non-group nodes
    for n in nodes:
        nid = n.get("id", "?")
        if nid == group_id:
            continue

        # Check data{} wrapper
        if "data" not in n:
            result.error("node-structure", "Missing 'data' wrapper — all fields must be inside data:{}", node_id=nid)
            continue

        nd = n.get("data", {})

        # Check parentId
        if n.get("parentId") != group_id:
            result.error("node-structure",
                         f"parentId='{n.get('parentId')}' does not match group id='{group_id}'",
                         node_id=nid)
        else:
            result.ok("node-structure", f"parentId correct for {nid}")

        # Check extent
        if n.get("extent") != "parent":
            result.error("node-structure", "Missing or wrong extent (must be 'parent')", node_id=nid)

        # Check data.group
        if nd.get("group") != "S0":
            result.warn("node-structure", f"data.group should be 'S0', found '{nd.get('group')}'", node_id=nid)

        # Check description for content nodes
        if nid.startswith(("stage-0", "insight-node", "outcome-node", "direction-node")):
            desc = nd.get("description", "")
            if not desc or len(desc) < 20:
                result.error("node-structure", f"description empty or too short (min 20 chars, got {len(desc)})", node_id=nid)

    # Check edges: exactly 6 custom edges
    custom_edges = [e for e in edges if e.get("type") == "custom"]
    if len(custom_edges) != 6:
        result.error("node-structure", f"Expected exactly 6 edges with type 'custom', found {len(custom_edges)}")
    else:
        result.ok("node-structure", "6 custom edges found")


# ═══════════════════════════════════════
# Validator 2: Anti-Solution
# ═══════════════════════════════════════

def _is_false_positive_ar(word, text, pos):
    """Check if 'آلي' match is actually 'آلية' (mechanism)."""
    if word == "آلي":
        for fp in AR_FALSE_POSITIVES:
            fp_start = text.find(fp)
            while fp_start != -1:
                if fp_start == pos:
                    return True
                fp_start = text.find(fp, fp_start + 1)
    return False


def validate_anti_solution(data, result):
    nodes = data.get("nodes", [])
    has_error = False

    for n in nodes:
        nid = n.get("id", "?")
        nd = n.get("data", {})
        desc = nd.get("description") or ""

        for word in S0_SOLUTION_BAN_AR:
            pos = desc.find(word)
            while pos != -1:
                if not _is_false_positive_ar(word, desc, pos):
                    result.error("anti-solution", f"Banned word '{word}' found in description", node_id=nid)
                    has_error = True
                    break
                pos = desc.find(word, pos + 1)

        desc_lower = desc.lower()
        for word in S0_SOLUTION_BAN_EN:
            if word.lower() in desc_lower:
                result.error("anti-solution", f"Banned word '{word}' found in description", node_id=nid)
                has_error = True

    if not has_error:
        result.ok("anti-solution", "No solution/tech words detected")


# ═══════════════════════════════════════
# Validator 3: Stage Description Quality
# ═══════════════════════════════════════

def validate_stage_description(data, result):
    nodes = data.get("nodes", [])
    stage_data = get_node_data(nodes, "stage-0")
    desc = stage_data.get("description", "")

    if not desc or len(desc) < 20:
        result.error("stage-quality", "Stage description is empty or too short")
        return

    result.ok("stage-quality", f"Stage description present ({len(desc)} chars)")

    # Check restrictions
    restrictions = stage_data.get("restrictions", [])
    if not restrictions:
        result.error("stage-quality", "Missing restrictions list in stage-0")
    else:
        result.ok("stage-quality", f"restrictions list present ({len(restrictions)} items)")

    # Check ai/human percentages
    if stage_data.get("aiPercentage") is None or stage_data.get("humanPercentage") is None:
        result.warn("stage-quality", "Missing aiPercentage/humanPercentage")
    else:
        result.ok("stage-quality", f"ai={stage_data['aiPercentage']}% human={stage_data['humanPercentage']}%")


# ═══════════════════════════════════════
# Validator 4: Insight — Governance Required
# ═══════════════════════════════════════

def validate_insight_governance(data, result):
    nodes = data.get("nodes", [])
    insight_data = get_node_data(nodes, "insight-node")
    desc = (insight_data.get("description") or "").lower()
    all_text = collect_all_text(nodes).lower()

    if not desc:
        result.error("insight-governance", "Insight description is empty")
        return

    has_governance = any(kw in all_text for kw in GOVERNANCE_KEYWORDS)
    if not has_governance:
        result.error("insight-governance",
                     "Insight must mention Governance failure (حوكمة/governance/مساءلة/رقابة/إسناد)")
    else:
        result.ok("insight-governance", "Governance keywords found in text")


# ═══════════════════════════════════════
# Validator 5: Outcome — 3 Dimensions
# ═══════════════════════════════════════

def validate_outcome_dimensions(data, result):
    nodes = data.get("nodes", [])
    outcome_data = get_node_data(nodes, "outcome-node")
    desc = (outcome_data.get("description") or "").lower()

    if not desc:
        result.error("outcome-dimensions", "Outcome description is empty")
        return

    # Check generic language
    if "تحسين النظام" in desc or "improve the system" in desc:
        result.error("outcome-dimensions", "Outcome must NOT use generic language like 'تحسين النظام'")

    missing_dims = []
    for dim_name, keywords in OUTCOME_DIMENSIONS.items():
        if not any(kw in desc for kw in keywords):
            missing_dims.append(dim_name)

    if missing_dims:
        result.error("outcome-dimensions",
                     f"Outcome missing {len(missing_dims)} dimension(s): {', '.join(missing_dims)}")
    else:
        result.ok("outcome-dimensions", "All 3 outcome dimensions present")


# ═══════════════════════════════════════
# Validator 6: Direction — No Solutions
# ═══════════════════════════════════════

def validate_direction(data, result):
    nodes = data.get("nodes", [])
    dir_data = get_node_data(nodes, "direction-node")
    desc = dir_data.get("description") or ""

    if not desc:
        result.error("direction", "Direction description is empty")
        return

    # Check negation as primary
    if re.match(r'^\s*لا\s+نفكر\s+بحلول', desc):
        result.error("direction",
                     "Direction must NOT start with negation 'لا نفكر بحلول' as primary")
    else:
        result.ok("direction", "Direction does not start with negation")

    # Check for solution words (with false-positive handling for Arabic)
    desc_lower = desc.lower()
    found = [w for w in S0_SOLUTION_BAN_EN if w.lower() in desc_lower]
    for w in S0_SOLUTION_BAN_AR:
        pos = desc.find(w)
        while pos != -1:
            if not _is_false_positive_ar(w, desc, pos):
                found.append(w)
                break
            pos = desc.find(w, pos + 1)
    if found:
        result.error("direction", f"Direction contains solution/tech words: {', '.join(found)}")
    else:
        result.ok("direction", "Direction free of solution words")


# ═══════════════════════════════════════
# Validator 7: Gate Consistency
# ═══════════════════════════════════════

def validate_gate(data, result):
    nodes = data.get("nodes", [])
    gate_data = get_node_data(nodes, "gate-problem")

    if not gate_data:
        result.error("gate", "gate-problem node missing")
        return

    # Check gateStatus
    status = gate_data.get("gateStatus", "")
    if status == "approved":
        result.error("gate", "gateStatus is 'approved' — must be 'pending'")
    elif status == "pending":
        result.ok("gate", "gateStatus = pending")
    else:
        result.warn("gate", f"Unexpected gateStatus: '{status}' (expected 'pending')")

    # Check gateChecklist
    checklist = gate_data.get("gateChecklist", [])
    if not isinstance(checklist, list):
        result.error("gate", "gateChecklist must be an array")
        return

    count = len(checklist)
    if count < 5 or count > 7:
        result.error("gate", f"gateChecklist must have 5-7 items, found {count}")
    else:
        result.ok("gate", f"gateChecklist has {count} items (5-7 range)")

    # Check for KPIs in checklist (should be YES/NO)
    kpi_patterns = [r'\d+%', r'accuracy', r'دقة\s*\d+']
    for item in checklist:
        for pattern in kpi_patterns:
            if re.search(pattern, str(item)):
                result.error("gate", f"gateChecklist items must be YES/NO, not KPIs: '{item}'")

    # Check decisionAuthority
    if gate_data.get("decisionAuthority") != "Human Only":
        result.warn("gate", f"decisionAuthority should be 'Human Only', got '{gate_data.get('decisionAuthority')}'")


# ═══════════════════════════════════════
# Validator 8: Evidence
# ═══════════════════════════════════════

def validate_evidence(data, result):
    nodes = data.get("nodes", [])
    ev_data = get_node_data(nodes, "evidence-node")

    if not ev_data:
        result.error("evidence", "evidence-node missing")
        return

    if not ev_data.get("description"):
        result.error("evidence", "Evidence description is empty")
    else:
        result.ok("evidence", "Evidence description present")

    if not ev_data.get("justification"):
        result.error("evidence", "Evidence justification is empty")
    else:
        result.ok("evidence", "Evidence justification present")

    if not ev_data.get("owner"):
        result.error("evidence", "Evidence owner is empty")
    else:
        result.ok("evidence", "Evidence owner present")


# ═══════════════════════════════════════
# Validator 9: Invented Numbers
# ═══════════════════════════════════════

def validate_invented_numbers(data, result):
    nodes = data.get("nodes", [])
    all_text = collect_all_text(nodes)

    matches = INVENTED_NUMBER_PATTERN.findall(all_text)
    if matches:
        result.warn("invented-numbers", f"Percentage values found: {', '.join(m + '%' for m in matches)} — verify they're from PD input")
    else:
        result.ok("invented-numbers", "No percentage values detected")


# ═══════════════════════════════════════
# Validator 10: Provenance
# ═══════════════════════════════════════

PROVENANCE_REQUIRED_PREFIXES = ["stage-0", "insight-node", "outcome-node", "direction-node", "evidence-node"]
PROVENANCE_FIELDS = ["source", "confidence", "derived_from", "validation_status", "reasoning"]

def validate_provenance(data, result):
    nodes = data.get("nodes", [])

    for prefix in PROVENANCE_REQUIRED_PREFIXES:
        node = get_node_by_prefix(nodes, prefix)
        if not node:
            continue

        nid = node.get("id", "?")
        nd = node.get("data", {})
        prov = nd.get("provenance")

        if not prov:
            result.warn("provenance", f"Missing provenance in {nid}")
            continue

        # Accept both single object and array
        prov_list = prov if isinstance(prov, list) else [prov]

        for i, p in enumerate(prov_list):
            if not isinstance(p, dict):
                result.warn("provenance", f"provenance[{i}] is not an object", node_id=nid)
                continue

            for field in PROVENANCE_FIELDS:
                if field not in p:
                    result.warn("provenance", f"provenance[{i}] missing '{field}'", node_id=nid)

            # Check derived_from references PD nodes
            derived = p.get("derived_from", [])
            if isinstance(derived, list) and derived:
                for ref in derived:
                    if not isinstance(ref, str) or not ref.startswith("pd-"):
                        result.warn("provenance",
                                    f"derived_from '{ref}' does not reference a PD node (expected pd-*)",
                                    node_id=nid)

        result.ok("provenance", f"Provenance present in {nid}")


# ═══════════════════════════════════════
# Main Runner
# ═══════════════════════════════════════

def validate_s0(file_path):
    result = ValidationResult()

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        result.error("file", f"File not found: {file_path}")
        return result

    try:
        data = json.loads(text, strict=False)
    except json.JSONDecodeError as e:
        result.error("json", f"Invalid JSON: {e}")
        return result

    # Run all validators
    validate_node_structure(data, result)
    validate_anti_solution(data, result)
    validate_stage_description(data, result)
    validate_insight_governance(data, result)
    validate_outcome_dimensions(data, result)
    validate_direction(data, result)
    validate_gate(data, result)
    validate_evidence(data, result)
    validate_invented_numbers(data, result)
    validate_provenance(data, result)

    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 s0_validator.py <file.json> [file2.json ...]")
        sys.exit(1)

    for path in sys.argv[1:]:
        print(f"\n📄 Validating: {path}")
        result = validate_s0(path)
        print(result.report())

    sys.exit(0 if all(validate_s0(p).is_valid for p in sys.argv[1:]) else 1)


if __name__ == "__main__":
    main()
