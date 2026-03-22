export interface ValidationFailure {
  rule: string;
  message: string;
  severity: "hard" | "soft";
}

export interface ValidationResult {
  valid: boolean;
  pass: boolean;
  score: number;
  stage: string;
  failures: ValidationFailure[];
  errors: string[];
  requiredFixPrompt: string;
  patchSuggestions: string[];
}

const TECH_BAN_KEYWORDS = [
  "laravel", "next.js", "nextjs", "react", "node", "php", "codeigniter",
  "postgresql", "mysql", "mongodb", "sqlite", "redis", "kafka",
  "microservices", "kubernetes", "docker", "api endpoints",
  "vue", "angular", "express", "django", "flask", "spring",
  "graphql", "rest api", "websocket", "nginx", "aws", "azure", "gcp",
];

const S0_SOLUTION_BAN = [
  ...TECH_BAN_KEYWORDS,
  "crud", "ui", "frontend", "backend", "endpoint", "migration",
  "deploy", "db جديدة", "database", "schema",
];

function parseWorkflowJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getNodeData(workflow: any, nodeIdPrefix: string): any {
  if (!workflow?.nodes) return null;
  const node = workflow.nodes.find((n: any) =>
    typeof n.id === "string" && n.id.startsWith(nodeIdPrefix)
  );
  return node?.data || null;
}

function getNodeById(workflow: any, nodeIdPrefix: string): any {
  if (!workflow?.nodes) return null;
  return workflow.nodes.find((n: any) =>
    typeof n.id === "string" && n.id.startsWith(nodeIdPrefix)
  ) || null;
}

function collectAllText(workflow: any): string {
  if (!workflow?.nodes) return "";
  return workflow.nodes
    .map((n: any) => {
      const d = n.data || {};
      const parts = [
        d.description || "",
        d.justification || "",
        d.owner || "",
        ...(Array.isArray(d.aiResponsibilities) ? d.aiResponsibilities : []),
        ...(Array.isArray(d.humanResponsibilities) ? d.humanResponsibilities : []),
        ...(Array.isArray(d.gateChecklist) ? d.gateChecklist : []),
      ];
      return parts.join(" ");
    })
    .join(" ");
}

function validateCommon(workflow: any, stage: string): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (!workflow) {
    failures.push({ rule: "COMMON-JSON", message: "Invalid JSON format", severity: "hard" });
    return failures;
  }

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    failures.push({ rule: "COMMON-NODES", message: "Missing nodes array", severity: "hard" });
    return failures;
  }

  const stageNum = stage.replace("S", "");
  const requiredPrefixes = [
    "group",
    `stage-${stageNum}`,
    "insight-node",
    "outcome-node",
    "direction-node",
    "gate-problem",
    "alignment-gate",
    "evidence-node",
  ];

  for (const prefix of requiredPrefixes) {
    const found = workflow.nodes.some((n: any) =>
      typeof n.id === "string" && n.id.startsWith(prefix)
    );
    if (!found) {
      failures.push({
        rule: "COMMON-REQUIRED-NODE",
        message: `Missing required node with prefix "${prefix}"`,
        severity: "hard",
      });
    }
  }

  if (!workflow.edges || !Array.isArray(workflow.edges)) {
    failures.push({ rule: "COMMON-EDGES", message: "Missing edges array", severity: "hard" });
  } else {
    const customEdges = workflow.edges.filter((e: any) => e.type === "custom");
    if (customEdges.length !== 6) {
      failures.push({
        rule: "COMMON-EDGE-COUNT",
        message: `Expected exactly 6 edges with type "custom", found ${customEdges.length}`,
        severity: "hard",
      });
    }
  }

  const groupNode = workflow.nodes.find((n: any) =>
    typeof n.id === "string" && n.id.startsWith("group")
  );
  if (groupNode) {
    const groupId = groupNode.id;
    const childNodes = workflow.nodes.filter((n: any) => n.id !== groupId);
    for (const child of childNodes) {
      if (child.parentId !== groupId) {
        failures.push({
          rule: "COMMON-PARENT-ID",
          message: `Node "${child.id}" parentId="${child.parentId}" does not match group id="${groupId}"`,
          severity: "hard",
        });
      }
    }
  }

  if (!workflow.exportedAt) {
    failures.push({
      rule: "COMMON-EXPORTED-AT",
      message: "exportedAt field is missing or empty",
      severity: "hard",
    });
  }

  return failures;
}

