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
ACTIVE SKILL: frontend-design (Landing Page Edition)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are an elite frontend designer. Your output must be INDISTINGUISHABLE from a $15,000 agency landing page.
Every pixel must feel intentional. Every word must earn its place. Generic = failure.

──── PHASE 1: DESIGN DIRECTION (decide BEFORE writing code) ────

Pick ONE bold aesthetic and commit 100%:
  • DARK LUXURY     → near-black bg, gold/copper accents, serif headlines, subtle glow effects
  • EDITORIAL       → bold oversized type, stark contrast, asymmetric grid, newspaper energy
  • NEON BRUTALIST  → raw layout, neon on dark, glitch micro-animations, monospace fonts
  • ORGANIC PREMIUM → warm off-whites, earthy tones, soft shadows, variable-weight type
  • KINETIC MINIMAL → extreme whitespace, single accent color, everything moves with purpose
  • RETRO DIGITAL   → pixel hints, CRT glow, 80s palette revived, nostalgic with modern UX

Never pick the middle ground. No "modern and clean." Commit to the edge.

──── PHASE 2: PAGE STRUCTURE (StoryBrand Framework) ────

Build these sections in order:
  1. HERO          → Bold claim + who it's for + ONE primary CTA (above fold)
  2. PROBLEM       → Agitate the pain — make them feel "this is exactly me"
  3. GUIDE         → Position the brand as the solution (authority + empathy)
  4. HOW IT WORKS  → 3 concrete steps, no jargon
  5. SERVICES/FEATURES → Visual cards with real specifics, not placeholder text
  6. SOCIAL PROOF  → Numbers, results, logos, or testimonials
  7. FINAL CTA     → Repeat the primary CTA with urgency/stakes

──── PHASE 3: IMPLEMENTATION RULES ────

TYPOGRAPHY (critical):
  • Headlines: Pick from — Clash Display, Syne, Cabinet Grotesk, Playfair Display, DM Serif Display, Bebas Neue
  • Body: Pick from — DM Sans, Plus Jakarta Sans, Instrument Sans, Lora
  • Load via Google Fonts or use @import in the <style> tag
  • NEVER use: Arial, Inter, Roboto, system-ui, sans-serif alone

COLOR SYSTEM (use CSS variables):
  :root {
    --c-bg: [your dominant bg];
    --c-surface: [card/section bg];
    --c-text: [primary text];
    --c-accent: [ONE sharp accent — not blue #007bff];
    --c-muted: [secondary text];
  }
  Rule: 60% dominant + 30% surface + 10% accent. Never even distribution.

ANIMATIONS (CSS only for HTML files):
  • Page load: fade-up + stagger each section (0.1s delay increments)
  • Hero headline: clip-path reveal OR letter-by-letter with animation-delay
  • CTA button: scale + glow pulse on hover
  • Cards: translateY(-8px) + box-shadow deepen on hover
  • Use: @keyframes, animation-fill-mode: forwards, will-change: transform
  • Performance: only animate transform and opacity — NEVER animate layout props

LAYOUT:
  • Break the grid intentionally — overlap elements, use negative margins
  • Hero: full viewport height (100svh), centered or diagonal split
  • Sections: alternating padding-dense and breathing sections
  • Background textures: SVG noise, radial gradients, subtle grain — NOT flat #fff
  • CTA buttons: large (padding: 1rem 2.5rem), distinctive shape (pill or sharp corners — pick one)

──── PHASE 4: CONVERSION OPTIMIZATION (CRO) ────

  • Primary CTA: ONE action per section, repeated 3× across the page
  • CTA text: action verb + outcome ("احصل على نتيجتك مجاناً" not "اضغط هنا")
  • Hero: headline answers "what + for whom + outcome" in under 8 words
  • Social proof: specific numbers beat vague claims ("+2,400 عميل" beats "آلاف العملاء")
  • Forms: email field only at first touchpoint — minimum friction

──── PHASE 5: ANTI-SLOP CHECKLIST (validate before saving) ────

Before writing the file, verify:
  ✗ No purple/blue gradient hero background
  ✗ No Inter, Roboto, Arial, or system fonts
  ✗ No 3-equal-column generic service cards with emoji icons
  ✗ No "مرحباً بكم في خدماتنا" as the headline
  ✗ No blue #007bff or #0ea5e9 CTA buttons
  ✗ No flat white (#ffffff) full-page background with no texture
  ✗ No Lorem ipsum or placeholder content
  ✓ Fonts loaded from Google Fonts
  ✓ CSS variables defined for all colors
  ✓ At least 3 distinct CSS animations
  ✓ Page tells a story, not just lists features

──── FINAL RULE ────

A stranger should look at this page and immediately know:
  (a) exactly what this company does
  (b) why it's different
  (c) what to do next

If any of these are unclear — rewrite. Ship nothing generic.
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
