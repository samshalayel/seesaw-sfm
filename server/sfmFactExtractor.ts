export interface S0Facts {
  core_problem: string;
  harm: string[];
  failure_modes: string[];
  governance_gaps: string[];
  evidence_examples: string[];
  constraints: string[];
  out_of_scope: string[];
  success_criteria: string[];
}

export interface S1Facts {
  actors: string[];
  flow_steps: string[];
  hard_rules: string[];
  edge_cases: string[];
  out_of_scope: string[];
  mvp_boundaries: string[];
}

export interface S2Facts {
  conceptual_components: string[];
  component_relationships: string[];
  state_model: string[];
  governance_rules: string[];
  tradeoffs: string[];
  constraints: string[];
}

export const S0_FACTS_SCHEMA = `{
  "core_problem": "جملة واحدة قوية تصف المشكلة الأساسية",
  "harm": ["3 أضرار ممنوعة ناتجة عن المشكلة"],
  "failure_modes": ["5 نقاط فشل محددة من النص"],
  "governance_gaps": ["3 فجوات حوكمة: assignment, closure approval, serial tracking"],
  "evidence_examples": ["3 أمثلة ملموسة من النص (أرقام متضاربة، إغلاق بدون موافقة، serial مفقود، إلخ)"],
  "constraints": ["2-5 قيود"],
  "out_of_scope": ["3 عناصر خارج النطاق"],
  "success_criteria": ["3 معايير نجاح صارمة"]
}`;

export const S1_FACTS_SCHEMA = `{
  "actors": ["4+ أطراف: مالك التذكرة، رئيس القسم، رئيس الفريق، مهندس/فني..."],
  "flow_steps": ["5 خطوات تدفق واضحة ومحددة (ليس كلام عام)"],
  "hard_rules": [
    "لا عمل دون إسناد",
    "لا تحويل حالة قبل الإسناد",
    "لا إغلاق قبل معاينة القسم الطالب"
  ],
  "edge_cases": ["3+ حالات حدية"],
  "out_of_scope": ["3 عناصر خارج النطاق واضحة"],
  "mvp_boundaries": ["3+ حدود MVP"]
}`;

export const S2_FACTS_SCHEMA = `{
  "conceptual_components": ["3+ مكونات مفاهيمية بأسمائها"],
  "component_relationships": ["3+ علاقات بين المكونات"],
  "state_model": ["3+ حالات لكل كيان رئيسي"],
  "governance_rules": ["3+ قواعد حوكمة"],
  "tradeoffs": ["2+ مفاضلات (أداء/تكلفة/أمن/قابلية التوسع)"],
  "constraints": ["2+ قيود معمارية"]
}`;