function validateS0Discipline(workflow: any): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const allText = collectAllText(workflow).toLowerCase();

  const stage = getNodeData(workflow, "stage-0");
  const insight = getNodeData(workflow, "insight-node");
  const outcome = getNodeData(workflow, "outcome-node");
  const direction = getNodeData(workflow, "direction-node");
  const gate = getNodeData(workflow, "gate-problem");
  const evidence = getNodeData(workflow, "evidence-node");

  if (!stage?.description || stage.description.length < 20) {
    failures.push({ rule: "S0-STAGE-EMPTY", message: "Stage description is empty or too short (min 20 chars)", severity: "hard" });
  }

  const exampleGroups = [
    {
      name: "dashboard/statistics mismatch",
      patterns: ["dashboard", "لوحة", "أرقام متضاربة", "أرقام متناقضة", "داشبورد", "تضارب", "بيانات غير متطابقة", "إحصائيات", "احصائيات", "تقارير متضاربة", "أرقام مختلفة", "عدم تطابق", "بيانات مختلفة", "عدم دقة"],
    },
    {
      name: "closure without approval",
      patterns: ["إغلاق", "اغلاق", "closure", "موافقة", "إقفال", "معاينة", "تأكيد الإنجاز", "بدون اعتماد", "المستفيد", "بدون موافقة", "دون موافقة"],
    },
    {
      name: "missing serial number",
      patterns: ["serial", "سيريال", "رقم تسلسلي", "تسلسل", "تتبع", "ترقيم", "سونار", "رقم مسلسل", "أصول", "اصول", "رقم الأصل"],
    },
    {
      name: "server/availability errors",
      patterns: ["server", "خطأ", "تعليق", "عدم حفظ", "سيرفر", "توقف", "عطل", "خادم", "أعطال", "فشل", "عدم توفر", "بطء", "عدم استقرار", "انقطاع"],
    },
  ];

  const matchedGroups = exampleGroups.filter(g =>
    g.patterns.some(p => allText.includes(p))
  );

  if (matchedGroups.length < 3) {
    const missing = exampleGroups.filter(g => !g.patterns.some(p => allText.includes(p)));
    failures.push({
      rule: "S0-CONCRETE-EXAMPLES",
      message: `Must mention at least 3 of 4 example categories. Found ${matchedGroups.length}/3. Missing: ${missing.map(m => m.name).join(", ")}`,
      severity: "hard",
    });
  }

  if (outcome?.description) {
    const outText = outcome.description.toLowerCase();
    const dimensionChecks = [
      { name: "Data Integrity / موثوقية البيانات", patterns: ["موثوقية", "سلامة البيانات", "data integrity", "دقة البيانات", "بيانات موثوقة", "صحة البيانات", "جودة البيانات", "بيانات دقيقة"] },
      { name: "Process Governance / حوكمة الاجراءات", patterns: ["حوكمة", "governance", "إجراءات", "اجراءات", "إسناد", "اسناد", "صلاحيات", "مساءلة", "رقابة", "ضبط", "تنظيم"] },
      { name: "Availability / توفر واستقرار", patterns: ["توفر", "استقرار", "availability", "operational stability", "تشغيلي", "تعطل", "انقطاع", "استمرارية", "جاهزية"] },
    ];

    const missingDimensions = dimensionChecks.filter(d =>
      !d.patterns.some(p => outText.includes(p))
    );

    if (missingDimensions.length > 0) {
      failures.push({
        rule: "S0-OUTCOME-DIMENSIONS",
        message: `Outcome must include ALL 3 dimensions. Missing: ${missingDimensions.map(d => d.name).join(", ")}`,
        severity: "hard",
      });
    }

    const isGeneric = outText.includes("تحسين النظام") || outText.includes("improve the system");
    if (isGeneric) {
      failures.push({
        rule: "S0-OUTCOME-GENERIC",
        message: "Outcome must be a formal problem statement — not 'تحسين النظام'",
        severity: "hard",
      });
    }
  } else {
    failures.push({ rule: "S0-OUTCOME-EMPTY", message: "Outcome description is empty", severity: "hard" });
  }

  if (direction?.description) {
    const dirText = direction.description;
    const negationPrimary = /^[\s]*لا\s+نفكر\s+بحلول/;
    if (negationPrimary.test(dirText)) {
      failures.push({
        rule: "S0-DIRECTION-NEGATION",
        message: "Direction must be boundaries/rules direction, NOT negation like 'لا نفكر بحلول' as primary",
        severity: "hard",
      });
    }

    const solutionWords = S0_SOLUTION_BAN.filter(w => dirText.toLowerCase().includes(w));
    if (solutionWords.length > 0) {
      failures.push({
        rule: "S0-DIRECTION-SOLUTION",
        message: `Direction contains solution/tech words: ${solutionWords.join(", ")}`,
        severity: "hard",
      });
    }
  } else {
    failures.push({ rule: "S0-DIRECTION-EMPTY", message: "Direction description is empty", severity: "hard" });
  }

  if (gate?.gateChecklist && Array.isArray(gate.gateChecklist)) {
    const count = gate.gateChecklist.length;
    if (count < 5 || count > 7) {
      failures.push({
        rule: "S0-GATE-CHECKLIST-COUNT",
        message: `gateChecklist must have 5–7 items, found ${count}`,
        severity: "hard",
      });
    }

    const kpiPatterns = [/\d+%/, /accuracy/, /دقة\s*\d+/];
    const hasKPI = gate.gateChecklist.some((item: string) =>
      kpiPatterns.some(p => p.test(item))
    );
    if (hasKPI) {
      failures.push({
        rule: "S0-GATE-KPI",
        message: "gateChecklist items must be YES/NO verification questions, NOT KPIs like '95% accuracy'",
        severity: "hard",
      });
    }
  } else {
    failures.push({
      rule: "S0-GATE-CHECKLIST-MISSING",
      message: "gateChecklist is missing or not an array",
      severity: "hard",
    });
  }

  if (stage?.description) {
    const solutionWords = S0_SOLUTION_BAN.filter(w => (stage.description as string).toLowerCase().includes(w));
    if (solutionWords.length > 0) {
      failures.push({
        rule: "S0-STAGE-SOLUTION",
        message: `Stage description contains solution/tech words: ${solutionWords.join(", ")}`,
        severity: "hard",
      });
    }
  }

  if (insight?.description) {
    const hasGovernance = ["حوكمة", "governance", "إدارة", "رقابة", "إسناد", "اسناد", "مساءلة", "صلاحيات", "ضبط", "تنظيم", "مسؤولية", "اعتماد", "سلطة", "قرار"]
      .some(k => allText.includes(k));
    if (!hasGovernance) {
      failures.push({
        rule: "S0-INSIGHT-GOVERNANCE",
        message: "Insight must mention Governance failure — not just a technical bug",
        severity: "hard",
      });
    }
  } else {
    failures.push({ rule: "S0-INSIGHT-EMPTY", message: "Insight description is empty", severity: "hard" });
  }

  if (!evidence?.description) failures.push({ rule: "S0-EVIDENCE-DESC", message: "Evidence description is empty", severity: "hard" });
  if (!evidence?.justification) failures.push({ rule: "S0-EVIDENCE-JUST", message: "Evidence justification is empty", severity: "hard" });
  if (!evidence?.owner) failures.push({ rule: "S0-EVIDENCE-OWNER", message: "Evidence owner is empty", severity: "hard" });

  return failures;
}

