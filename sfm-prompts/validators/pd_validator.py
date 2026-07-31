#!/usr/bin/env python3
"""
SFM PD Stage Runtime Validator
يفحص ملفات PD JSON ويكشف:
- تهريب الحلول (solution leakage)
- لغة المرحلة (stage language)
- انحراف النطاق (scope drift)
- تطابق البوابة (gate consistency)
- هيكل النودات (node structure)
- التتبعية (traceability)
"""

import json
import sys
import re
from pathlib import Path
from datetime import datetime


# ═══════════════════════════════════════
# Banned Words — كلمات ممنوعة في PD
# ═══════════════════════════════════════

BANNED_WORDS_AR = [
    "نظام", "مركزي", "مركزية", "آلي", "آلياً", "أتمتة",
    "واجهة", "تطبيق", "قاعدة بيانات", "منصة", "برمجة",
    "خادم", "سيرفر", "شاشة", "رقمي", "إلكتروني", "أونلاين",
    "dashboard", "API", "UI",
]

BANNED_WORDS_EN = [
    "system", "centralized", "automated", "automation", "platform",
    "interface", "dashboard", "database", "api", "app", "application",
    "server", "digital", "online", "software", "tool", "solution",
    "framework", "architecture", "ui", "ux",
]

# نودات مستثناة من فحص الكلمات الممنوعة (outScope يمكن يذكر حلول مؤجلة)
BANNED_EXEMPT_FIELDS = ["outScope"]

# ═══════════════════════════════════════
# Required PD Node Types
# ═══════════════════════════════════════

REQUIRED_NODES = {
    "group": {"type": "group", "min": 1, "max": 1},
    "summary": {"type": "pd-summary-node", "min": 1},
    "actors": {"type": "pd-actors-node", "min": 1},
    "goals": {"type": "pd-goals-node", "min": 1},
    "pain": {"type": "pd-pain-points-node", "min": 1},
    "constraints": {"type": "pd-constraints-node", "min": 1},
    "scope": {"type": "pd-scope-node", "min": 1},
    "signals": {"type": "pd-signals-node", "min": 1},
    "unknowns": {"type": "pd-unknowns-node", "min": 1},
    "gate": {"type": "gate-problem", "min": 1, "max": 1},
}

# ═══════════════════════════════════════
# Invented Number Pattern
# ═══════════════════════════════════════

INVENTED_NUMBER_PATTERN = re.compile(
    r'\b(\d{1,3})\s*%'  # catches "50%", "90 %", etc.
)


class ValidationResult:
    def __init__(self):
        self.errors = []    # 💀 قاتل — الملف مرفوض
        self.warnings = []  # ⚠️ تحذير — يحتاج مراجعة
        self.passed = []    # ✅ نجح

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
        lines.append(" SFM PD Validator Report")
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
        lines.append(f"Result: {'❌ PD_INVALID' if self.errors else '✅ PD_VALID'}")
        lines.append(f"Passed: {len(self.passed)}/{total}  "
                      f"Warnings: {len(self.warnings)}  "
                      f"Errors: {len(self.errors)}")
        lines.append("═" * 60)
        return "\n".join(lines)


# ═══════════════════════════════════════
# Validator 1: Node Structure
# ═══════════════════════════════════════