export function buildExtractPrompt(stage: "S0" | "S1" | "S2"): string {
  if (stage === "S0") {
    return `STEP A — EXTRACT FACTS (S0):
Before generating any workflow content, you MUST first extract structured facts from the input.
Output a JSON object matching this exact schema:
${S0_FACTS_SCHEMA}

EXTRACTION RULES:
- core_problem: ONE strong sentence — governance/operational failure, not a tech bug
- harm: Real damage caused (data loss, wrong closures, trust erosion)
- failure_modes: Specific failures from the text (dashboard أرقام متضاربة, الإغلاق بدون موافقة المستفيد, عدم تسجيل serial number, server errors/تعليق/عدم حفظ, أدوار غير واضحة)
- governance_gaps: Focus on: assignment gaps, closure approval gaps, serial tracking gaps
- evidence_examples: Quote or reference 3 concrete examples from the input text
- constraints: Real operational constraints (not wishful thinking)
- out_of_scope: What this problem definition explicitly does NOT cover
- success_criteria: Hard measurable criteria (not "improve the system")

FORBIDDEN in S0 facts:
- Solution words (Laravel, Next.js, DB جديدة, API, UI)
- Vague statements without specific references
- Generic improvement language

Return ONLY the JSON object. No explanation.`;
  }

  if (stage === "S1") {
    return `STEP A — EXTRACT FACTS (S1):
Before generating any workflow content, you MUST first extract structured facts from the input and analysis.json.
Output a JSON object matching this exact schema:
${S1_FACTS_SCHEMA}

EXTRACTION RULES:
- actors: MINIMUM 4 actors with specific roles (مالك التذكرة, رئيس القسم, رئيس الفريق, مهندس/فني, عامل, مستفيد...)
- flow_steps: EXACTLY 5 concrete workflow steps (not general descriptions) — each step has a subject, action, and outcome
- hard_rules: MUST include these 3 rules verbatim:
  1. لا عمل دون إسناد
  2. لا تحويل حالة قبل الإسناد
  3. لا إغلاق قبل معاينة القسم الطالب
- edge_cases: Real edge cases from the problem domain
- out_of_scope: Clear boundaries (what S1 does NOT shape)
- mvp_boundaries: What's in MVP vs what's deferred

Return ONLY the JSON object. No explanation.`;
  }

  return `STEP A — EXTRACT FACTS (S2):
Before generating any workflow content, you MUST first extract structured facts from analysis.json and S1 output.
Output a JSON object matching this exact schema:
${S2_FACTS_SCHEMA}

EXTRACTION RULES:
- conceptual_components: Named components from the domain (not tech stack)
- component_relationships: How components interact (data flow, dependencies)
- state_model: State transitions for key entities (ticket states, approval states)
- governance_rules: Rules governing component behavior
- tradeoffs: Real tradeoffs identified (not generic)
- constraints: Architectural constraints (not implementation details)

FORBIDDEN in S2 facts:
- Specific tech stack choices (Laravel, React, PostgreSQL)
- Implementation details (API endpoints, DB schemas)
- Code-level decisions

Return ONLY the JSON object. No explanation.`;
}

export function buildFillPrompt(stage: "S0" | "S1" | "S2"): string {
  if (stage === "S0") {
    return `STEP B — FILL TEMPLATE (S0):
Using ONLY the extracted S0_FACTS above, fill the S0 workflow template.

QUALITY REQUIREMENTS:
- stage.description: MUST contain at least 3 concrete examples from the input (dashboard mismatch, closure without approval, missing serial, server errors)
- insight.description: MUST mention Governance failure — not just a bug
- outcome.description: MUST be a formal problem statement — not "تحسين النظام"
- direction.description: NO solution words (no tech stack mentions)
- gateChecklist: MUST have 5+ items
- evidence: description + justification + owner — all filled with project-specific data

FORBIDDEN:
- Empty fields
- Generic text not grounded in the extracted facts
- Solution language in S0 (Laravel, Next.js, API, DB, CRUD, UI)`;
  }

  if (stage === "S1") {
    return `STEP B — FILL TEMPLATE (S1):
Using ONLY the extracted S1_FACTS above, fill the S1 workflow template.

QUALITY REQUIREMENTS:
- stage.description: MUST list 4+ actors by role name and describe their interactions
- insight.description: MUST include the concrete 5-step flow
- outcome.description: MUST define MVP scope with explicit boundaries
- direction.description: MUST include ALL 3 hard rules verbatim:
  1. لا عمل دون إسناد
  2. لا تحويل حالة قبل الإسناد
  3. لا إغلاق قبل معاينة القسم الطالب
- gateChecklist: 5+ items covering actors, flow, rules, edge cases
- out_of_scope: Clear and explicit
- evidence: filled with project-specific data

FORBIDDEN:
- Empty fields
- Less than 4 actors
- Generic flow without specific steps
- Missing any of the 3 hard rules`;
  }

  return `STEP B — FILL TEMPLATE (S2):
Using ONLY the extracted S2_FACTS above, fill the S2 workflow template.

QUALITY REQUIREMENTS:
- stage.description: Name conceptual components explicitly, describe relationships and tradeoffs
- insight.description: State model for key entities, governance rules
- outcome.description: ADR + component diagrams + state model + governance rules
- direction.description: Core vs supporting components, governance model, constraints
- gateChecklist: 5+ items covering components, tradeoffs, state model, governance
- evidence: filled with project-specific data

FORBIDDEN:
- Empty fields
- Specific tech stack in descriptions
- Implementation-level details (API endpoints, DB schemas, CRUD)`;
}