function validateS1Discipline(workflow: any): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const allText = collectAllText(workflow);
  const allTextLower = allText.toLowerCase();

  const stage = getNodeData(workflow, "stage-1");
  const insight = getNodeData(workflow, "insight-node");
  const outcome = getNodeData(workflow, "outcome-node");
  const direction = getNodeData(workflow, "direction-node");
  const gate = getNodeData(workflow, "gate-problem");
  const evidence = getNodeData(workflow, "evidence-node");

  if (!stage?.description || stage.description.length < 20) {
    failures.push({ rule: "S1-STAGE-EMPTY", message: "Stage description is empty or too short", severity: "hard" });
  }

  const actorKeywords = [
    "مالك", "صاحب التذكرة", "مقدم الطلب", "طالب الخدمة",
    "رئيس القسم", "مدير القسم", "القسم الطالب",
    "رئيس الفريق", "قائد الفريق", "مشرف",
    "مهندس", "فني", "عامل", "مختص", "منسق", "مستفيد", "موظف",
  ];
  const foundActors = actorKeywords.filter(a => allText.includes(a));
  if (foundActors.length < 4) {
    failures.push({
      rule: "S1-ACTORS-COUNT",
      message: `Must have >= 4 actors. Found ${foundActors.length}: ${foundActors.join(", ")}`,
      severity: "hard",
    });
  }

  const flowIndicators = [
    "الخطوة", "أولاً", "ثانياً", "ثالثاً", "رابعاً", "خامساً",
    "1.", "2.", "3.", "4.", "5.",
    "١.", "٢.", "٣.", "٤.", "٥.",
    "1)", "2)", "3)", "4)", "5)",
  ];
  const flowMatches = flowIndicators.filter(f => allText.includes(f));
  const hasExplicit5Steps = flowMatches.length >= 3;

  if (!hasExplicit5Steps) {
    const stepPatterns = [/خطوة\s*\d/g, /المرحلة\s*\d/g, /step\s*\d/gi];
    const stepCount = stepPatterns.reduce((count, pat) => {
      const m = allText.match(pat);
      return count + (m ? m.length : 0);
    }, 0);

    if (stepCount < 3) {
      failures.push({
        rule: "S1-FLOW-STEPS",
        message: "Must include an explicit 5-step flow (5 numbered steps or clearly separated steps)",
        severity: "hard",
      });
    }
  }

  const hardRuleChecks = [
    {
      verbatim: "لا عمل دون اسناد",
      alternates: ["لا عمل بدون إسناد", "لا عمل بدون اسناد", "لا عمل دون إسناد", "عمل دون إسناد", "عمل دون اسناد", "عمل بدون إسناد", "عمل بدون اسناد"],
    },
    {
      verbatim: "لا تحويل لحالة التذكرة قبل الاسناد",
      alternates: ["لا تحويل حالة قبل الإسناد", "لا تحويل حالة قبل الاسناد", "لا تغيير حالة قبل الإسناد", "تحويل حالة قبل", "لا تحويل لحالة", "تحويل لحالة التذكرة قبل"],
    },
    {
      verbatim: "لا اغلاق نهائي قبل معاينة القسم الطالب",
      alternates: ["لا إغلاق قبل معاينة", "لا إغلاق بدون معاينة", "لا اغلاق قبل معاينة", "إغلاق قبل معاينة", "اغلاق قبل معاينة", "معاينة القسم الطالب", "لا إغلاق نهائي قبل معاينة", "لا اغلاق نهائي"],
    },
  ];

  for (const rule of hardRuleChecks) {
    const found = [rule.verbatim, ...rule.alternates].some(r => allText.includes(r));
    if (!found) {
      failures.push({
        rule: "S1-HARD-RULE-MISSING",
        message: `Missing verbatim hard rule: "${rule.verbatim}"`,
        severity: "hard",
      });
    }
  }

  if (outcome?.description) {
    const outLower = outcome.description.toLowerCase();
    const isSolutionOutcome =
      outLower.includes("improve dashboard") ||
      outLower.includes("تحسين اللوحة") ||
      outLower.includes("تحسين النظام") ||
      outLower.includes("build a new") ||
      outLower.includes("إنشاء نظام جديد");
    if (isSolutionOutcome) {
      failures.push({
        rule: "S1-OUTCOME-SOLUTION",
        message: "Outcome must describe agreed product shape (actors+flow+rules), NOT a solution like 'improve dashboard'",
        severity: "hard",
      });
    }
  } else {
    failures.push({ rule: "S1-OUTCOME-EMPTY", message: "Outcome description is empty", severity: "hard" });
  }

  const techWords = TECH_BAN_KEYWORDS.filter(w => allTextLower.includes(w));
  if (techWords.length > 0) {
    failures.push({
      rule: "S1-TECH-LEAK",
      message: `S1 must NOT include architecture/stack choices. Found: ${techWords.join(", ")}`,
      severity: "hard",
    });
  }

  if (gate?.gateChecklist && Array.isArray(gate.gateChecklist)) {
    if (gate.gateChecklist.length < 5) {
      failures.push({
        rule: "S1-GATE-CHECKLIST-COUNT",
        message: `gateChecklist must have >= 5 items, found ${gate.gateChecklist.length}`,
        severity: "hard",
      });
    }
  } else {
    failures.push({ rule: "S1-GATE-MISSING", message: "gateChecklist is missing", severity: "hard" });
  }

  if (!insight?.description) failures.push({ rule: "S1-INSIGHT-EMPTY", message: "Insight description is empty", severity: "hard" });
  if (!direction?.description) failures.push({ rule: "S1-DIRECTION-EMPTY", message: "Direction description is empty", severity: "hard" });
  if (!evidence?.description) failures.push({ rule: "S1-EVIDENCE-DESC", message: "Evidence description is empty", severity: "hard" });
  if (!evidence?.justification) failures.push({ rule: "S1-EVIDENCE-JUST", message: "Evidence justification is empty", severity: "hard" });
  if (!evidence?.owner) failures.push({ rule: "S1-EVIDENCE-OWNER", message: "Evidence owner is empty", severity: "hard" });

  return failures;
}

