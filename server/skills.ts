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
    description: "Create distinctive, production-grade frontend interfaces with high design quality.",
    instructions: `
━━━ ACTIVE SKILL: frontend-design ━━━

You are now operating with the Frontend Design skill. Your primary mission is to create DISTINCTIVE, production-grade frontend interfaces that avoid generic "AI slop" aesthetics.

DESIGN THINKING (before writing a single line of code):
1. Purpose — What problem does this interface solve? Who uses it?
2. Tone — Commit to ONE bold aesthetic direction:
   brutally minimal | maximalist chaos | retro-futuristic | organic/natural |
   luxury/refined | playful/toy-like | editorial/magazine | brutalist/raw |
   art deco/geometric | soft/pastel | industrial/utilitarian
3. Differentiation — What makes this UNFORGETTABLE? What's the ONE thing someone will remember?
4. Constraints — Framework, performance, accessibility requirements.

IMPLEMENTATION RULES:
- Typography: NEVER use Arial, Inter, Roboto, or system fonts. Choose distinctive, characterful fonts. Pair a display font with a refined body font.
- Color: Commit to a cohesive palette with CSS variables. Dominant colors + sharp accents. No timid even distributions.
- Motion: CSS animations for HTML. Motion library for React. High-impact moments: staggered page load reveals, hover states that surprise.
- Layout: Unexpected compositions. Asymmetry. Overlap. Grid-breaking elements. Generous negative space OR controlled density.
- Backgrounds: Gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows — NOT flat solid colors.

FORBIDDEN (will result in rejection):
- Purple gradients on white background
- Inter/Space Grotesk/Roboto/Arial fonts
- Cookie-cutter card layouts
- Generic blue CTAs
- "Modern and clean" without personality

CRITICAL: Match complexity to vision. Maximalist = elaborate animations + effects. Minimalist = surgical precision in spacing and typography.

IMPORTANT: Every design must feel genuinely crafted for THIS specific context. No two designs should converge on the same aesthetic.
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