def validate_node_structure(data, result):
    """Checks required nodes, parentId, extent, data fields."""
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    if not nodes:
        result.error("node-structure", "No nodes found")
        return

    # Check top-level structure
    if "evidence" not in data:
        result.warn("node-structure", "Missing 'evidence' array")
    if "exportedAt" not in data:
        result.error("node-structure", "Missing 'exportedAt' field")

    # Find group node
    group_nodes = [n for n in nodes if n.get("type") == "group"]
    if not group_nodes:
        result.error("node-structure", "No group node found")
        return
    if len(group_nodes) > 1:
        result.error("node-structure", f"Multiple group nodes found: {len(group_nodes)}")

    group_id = group_nodes[0]["id"]

    # Check group id naming
    if not re.match(r"group-pd-\d{8}-[a-z_]+", group_id):
        result.error("node-structure", f"Group ID '{group_id}' doesn't match pattern: group-pd-YYYYMMDD-project_name")
    else:
        result.ok("node-structure", f"Group ID naming correct: {group_id}")

    # Check each non-group node has parentId + extent
    non_group = [n for n in nodes if n.get("type") != "group"]
    missing_parent = []
    missing_extent = []
    for n in non_group:
        if n.get("parentId") != group_id:
            missing_parent.append(n.get("id", "?"))
        if n.get("extent") != "parent":
            missing_extent.append(n.get("id", "?"))

    if missing_parent:
        result.error("node-structure", f"Nodes missing parentId: {missing_parent}")
    else:
        result.ok("node-structure", f"All {len(non_group)} nodes have correct parentId")

    if missing_extent:
        result.error("node-structure", f"Nodes missing extent='parent': {missing_extent}")
    else:
        result.ok("node-structure", f"All {len(non_group)} nodes have extent='parent'")

    # Check required node types present
    type_counts = {}
    for n in nodes:
        t = n.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1

    for name, req in REQUIRED_NODES.items():
        count = type_counts.get(req["type"], 0)
        if count < req.get("min", 1):
            result.error("node-structure", f"Missing required node type: {req['type']} (found {count}, need >= {req.get('min', 1)})")
        elif "max" in req and count > req["max"]:
            result.warn("node-structure", f"Too many {req['type']} nodes: {count} (expected <= {req['max']})")
        else:
            result.ok("node-structure", f"Node type {req['type']} present ({count})")

    # Check data fields
    for n in non_group:
        ndata = n.get("data", {})
        nid = n.get("id", "?")
        ntype = n.get("type", "?")

        if "label" not in ndata:
            result.error("node-structure", "Missing 'label' in data", node_id=nid)

        if ntype == "pd-scope-node":
            if "points" in ndata:
                result.error("node-structure", "pd-scope-node should use inScope/outScope, not points", node_id=nid)
            if "inScope" not in ndata:
                result.error("node-structure", "Missing 'inScope' in scope node", node_id=nid)
            if "outScope" not in ndata:
                result.error("node-structure", "Missing 'outScope' in scope node", node_id=nid)
        elif ntype == "gate-problem":
            if "points" in ndata:
                result.error("node-structure", "gate-problem should use gateStatus/gateChecklist, not points", node_id=nid)
            for field in ["gateStatus", "decisionAuthority", "gateChecklist"]:
                if field not in ndata:
                    result.error("node-structure", f"Missing '{field}' in gate node", node_id=nid)
        else:
            if "points" not in ndata:
                result.warn("node-structure", "Missing 'points' array", node_id=nid)
            elif not isinstance(ndata["points"], list):
                result.error("node-structure", "points must be an array", node_id=nid)

    # Check edges
    if len(edges) < 8:
        result.warn("node-structure", f"Only {len(edges)} edges found (expected >= 12)")
    else:
        result.ok("node-structure", f"{len(edges)} edges present")

    # Check flat data
    for n in non_group:
        ndata = n.get("data", {})
        nid = n.get("id", "?")
        points = ndata.get("points", [])
        if isinstance(points, list):
            for i, p in enumerate(points):
                if not isinstance(p, str):
                    result.error("node-structure", f"points[{i}] is not a string (type: {type(p).__name__})", node_id=nid, field="points")


# ═══════════════════════════════════════
# Validator 2: Anti-Solution Leakage
# ═══════════════════════════════════════

def validate_anti_solution(data, result):
    """Detects solution language in PD nodes."""
    nodes = data.get("nodes", [])
    violations = []

    for n in nodes:
        if n.get("type") == "group":
            continue

        nid = n.get("id", "?")
        ndata = n.get("data", {})

        # Collect all text to scan
        texts_to_scan = []

        for field in ["description", "label"]:
            val = ndata.get(field, "")
            if val:
                texts_to_scan.append((field, val))

        for field in ["points", "inScope"]:
            items = ndata.get(field, [])
            if isinstance(items, list):
                for i, item in enumerate(items):
                    if isinstance(item, str):
                        texts_to_scan.append((f"{field}[{i}]", item))

        # outScope is exempt — it can mention solutions being deferred
        # gateChecklist is exempt — it's meta-governance

        for field_name, text in texts_to_scan:
            text_lower = text.lower()

            # Check Arabic banned words
            for word in BANNED_WORDS_AR:
                if word in text:
                    violations.append((nid, field_name, word, text[:80]))

            # Check English banned words
            for word in BANNED_WORDS_EN:
                # Word boundary check for English
                if re.search(r'\b' + re.escape(word) + r'\b', text_lower):
                    violations.append((nid, field_name, word, text[:80]))

    if violations:
        for nid, field, word, excerpt in violations:
            result.error("anti-solution", f"Banned word '{word}' detected: \"{excerpt}...\"", node_id=nid, field=field)
    else:
        result.ok("anti-solution", "No solution language detected in any node")