function validateS2Discipline(workflow: any): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  const stage = getNodeData(workflow, "stage-2");
  const insight = getNodeData(workflow, "insight-node");
  const outcome = getNodeData(workflow, "outcome-node");
  const direction = getNodeData(workflow, "direction-node");
  const gate = getNodeData(workflow, "gate-problem");
  const evidence = getNodeData(workflow, "evidence-node");

  if (!stage?.description || stage.description.length < 20) {
    failures.push({ rule: "S2-STAGE-EMPTY", message: "Stage description is empty or too short", severity: "hard" });
  }

  const criticalFields = [
    stage?.description || "",
    insight?.description || "",
    outcome?.description || "",
    direction?.description || "",
  ].join(" ").toLowerCase();

  const bannedFound = TECH_BAN_KEYWORDS.filter(w => criticalFields.includes(w));
  if (bannedFound.length > 0) {
    failures.push({
      rule: "S2-TECH-BAN",
      message: `S2 must contain NO tech stack / implementation hints. Found in stage/insight/outcome/direction: ${bannedFound.join(", ")}`,
      severity: "hard",
    });
  }

  if (outcome?.description) {
    const outLower = outcome.description.toLowerCase();
    const bannedOutcome = ["adr", "diagrams", "implementation", "db design", "database design", "مخطط قاعدة بيانات", "تصميم قاعدة بيانات"];
    const foundBanned = bannedOutcome.filter(b => outLower.includes(b));
    if (foundBanned.length > 0) {
      failures.push({
        rule: "S2-OUTCOME-IMPL",
        message: `Outcome must NOT mention ADRs, diagrams, implementation, DB design. Found: ${foundBanned.join(", ")}`,
        severity: "hard",
      });
    }
  } else {
    failures.push({ rule: "S2-OUTCOME-EMPTY", message: "Outcome description is empty", severity: "hard" });
  }

  const allText = collectAllText(workflow);
  const conceptualChecks = [
    {
      name: "conceptual components",
      patterns: ["مكون", "كيان", "component", "entity", "ticket", "تذكرة", "assignment", "إسناد", "اسناد", "device", "جهاز", "serial", "سيريال", "acceptance", "قبول", "event", "حدث"],
    },
    {
      name: "state model / state machine",
      patterns: ["حالة", "state", "انتقال", "transition", "مراحل", "دورة حياة", "lifecycle", "status", "open", "closed", "pending", "مفتوح", "مغلق", "قيد"],
    },
    {
      name: "governance boundaries",
      patterns: ["حوكمة", "governance", "صلاحية", "صلاحيات", "اعتماد", "موافقة", "من يستطيع", "من يمكنه", "approval", "boundary", "حدود"],
    },
  ];

  const missingConcepts = conceptualChecks.filter(c =>
    !c.patterns.some(p => allText.toLowerCase().includes(p))
  );

  if (missingConcepts.length > 0) {
    failures.push({
      rule: "S2-CONCEPTUAL-MISSING",
      message: `Missing conceptual elements: ${missingConcepts.map(c => c.name).join(", ")}`,
      severity: "hard",
    });
  }

  if (gate?.gateChecklist && Array.isArray(gate.gateChecklist)) {
    if (gate.gateChecklist.length < 5) {
      failures.push({
        rule: "S2-GATE-CHECKLIST-COUNT",
        message: `gateChecklist must have >= 5 items, found ${gate.gateChecklist.length}`,
        severity: "hard",
      });
    }
  } else {
    failures.push({ rule: "S2-GATE-MISSING", message: "gateChecklist is missing", severity: "hard" });
  }

  if (!insight?.description) failures.push({ rule: "S2-INSIGHT-EMPTY", message: "Insight description is empty", severity: "hard" });
  if (!direction?.description) failures.push({ rule: "S2-DIRECTION-EMPTY", message: "Direction description is empty", severity: "hard" });
  if (!evidence?.description) failures.push({ rule: "S2-EVIDENCE-DESC", message: "Evidence description is empty", severity: "hard" });
  if (!evidence?.justification) failures.push({ rule: "S2-EVIDENCE-JUST", message: "Evidence justification is empty", severity: "hard" });
  if (!evidence?.owner) failures.push({ rule: "S2-EVIDENCE-OWNER", message: "Evidence owner is empty", severity: "hard" });

  return failures;
}

