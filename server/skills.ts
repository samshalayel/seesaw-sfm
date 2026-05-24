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
    description: "Create distinctive landing pages — server renders the HTML, you provide content only.",
    instructions: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTIVE SKILL: frontend-design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 DO NOT write HTML. The server generates the HTML automatically.
YOUR ONLY JOB: call the tool submit_page_content with text content as JSON.

TOOL TO CALL: submit_page_content
Required fields:
  - filename: the HTML filename (e.g. "landing3.html")
  - vps_path: VPS directory (e.g. "/var/www/sillar/dist/public")
  - company: company name (e.g. "Sillar Digital Production")
  - eyebrow: short tagline in Arabic (e.g. "وكالة الإنتاج الرقمي")
  - headline: main hero headline in Arabic — make it bold and powerful (6-9 words)
  - headline_accent: ONE key word from the headline to highlight in gold
  - tagline: 2 sentences describing value proposition in Arabic
  - hero_cta: CTA button text (e.g. "ابدأ مشروعك الآن")
  - stats: array of 3 objects {num: "200+", label: "عميل راضٍ"}
  - services: array of 3 objects {title: "...", desc: "2 sentences about this service"}
  - cta_headline: final CTA section headline
  - cta_sub: final CTA subtitle
  - cta_button: final CTA button text

EXAMPLE CALL:
submit_page_content({
  filename: "landing3.html",
  vps_path: "/var/www/sillar/dist/public",
  company: "Sillar Digital Production",
  eyebrow: "وكالة الإنتاج الرقمي",
  headline: "نحوّل أفكارك إلى واقع رقمي",
  headline_accent: "رقمي",
  tagline: "نقدم حلولاً رقمية متكاملة تساعد علامتك التجارية على النمو. من التصميم إلى التطوير إلى التسويق.",
  hero_cta: "ابدأ مشروعك الآن",
  stats: [{num:"200+",label:"عميل راضٍ"},{num:"5 سنوات",label:"خبرة في السوق"},{num:"98%",label:"نسبة النجاح"}],
  services: [
    {title:"تصميم المواقع",desc:"نصمم مواقع احترافية تعكس هوية علامتك وتجذب عملاءك."},
    {title:"التطوير البرمجي",desc:"نطور تطبيقات وأنظمة مخصصة تلبي احتياجاتك التقنية."},
    {title:"التسويق الرقمي",desc:"نضع استراتيجيات تسويقية ذكية تزيد من وصولك وأرباحك."}
  ],
  cta_headline: "مستعد تبدأ مشروعك؟",
  cta_sub: "تواصل معنا اليوم ونبدأ رحلة النجاح معاً.",
  cta_button: "تواصل معنا الآن"
})

DO NOT use write_file_to_vps or create_or_update_file for this task.
DO NOT write any HTML code yourself.
JUST call submit_page_content with the content above.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Do NOT write a simple page. Do NOT skip the CSS. Do NOT use system fonts.
Failing to use this template = task failure.

DO NOT write HTML. Call submit_page_content with Arabic content only.
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

// ── Landing Page Renderer ─────────────────────────────────────────────────────
export interface LandingContent {
  company:          string;
  eyebrow:          string;
  headline:         string;
  headline_accent:  string;   // word to highlight in gold
  tagline:          string;
  hero_cta:         string;
  stats:            { num: string; label: string }[];
  services:         { title: string; desc: string }[];
  cta_headline:     string;
  cta_sub:          string;
  cta_button:       string;
}

export function renderLandingPage(c: LandingContent): string {
  const hl = c.headline_accent
    ? c.headline.replace(c.headline_accent, `<span>${c.headline_accent}</span>`)
    : c.headline;

  const statsHtml = (c.stats || []).map(s => `
    <div class="stat">
      <div class="num">${s.num}</div>
      <div class="label">${s.label}</div>
    </div>`).join("");

  const cardsHtml = (c.services || []).map((s, i) => `
    <div class="card">
      <div class="card-num">0${i + 1}</div>
      <h3>${s.title}</h3>
      <p>${s.desc}</p>
    </div>`).join("");

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${c.company}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0f;--surface:#13131a;--accent:#e8c547;--text:#f0ede8;--muted:#8b8799;--border:rgba(255,255,255,0.06);--glow:rgba(232,197,71,0.12);}
*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;direction:rtl;line-height:1.6;}

/* NAV */
nav{display:flex;justify-content:space-between;align-items:center;padding:1.4rem 6%;position:fixed;width:100%;top:0;z-index:100;backdrop-filter:blur(16px);background:rgba(10,10,15,0.85);border-bottom:1px solid var(--border);}
.logo{font-family:'Syne',sans-serif;font-size:1.3rem;color:var(--accent);letter-spacing:-0.5px;font-weight:800;}
.nav-links{list-style:none;display:flex;gap:2.5rem;}
.nav-links a{color:var(--muted);text-decoration:none;font-size:0.9rem;transition:color 0.2s;}
.nav-links a:hover{color:var(--accent);}