# ═══════════════════════════════════════
# Validator 3: Stage Language
# ═══════════════════════════════════════

def validate_stage_language(data, result):
    """Ensures PD nodes use problem language, not solution language."""
    nodes = data.get("nodes", [])

    # Check signals describe "disappearance of pain" not "appearance of solution"
    signal_nodes = [n for n in nodes if n.get("type") == "pd-signals-node"]
    for sn in signal_nodes:
        points = sn.get("data", {}).get("points", [])
        for i, point in enumerate(points):
            # Check for implied solution direction
            solution_hints = [
                "يحجزون بدون", "بدون اتصال", "بدون ما يتصل",
                "عبر الإنترنت", "من جواله", "أونلاين",
                "تلقائياً", "تلقائيا",
            ]
            for hint in solution_hints:
                if hint in point:
                    result.warn("stage-language",
                                f"Signal implies solution direction: \"{point[:60]}\"",
                                node_id=sn.get("id"), field=f"points[{i}]")

    # Check goals are non-technical
    goal_nodes = [n for n in nodes if n.get("type") == "pd-goals-node"]
    for gn in goal_nodes:
        points = gn.get("data", {}).get("points", [])
        for i, point in enumerate(points):
            tech_hints = ["REST", "API", "HTTP", "SQL", "frontend", "backend", "deploy"]
            for hint in tech_hints:
                if hint.lower() in point.lower():
                    result.error("stage-language",
                                 f"Technical language in goals: \"{point[:60]}\"",
                                 node_id=gn.get("id"), field=f"points[{i}]")

    if not any("stage-language" in str(e) for e in result.errors + result.warnings):
        result.ok("stage-language", "Stage language is appropriate for PD")


# ═══════════════════════════════════════
# Validator 4: Scope Drift Detector
# ═══════════════════════════════════════

def validate_scope_drift(data, result):
    """Checks that inScope describes desired outcomes, not features."""
    nodes = data.get("nodes", [])
    scope_nodes = [n for n in nodes if n.get("type") == "pd-scope-node"]

    for sn in scope_nodes:
        ndata = sn.get("data", {})
        in_scope = ndata.get("inScope", [])

        for i, item in enumerate(in_scope):
            # Feature-like patterns
            feature_patterns = [
                r"تطوير\s", r"بناء\s", r"إنشاء\s", r"تصميم\s",
                r"برمجة\s", r"تنفيذ\s",
                r"develop", r"build", r"create", r"implement", r"design",
            ]
            for pat in feature_patterns:
                if re.search(pat, item, re.IGNORECASE):
                    result.error("scope-drift",
                                 f"inScope contains feature language: \"{item[:60]}\"",
                                 node_id=sn.get("id"), field=f"inScope[{i}]")

        out_scope = ndata.get("outScope", [])
        if len(out_scope) < 2:
            result.warn("scope-drift", "outScope has fewer than 2 items — scope creep risk",
                        node_id=sn.get("id"))

    if not any("scope-drift" in str(e) for e in result.errors + result.warnings):
        result.ok("scope-drift", "Scope items describe outcomes, not features")


# ═══════════════════════════════════════
# Validator 5: Gate Consistency
# ═══════════════════════════════════════