function computeScore(commonFailures: ValidationFailure[], disciplineFailures: ValidationFailure[]): number {
  const commonMax = 40;
  const disciplineMax = 60;

  const commonHardFails = commonFailures.filter(f => f.severity === "hard").length;
  const disciplineHardFails = disciplineFailures.filter(f => f.severity === "hard").length;

  const commonTotal = commonFailures.length;
  const disciplineTotal = disciplineFailures.length;

  const commonScore = commonTotal === 0 ? commonMax : Math.max(0, commonMax - (commonHardFails * 10) - ((commonTotal - commonHardFails) * 3));
  const disciplineScore = disciplineTotal === 0 ? disciplineMax : Math.max(0, disciplineMax - (disciplineHardFails * 8) - ((disciplineTotal - disciplineHardFails) * 3));

  return commonScore + disciplineScore;
}

function buildFixPrompt(stage: string, failures: ValidationFailure[]): string {
  const lines = failures.map((f, i) => `${i + 1}. [${f.rule}] ${f.message}`);
  return `Regenerate Stage ${stage} workflow JSON. You MUST fix the following failures exactly:\n${lines.join("\n")}\n\nRules:\n- Keep layout/ids/edges unchanged.\n- Only replace allowed text fields.\n- Do not introduce banned content.\n\nReturn full corrected workflow JSON.`;
}