/* HERO */
.hero{min-height:100svh;display:flex;flex-direction:column;justify-content:center;padding:9rem 6% 5rem;position:relative;overflow:hidden;}
.hero::before{content:'';position:absolute;top:-20%;right:-15%;width:700px;height:700px;background:radial-gradient(circle,var(--glow) 0%,transparent 65%);pointer-events:none;animation:pulse 6s ease-in-out infinite;}
.hero::after{content:'';position:absolute;bottom:-20%;left:-15%;width:500px;height:500px;background:radial-gradient(circle,rgba(232,197,71,0.06) 0%,transparent 65%);pointer-events:none;}
.eyebrow{font-size:0.75rem;letter-spacing:4px;text-transform:uppercase;color:var(--accent);margin-bottom:1.8rem;display:flex;align-items:center;gap:0.75rem;opacity:0;animation:fadeUp 0.6s 0.15s forwards;}
.eyebrow::before{content:'';width:2rem;height:1px;background:var(--accent);}
h1{font-family:'Syne',sans-serif;font-size:clamp(3.2rem,8vw,7.5rem);font-weight:800;line-height:1.02;letter-spacing:-3px;max-width:12ch;margin-bottom:1.8rem;opacity:0;animation:fadeUp 0.7s 0.3s forwards;}
h1 span{color:var(--accent);position:relative;}
h1 span::after{content:'';position:absolute;bottom:-4px;right:0;width:100%;height:2px;background:var(--accent);opacity:0.4;}
.tagline{font-size:1.15rem;color:var(--muted);max-width:48ch;line-height:1.75;margin-bottom:2.8rem;opacity:0;animation:fadeUp 0.7s 0.45s forwards;}
.cta-primary{display:inline-flex;align-items:center;gap:0.6rem;background:var(--accent);color:#0a0a0f;padding:1rem 2.5rem;border-radius:4px;font-family:'Syne',sans-serif;font-weight:700;font-size:1rem;text-decoration:none;transition:transform 0.25s,box-shadow 0.25s;opacity:0;animation:fadeUp 0.7s 0.6s forwards;}
.cta-primary:hover{transform:translateY(-4px);box-shadow:0 24px 48px rgba(232,197,71,0.35);}
.cta-primary::after{content:'←';font-size:1.1rem;}

/* STATS */
.stats-bar{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:5rem 6% 0;}
.stat{padding:3rem 2rem;text-align:center;border-left:1px solid var(--border);transition:background 0.3s;}
.stat:last-child{border-left:none;}
.stat:hover{background:var(--surface);}
.stat .num{font-family:'Syne',sans-serif;font-size:2.8rem;font-weight:800;color:var(--accent);line-height:1;}
.stat .label{font-size:0.82rem;color:var(--muted);margin-top:0.6rem;letter-spacing:0.5px;}

/* SERVICES */
.services{padding:8rem 6%;}
.section-label{font-size:0.75rem;letter-spacing:4px;text-transform:uppercase;color:var(--accent);margin-bottom:1rem;}
.section-title{font-family:'Syne',sans-serif;font-size:clamp(2rem,4vw,3.5rem);font-weight:800;letter-spacing:-1.5px;margin-bottom:0.8rem;line-height:1.1;}
.section-sub{color:var(--muted);font-size:1rem;margin-bottom:4rem;max-width:48ch;}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5px;background:var(--border);}
.card{background:var(--surface);padding:2.8rem;transition:background 0.3s,transform 0.3s;cursor:default;}
.card:hover{background:#16161f;transform:translateY(-6px);}
.card-num{font-family:'Syne',sans-serif;font-size:4rem;font-weight:800;color:rgba(232,197,71,0.1);line-height:1;margin-bottom:1.2rem;}
.card h3{font-family:'Syne',sans-serif;font-size:1.25rem;margin-bottom:0.8rem;color:var(--text);}
.card p{color:var(--muted);font-size:0.9rem;line-height:1.75;}

/* CTA */
.cta-section{margin:0 6% 8rem;padding:5rem 4rem;background:linear-gradient(135deg,rgba(232,197,71,0.07),rgba(232,197,71,0.02));border:1px solid rgba(232,197,71,0.15);border-radius:6px;text-align:center;position:relative;overflow:hidden;}
.cta-section::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;height:400px;background:radial-gradient(circle,var(--glow),transparent 65%);pointer-events:none;}
.cta-section h2{font-family:'Syne',sans-serif;font-size:clamp(1.8rem,4vw,3rem);font-weight:800;letter-spacing:-1px;margin-bottom:1rem;position:relative;}
.cta-section p{color:var(--muted);margin-bottom:2.5rem;max-width:44ch;margin-left:auto;margin-right:auto;position:relative;}

/* FOOTER */
footer{border-top:1px solid var(--border);padding:2rem 6%;display:flex;justify-content:space-between;align-items:center;}
footer p{color:var(--muted);font-size:0.82rem;}
footer .logo{font-size:1rem;}

/* ANIMATIONS */
@keyframes fadeUp{from{opacity:0;transform:translateY(28px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:0.8;}50%{transform:scale(1.1);opacity:1;}}
</style>
</head>
<body>

<nav>
  <div class="logo">${c.company}</div>
  <ul class="nav-links">
    <li><a href="#services">خدماتنا</a></li>
    <li><a href="#cta">تواصل معنا</a></li>
  </ul>
</nav>

<section class="hero">
  <div class="eyebrow">${c.eyebrow}</div>
  <h1>${hl}</h1>
  <p class="tagline">${c.tagline}</p>
  <a href="#cta" class="cta-primary">${c.hero_cta}</a>
</section>

<div class="stats-bar">${statsHtml}</div>

<section class="services" id="services">
  <div class="section-label">ما نقدمه</div>
  <h2 class="section-title">خدماتنا المتميزة</h2>
  <p class="section-sub">نقدم مجموعة متكاملة من الخدمات الرقمية لتنمية أعمالك.</p>
  <div class="cards">${cardsHtml}</div>
</section>

<section class="cta-section" id="cta">
  <h2>${c.cta_headline}</h2>
  <p>${c.cta_sub}</p>
  <a href="mailto:info@sillar.uk" class="cta-primary">${c.cta_button}</a>
</section>

<footer>
  <div class="logo">${c.company}</div>
  <p>© ${year} جميع الحقوق محفوظة.</p>
</footer>

</body>
</html>`;
}