def validate_gate_consistency(data, result):
    """Ensures gate status is consistent with unknowns."""
    nodes = data.get("nodes", [])

    gate_nodes = [n for n in nodes if n.get("type") == "gate-problem"]
    unknown_nodes = [n for n in nodes if n.get("type") == "pd-unknowns-node"]

    if not gate_nodes:
        result.error("gate-consistency", "No gate-problem node found")
        return

    gate = gate_nodes[0]
    gate_data = gate.get("data", {})
    gate_status = gate_data.get("gateStatus", "")
    checklist = gate_data.get("gateChecklist", [])
    authority = gate_data.get("decisionAuthority", "")

    # Count unknowns
    total_unknowns = 0
    for un in unknown_nodes:
        points = un.get("data", {}).get("points", [])
        total_unknowns += len(points)

    # KILLER RULE: If unknowns > 0, gate must NOT be approved
    if total_unknowns > 0 and gate_status == "approved":
        result.error("gate-consistency",
                     f"Gate is 'approved' but there are {total_unknowns} open unknowns. "
                     f"Must be 'pending_human_review'")
    elif total_unknowns > 0 and gate_status == "pending_human_review":
        result.ok("gate-consistency",
                  f"Gate correctly set to 'pending_human_review' ({total_unknowns} unknowns)")
    elif total_unknowns == 0 and gate_status == "approved":
        result.ok("gate-consistency", "Gate approved with 0 unknowns — valid")
    elif total_unknowns == 0 and gate_status == "pending_human_review":
        result.warn("gate-consistency",
                    "Gate is 'pending_human_review' but there are 0 unknowns — could be 'approved'")

    # Check decision authority
    if authority != "Human Only":
        result.error("gate-consistency",
                     f"decisionAuthority should be 'Human Only', found: '{authority}'")
    else:
        result.ok("gate-consistency", "decisionAuthority = 'Human Only'")

    # Check checklist has items
    if len(checklist) < 5:
        result.warn("gate-consistency", f"gateChecklist has only {len(checklist)} items (recommend >= 8)")
    else:
        result.ok("gate-consistency", f"gateChecklist has {len(checklist)} items")


# ═══════════════════════════════════════
# Validator 6: Invented Numbers
# ═══════════════════════════════════════

def validate_no_invented_numbers(data, result):
    """Detects invented percentages in signals."""
    nodes = data.get("nodes", [])
    signal_nodes = [n for n in nodes if n.get("type") == "pd-signals-node"]

    found_numbers = []
    for sn in signal_nodes:
        points = sn.get("data", {}).get("points", [])
        for i, point in enumerate(points):
            matches = INVENTED_NUMBER_PATTERN.findall(point)
            if matches:
                found_numbers.append((sn.get("id"), f"points[{i}]", point[:60], matches))

    if found_numbers:
        for nid, field, excerpt, nums in found_numbers:
            result.error("invented-numbers",
                         f"Invented percentage detected ({', '.join(n + '%' for n in nums)}): \"{excerpt}\"",
                         node_id=nid, field=field)
    else:
        result.ok("invented-numbers", "No invented percentages in signals")


# ═══════════════════════════════════════
# Validator 7: Boundary Questions
# ═══════════════════════════════════════

def validate_boundary_questions(data, result):
    """Checks that unknowns include boundary enforcement questions."""
    nodes = data.get("nodes", [])
    unknown_nodes = [n for n in nodes if n.get("type") == "pd-unknowns-node"]

    if not unknown_nodes:
        return

    all_questions = []
    for un in unknown_nodes:
        points = un.get("data", {}).get("points", [])
        all_questions.extend(points)

    if not all_questions:
        result.warn("boundary-questions", "No questions found in unknowns")
        return

    # Boundary question indicators
    boundary_indicators = [
        "حدودي", "boundary",
        "أسوأ", "worst",
        "الأهم", "most important", "أولوية", "priority",
        "القرار النهائي", "decision",
        "محاولات سابقة", "previous attempts", "فشلت", "failed",
        "يومية أم", "استثنائية",
        "إذا لم نحل", "if we don't",
        "مين يملك", "who owns",
    ]

    boundary_count = 0
    for q in all_questions:
        q_lower = q.lower()
        if any(ind in q_lower or ind in q for ind in boundary_indicators):
            boundary_count += 1

    ratio = boundary_count / len(all_questions) if all_questions else 0

    if boundary_count == 0:
        result.error("boundary-questions",
                     f"No boundary enforcement questions found in {len(all_questions)} unknowns. "
                     f"Need at least 1 boundary question per 3 questions.")
    elif ratio < 0.25:
        result.warn("boundary-questions",
                    f"Only {boundary_count}/{len(all_questions)} boundary questions "
                    f"({ratio:.0%}). Recommend >= 33%.")
    else:
        result.ok("boundary-questions",
                  f"{boundary_count}/{len(all_questions)} boundary questions ({ratio:.0%})")


# ═══════════════════════════════════════
# Validator 8: Traceability
# ═══════════════════════════════════════