function buildPatchSuggestions(failures: ValidationFailure[]): string[] {
  return failures.map(f => {
    switch (f.rule) {
      case "S0-CONCRETE-EXAMPLES":
        return "Add concrete examples from input: dashboard mismatch (إحصائيات متضاربة), closure without approval (إغلاق بدون موافقة), missing serial (سيريال مفقود), server errors (تعليق/عدم حفظ)";
      case "S0-OUTCOME-DIMENSIONS":
        return "Include all 3 dimensions in Outcome: موثوقية البيانات (Data Integrity), حوكمة الإجراءات (Process Governance), توفر واستقرار (Availability)";
      case "S0-GATE-KPI":
        return "Replace KPI-style checklist items with YES/NO verification questions";
      case "S1-HARD-RULE-MISSING":
        return "Include all 3 hard rules verbatim: لا عمل دون إسناد / لا تحويل لحالة التذكرة قبل الإسناد / لا إغلاق نهائي قبل معاينة القسم الطالب";
      case "S1-ACTORS-COUNT":
        return "Add more actors: مالك التذكرة, رئيس القسم, رئيس الفريق, مهندس/فني";
      case "S2-TECH-BAN":
        return "Remove all tech stack references. Use domain concepts only (تذكرة, إسناد, جهاز, حالة)";
      case "S2-CONCEPTUAL-MISSING":
        return "Add conceptual components (Ticket, Assignment, Device), state model, and governance boundaries";
      default:
        return `Fix: ${f.message}`;
    }
  });
}

export function validateStage(stage: "S0" | "S1" | "S2", content: string): ValidationResult {
  const workflow = parseWorkflowJson(content);

  const commonFailures = validateCommon(workflow, stage);

  let disciplineFailures: ValidationFailure[] = [];
  if (workflow) {
    switch (stage) {
      case "S0":
        disciplineFailures = validateS0Discipline(workflow);
        break;
      case "S1":
        disciplineFailures = validateS1Discipline(workflow);
        break;
      case "S2":
        disciplineFailures = validateS2Discipline(workflow);
        break;
    }
  }

  const allFailures = [...commonFailures, ...disciplineFailures];
  const score = computeScore(commonFailures, disciplineFailures);
  const hasHardFailures = allFailures.some(f => f.severity === "hard");
  const pass = score >= 85 && !hasHardFailures;

  return {
    valid: pass,
    pass,
    score,
    stage,
    failures: allFailures,
    errors: allFailures.map(f => `[${f.rule}] ${f.message}`),
    requiredFixPrompt: pass ? "" : buildFixPrompt(stage, allFailures),
    patchSuggestions: pass ? [] : buildPatchSuggestions(allFailures),
  };
}
