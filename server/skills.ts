/**
 * Skills System — حقن تعليمات متخصصة في الـ AI prompt
 * بناءً على tags المهمة في ClickUp
 *
 * كيف يعمل:
 * 1. المستخدم يضيف tag على مهمة ClickUp باسم الـ skill (مثلاً: "frontend-design")
 * 2. autoTrigger يكتشف الـ tag ويحقن تعليمات الـ skill في systemPrompt
 */

export interface Skill {
  name: string;
  description: string;
  instructions: string;
}

// ── قاموس الـ Skills ──────────────────────────────────────────────────────────
const SKILLS: Record<string, Skill> = {

  "frontend-design": {
    name: "frontend-design",
    description: "Create distinctive, conversion-optimized landing pages with elite design quality — no AI slop.",
    instructions: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTIVE SKILL: frontend-design — MANDATORY INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 YOU MUST USE THE EXACT HTML TEMPLATE BELOW — NO EXCEPTIONS.
Do NOT write a simple page. Do NOT skip the CSS. Do NOT use system fonts.
Failing to use this template = task failure.

YOUR HTML FILE MUST START WITH THIS EXACT STRUCTURE:

\`\`\`html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[COMPANY NAME]</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0a0f;
    --surface: #13131a;
    --accent: #e8c547;
    --text: #f0ede8;
    --muted: #8b8799;
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: var(--font-body); direction: rtl; }

  /* NAV */
  nav { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 6%; position: fixed; width: 100%; top: 0; z-index: 100; backdrop-filter: blur(12px); background: rgba(10,10,15,0.8); border-bottom: 1px solid rgba(232,197,71,0.1); }
  nav .logo { font-family: var(--font-display); font-size: 1.4rem; color: var(--accent); letter-spacing: -0.5px; }
  nav ul { list-style: none; display: flex; gap: 2rem; }
  nav ul a { color: var(--muted); text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
  nav ul a:hover { color: var(--accent); }

  /* HERO */
  .hero { min-height: 100svh; display: flex; flex-direction: column; justify-content: center; padding: 8rem 6% 4rem; position: relative; overflow: hidden; }
  .hero::before { content: ''; position: absolute; top: -30%; right: -20%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(232,197,71,0.12) 0%, transparent 70%); pointer-events: none; }
  .hero-eyebrow { font-size: 0.8rem; letter-spacing: 3px; text-transform: uppercase; color: var(--accent); margin-bottom: 1.5rem; opacity: 0; animation: fadeUp 0.6s 0.2s forwards; }
  .hero h1 { font-family: var(--font-display); font-size: clamp(3rem, 8vw, 7rem); font-weight: 800; line-height: 1.05; letter-spacing: -2px; max-width: 14ch; margin-bottom: 1.5rem; opacity: 0; animation: fadeUp 0.7s 0.35s forwards; }
  .hero h1 span { color: var(--accent); }
  .hero p { font-size: 1.15rem; color: var(--muted); max-width: 50ch; line-height: 1.7; margin-bottom: 2.5rem; opacity: 0; animation: fadeUp 0.7s 0.5s forwards; }
  .cta-primary { display: inline-block; background: var(--accent); color: #0a0a0f; padding: 1rem 2.5rem; border-radius: 4px; font-family: var(--font-display); font-weight: 700; font-size: 1rem; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; opacity: 0; animation: fadeUp 0.7s 0.65s forwards; }
  .cta-primary:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(232,197,71,0.3); }

  /* STATS */
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); margin: 0 6%; }
  .stat { padding: 3rem 2rem; border-left: 1px solid rgba(255,255,255,0.06); text-align: center; }
  .stat:last-child { border-left: none; }
  .stat .num { font-family: var(--font-display); font-size: 3rem; font-weight: 800; color: var(--accent); }
  .stat .label { font-size: 0.85rem; color: var(--muted); margin-top: 0.5rem; }

  /* SERVICES */
  .services { padding: 8rem 6%; }
  .section-title { font-family: var(--font-display); font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 800; letter-spacing: -1px; margin-bottom: 1rem; }
  .section-sub { color: var(--muted); font-size: 1rem; margin-bottom: 4rem; max-width: 50ch; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5px; background: rgba(255,255,255,0.06); }
  .card { background: var(--surface); padding: 2.5rem; transition: background 0.3s, transform 0.3s; }
  .card:hover { background: #1a1a24; transform: translateY(-4px); }
  .card-num { font-family: var(--font-display); font-size: 3rem; color: rgba(232,197,71,0.15); font-weight: 800; margin-bottom: 1rem; }
  .card h3 { font-family: var(--font-display); font-size: 1.3rem; margin-bottom: 0.75rem; color: var(--text); }
  .card p { color: var(--muted); font-size: 0.9rem; line-height: 1.7; }

  /* CTA SECTION */
  .cta-section { margin: 0 6% 8rem; padding: 5rem 4rem; background: linear-gradient(135deg, rgba(232,197,71,0.08), rgba(232,197,71,0.02)); border: 1px solid rgba(232,197,71,0.15); border-radius: 8px; text-align: center; }
  .cta-section h2 { font-family: var(--font-display); font-size: clamp(2rem, 4vw, 3rem); font-weight: 800; letter-spacing: -1px; margin-bottom: 1rem; }
  .cta-section p { color: var(--muted); margin-bottom: 2rem; }

  /* FOOTER */
  footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 2rem 6%; display: flex; justify-content: space-between; align-items: center; }
  footer p { color: var(--muted); font-size: 0.85rem; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
</style>
</head>
<body>
  <!-- FILL IN THE CONTENT BELOW — keep all CSS exactly as above -->
  <!-- Replace [PLACEHOLDERS] with real content about the company -->
</body>
</html>
\`\`\`

CONTENT TO FILL IN (replace placeholders with real content):
- Hero eyebrow: short tagline (e.g. "وكالة الإنتاج الرقمي")
- Hero h1: bold claim with <span> on the key word
- Hero p: 2 sentences about the value proposition
- Stats: 3 real numbers (clients, projects, years, etc.)
- Cards: 3 services with numbered headings
- CTA section: final call to action
- Footer: copyright

CRITICAL RULES:
✗ Do NOT change the CSS variables — they define the dark luxury theme
✗ Do NOT use Inter, Arial, Roboto — Syne + DM Sans are already loaded
✗ Do NOT add a plain white background anywhere
✗ Do NOT skip the stats or services sections
✓ Fill ALL sections with real content (no "الخدمة الأولى" placeholders)
✓ The hero h1 MUST have a <span> wrapping the key word
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`,
  },

  // ── أضف skills جديدة هنا ──────────────────────────────────────────────────
  // "backend-api": { name: "backend-api", description: "...", instructions: "..." },
  // "database-design": { ... },

};

/**
 * يستخرج أسماء الـ skills من tags المهمة
 * tag format في ClickUp: { name: string, tag_fg?: string, tag_bg?: string }
 */
export function extractSkillsFromTags(tags: any[]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t: any) => (typeof t === "string" ? t : t?.name || "").toLowerCase().trim())
    .filter((name: string) => name in SKILLS);
}

/**
 * يبني section نص يُحقن في systemPrompt
 * يُرجع string فارغ لو ما فيه skills
 */
export function buildSkillsSection(skillNames: string[]): string {
  if (skillNames.length === 0) return "";

  const blocks = skillNames
    .map((name) => SKILLS[name]?.instructions || "")
    .filter(Boolean);

  if (blocks.length === 0) return "";

  return blocks.join("\n") + "\n";
}

/**
 * يسجّل أسماء الـ skills المفعّلة للـ log
 */
export function formatActiveSkills(skillNames: string[]): string {
  if (skillNames.length === 0) return "none";
  return skillNames.map((n) => `[${n}]`).join(" ");
}

export { SKILLS };