def validate_traceability(data, result):
    """Checks file naming consistency and edge connectivity."""
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    exported_at = data.get("exportedAt", "")

    # Check exportedAt format
    if exported_at:
        try:
            datetime.fromisoformat(exported_at.replace("Z", "+00:00"))
            result.ok("traceability", f"exportedAt is valid ISO: {exported_at}")
        except ValueError:
            result.error("traceability", f"exportedAt is not valid ISO: {exported_at}")
    else:
        result.error("traceability", "Missing exportedAt")

    # Check all edge sources/targets exist
    node_ids = {n.get("id") for n in nodes}
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src not in node_ids:
            result.error("traceability", f"Edge '{edge.get('id')}' source '{src}' not found in nodes")
        if tgt not in node_ids:
            result.error("traceability", f"Edge '{edge.get('id')}' target '{tgt}' not found in nodes")

    # Check gate is connected (has incoming edges)
    gate_ids = {n.get("id") for n in nodes if n.get("type") == "gate-problem"}
    gate_targets = {e.get("target") for e in edges if e.get("target") in gate_ids}
    if gate_ids and not gate_targets:
        result.warn("traceability", "Gate node has no incoming edges")
    elif gate_ids:
        result.ok("traceability", f"Gate has {len(gate_targets)} incoming edges")


# ═══════════════════════════════════════
# Validator 8: Cognitive Provenance
# ═══════════════════════════════════════

VALID_SOURCES = {"stakeholder_statement", "ai_inference", "domain_knowledge"}
VALID_VALIDATION_STATUSES = {"human_pending", "human_validated", "assumption"}

# Nodes that should typically be stakeholder_statement
STAKEHOLDER_NODES = {"pd-summary-1", "pd-pain-4"}
# Nodes that should typically be ai_inference with derived_from
INFERENCE_NODES = {"pd-insight-9", "pd-outcome-10", "pd-direction-11"}
# Nodes exempt from provenance
EXEMPT_TYPES = {"group", "gate-problem"}


def validate_provenance(data, result):
    """Validates Cognitive Provenance Layer in PD nodes."""
    nodes = data.get("nodes", [])
    has_any_provenance = False

    for node in nodes:
        node_type = node.get("type", "")
        node_id = node.get("id", "")
        ndata = node.get("data", {})

        # Skip exempt types
        if node_type in EXEMPT_TYPES:
            continue

        # Determine expected point count
        if node_type == "pd-scope-node":
            # Scope uses scope_provenance instead
            in_scope = ndata.get("inScope", [])
            out_scope = ndata.get("outScope", [])
            scope_prov = ndata.get("scope_provenance", [])

            if not scope_prov:
                # Also check if provenance exists as fallback
                prov = ndata.get("provenance", [])
                if not prov:
                    result.warn("provenance",
                                f"No scope_provenance found",
                                node_id=node_id)
                    continue

            has_any_provenance = True
            expected_count = len(in_scope) + len(out_scope)
            actual_items = scope_prov if scope_prov else ndata.get("provenance", [])

            if len(actual_items) != expected_count:
                result.warn("provenance",
                            f"scope_provenance count ({len(actual_items)}) != "
                            f"inScope+outScope count ({expected_count})",
                            node_id=node_id)

            for item in actual_items:
                _validate_provenance_item(item, node_id, result)
            continue

        # Regular nodes with points[]
        points = ndata.get("points", [])
        prov = ndata.get("provenance", [])

        if not prov:
            result.warn("provenance",
                        f"No provenance[] found",
                        node_id=node_id)
            continue

        has_any_provenance = True

        # P1: Count match
        if len(prov) != len(points):
            result.error("provenance",
                         f"provenance count ({len(prov)}) != points count ({len(points)})",
                         node_id=node_id)

        for item in prov:
            _validate_provenance_item(item, node_id, result)

        # P2: Summary and Pain should be stakeholder_statement
        if node_id in STAKEHOLDER_NODES:
            for item in prov:
                src = item.get("source", "")
                if src != "stakeholder_statement":
                    result.warn("provenance",
                                f"Expected stakeholder_statement for {node_id}, "
                                f"got '{src}' at point_index {item.get('point_index', '?')}",
                                node_id=node_id)

        # P3: Insight/Direction should have derived_from
        if node_id in INFERENCE_NODES:
            for item in prov:
                derived = item.get("derived_from", [])
                if not derived:
                    result.warn("provenance",
                                f"Inference node missing derived_from at "
                                f"point_index {item.get('point_index', '?')}",
                                node_id=node_id)

    # P4: Check assumptions have matching unknowns
    unknown_nodes = [n for n in nodes if n.get("type") == "pd-unknowns-node"]
    unknown_texts = []
    for un in unknown_nodes:
        unknown_texts.extend(un.get("data", {}).get("points", []))

    assumption_count = 0
    for node in nodes:
        ndata = node.get("data", {})
        prov = ndata.get("provenance", [])
        for item in prov:
            if item.get("validation_status") == "assumption":
                assumption_count += 1

    if assumption_count > 0 and len(unknown_texts) == 0:
        result.error("provenance",
                     f"{assumption_count} assumptions found but no unknowns to validate them")

    # Summary
    if has_any_provenance:
        prov_errors = [e for e in result.errors if "provenance" in str(e)]
        prov_warns = [w for w in result.warnings if "provenance" in str(w)]
        if not prov_errors:
            result.ok("provenance",
                      f"Cognitive Provenance Layer present "
                      f"({0 if not prov_warns else len(prov_warns)} warnings)")
    else:
        result.warn("provenance",
                    "No provenance data found in any node — v5 Provenance Layer not applied")


def _validate_provenance_item(item, node_id, result):
    """Validate a single provenance item."""
    # Check required fields
    required = ["point_index", "source", "confidence", "derived_from",
                "validation_status", "reasoning"]
    for field in required:
        if field not in item:
            result.error("provenance",
                         f"Missing required field '{field}' in provenance",
                         node_id=node_id,
                         field=f"provenance[{item.get('point_index', '?')}]")
            return

    # Validate source
    src = item.get("source", "")
    if src not in VALID_SOURCES:
        result.error("provenance",
                     f"Invalid source '{src}' — must be one of {VALID_SOURCES}",
                     node_id=node_id,
                     field=f"provenance[{item.get('point_index', '?')}]")

    # Validate confidence range
    conf = item.get("confidence", 0)
    if not isinstance(conf, (int, float)) or conf < 0 or conf > 1:
        result.error("provenance",
                     f"Confidence must be 0.0-1.0, got {conf}",
                     node_id=node_id,
                     field=f"provenance[{item.get('point_index', '?')}]")

    # Validate validation_status
    vs = item.get("validation_status", "")
    if vs not in VALID_VALIDATION_STATUSES:
        result.error("provenance",
                     f"Invalid validation_status '{vs}'",
                     node_id=node_id,
                     field=f"provenance[{item.get('point_index', '?')}]")

    # Validate derived_from is a list
    df = item.get("derived_from", [])
    if not isinstance(df, list):
        result.error("provenance",
                     f"derived_from must be array, got {type(df).__name__}",
                     node_id=node_id,
                     field=f"provenance[{item.get('point_index', '?')}]")

    # Validate reasoning is non-empty
    reasoning = item.get("reasoning", "")
    if not reasoning or len(reasoning.strip()) < 5:
        result.warn("provenance",
                    f"Reasoning too short or empty",
                    node_id=node_id,
                    field=f"provenance[{item.get('point_index', '?')}]")

    # Check scope_provenance specific fields
    if "scope_type" in item:
        if item["scope_type"] not in ("inScope", "outScope"):
            result.error("provenance",
                         f"Invalid scope_type '{item['scope_type']}'",
                         node_id=node_id)


# ═══════════════════════════════════════
# Main Runner
# ═══════════════════════════════════════

def validate_pd(filepath):
    """Run all validators on a PD JSON file."""
    path = Path(filepath)
    if not path.exists():
        print(f"❌ File not found: {filepath}")
        return None

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = ValidationResult()

    # Run all validators
    validate_node_structure(data, result)
    validate_anti_solution(data, result)
    validate_stage_language(data, result)
    validate_scope_drift(data, result)
    validate_gate_consistency(data, result)
    validate_no_invented_numbers(data, result)
    validate_boundary_questions(data, result)
    validate_traceability(data, result)
    validate_provenance(data, result)

    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python pd_validator.py <pd_file.json> [pd_file2.json ...]")
        print("Example: python pd_validator.py clinic_pd.json hospital_pd.json")
        sys.exit(1)

    for filepath in sys.argv[1:]:
        print(f"\n📄 Validating: {filepath}")
        result = validate_pd(filepath)
        if result:
            print(result.report())
            if not result.is_valid:
                sys.exit(1)


if __name__ == "__main__":
    main()
