import { useEffect, startTransition } from "react";
import { useGame } from "@/lib/stores/useGame";

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

export function ModeSelectScreen() {
  const setAppMode = useGame((s) => s.setAppMode);

  // الموبايل أو رابط دعوة اجتماع — Classic تلقائياً بدون اختيار
  useEffect(() => {
    const hasAgoraMeeting = new URLSearchParams(window.location.search).get("agoraMeeting");
    if (isMobile() || hasAgoraMeeting) startTransition(() => setAppMode("classic"));
  }, []); // eslint-disable-line

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 60%, #0a1628 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif",
      userSelect: "none",
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        marginBottom: "12px",
      }}>
        <img src="/images/sillar_icon.png" alt="Sillar"
          style={{ width: 48, height: 48, borderRadius: 10, objectFit: "contain" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <span style={{ fontSize: 30, fontWeight: 700, color: "#e0e8ff", letterSpacing: 3 }}>
          SILLAR
        </span>
      </div>

      {/* Subtitle */}
      <p style={{
        color: "#4fc3f7",
        fontSize: 15,
        marginBottom: 52,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        opacity: 0.85,
      }}>
        اختر وضع التشغيل
      </p>

      {/* Cards */}
      <div style={{
        display: "flex",
        gap: 28,
        flexWrap: "wrap",
        justifyContent: "center",
        padding: "0 24px",
      }}>
        {/* Classic Card */}
        <ModeCard
          icon="🏢"
          title="كلاسيك"
          subtitle="Classic"
          description="مبنى الشركة فقط بدون أفاتار — خفيف وسريع، مثالي للأجهزة المتوسطة"
          accentColor="#4fc3f7"
          onClick={() => startTransition(() => setAppMode("classic"))}
        />

        {/* Pro Card */}
        <ModeCard
          icon="🎮"
          title="برو"
          subtitle="Pro"
          description="التجربة الثلاثية الأبعاد الكاملة مع الأفاتار والروبوتات والمدينة"
          accentColor="#00ff88"
          onClick={() => startTransition(() => setAppMode("pro"))}
        />

        {/* Showcase Card */}
        <ModeCard
          icon="✨"
          title="عرض"
          subtitle="Showcase"
          description="مشهد سينمائي ثلاثي الأبعاد بتقنيات الإضاءة والجسيمات المتقدمة"
          accentColor="#f59e0b"
          badge="NEW"
          onClick={() => startTransition(() => setAppMode("showcase"))}
        />

        {/* Toon Card */}
        <ToonCard onClick={() => startTransition(() => setAppMode("toon"))} />
      </div>

      {/* Footer hint */}
      <p style={{
        marginTop: 52,
        color: "#3a4a6a",
        fontSize: 13,
        letterSpacing: 0.5,
      }}>
        يمكنك تغيير الوضع عند إعادة تحميل الصفحة
      </p>
    </div>
  );
}

function ToonCard({ onClick }: { onClick: () => void }) {
  return (
    <>
      <style>{`
        @keyframes toon-border {
          0%   { border-color: #ff79a8; box-shadow: 0 0 18px #ff79a840, 0 0 40px #a78bfa20; }
          25%  { border-color: #a78bfa; box-shadow: 0 0 18px #a78bfa40, 0 0 40px #ff79a820; }
          50%  { border-color: #38d9a9; box-shadow: 0 0 18px #38d9a940, 0 0 40px #a78bfa20; }
          75%  { border-color: #ffd43b; box-shadow: 0 0 18px #ffd43b40, 0 0 40px #38d9a920; }
          100% { border-color: #ff79a8; box-shadow: 0 0 18px #ff79a840, 0 0 40px #a78bfa20; }
        }
        @keyframes toon-icon-bounce {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%       { transform: translateY(-8px) rotate(3deg); }
        }
        @keyframes toon-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .toon-card {
          width: 270px;
          padding: 36px 28px;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid #ff79a8;
          border-radius: 18px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          outline: none;
          animation: toon-border 3s ease-in-out infinite;
          transition: transform 0.2s ease, background 0.2s;
          position: relative;
          overflow: hidden;
        }
        .toon-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
          background-size: 200% 100%;
          animation: toon-shimmer 2.5s linear infinite;
          pointer-events: none;
        }
        .toon-card:hover {
          transform: translateY(-4px);
          background: rgba(255,121,168,0.08);
        }
        .toon-card-icon {
          font-size: 48px;
          display: inline-block;
          animation: toon-icon-bounce 2s ease-in-out infinite;
        }
        .toon-badge {
          position: absolute;
          top: -8px; right: -28px;
          background: linear-gradient(135deg, #ff79a8, #a78bfa);
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 1px;
        }
        .toon-title-shimmer {
          font-size: 22px;
          font-weight: 800;
          background: linear-gradient(90deg, #ff79a8, #a78bfa, #38d9a9, #ff79a8);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: toon-shimmer 3s linear infinite;
          margin-bottom: 4px;
        }
        .toon-enter-btn {
          margin-top: 8px;
          padding: 8px 24px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(255,121,168,0.15), rgba(167,139,250,0.15));
          border: 1px solid rgba(255,121,168,0.5);
          color: #ff79a8;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1px;
          font-family: Inter, sans-serif;
          cursor: pointer;
          transition: all 0.2s;
        }
        .toon-enter-btn:hover {
          background: linear-gradient(135deg, rgba(255,121,168,0.3), rgba(167,139,250,0.3));
          color: #fff;
        }
      `}</style>
      <button className="toon-card" onClick={onClick}>
        <div style={{ position: "relative", lineHeight: 1 }}>
          <span className="toon-card-icon">🎨</span>
          <span className="toon-badge">TOON</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="toon-title-shimmer">توون</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa", letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>
            Toon / Cel-Shaded
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#7a8aaa", textAlign: "center", lineHeight: 1.7, margin: 0, direction: "rtl" }}>
          نفس التجربة الكاملة مع ستايل أنمي — ألوان زاهية، إضاءة مسطّحة، وجو كرتوني
        </p>
        <button className="toon-enter-btn">اختر</button>
      </button>
    </>
  );
}

interface ModeCardProps {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  badge?: string;
  onClick: () => void;
}

function ModeCard({ icon, title, subtitle, description, accentColor, badge, onClick }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 270,
        padding: "36px 28px",
        background: "rgba(255,255,255,0.03)",
        border: `1.5px solid ${accentColor}33`,
        borderRadius: 18,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        transition: "all 0.2s ease",
        boxShadow: `0 0 0px ${accentColor}00`,
        outline: "none",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = `${accentColor}10`;
        el.style.borderColor = `${accentColor}88`;
        el.style.boxShadow = `0 0 30px ${accentColor}22`;
        el.style.transform = "translateY(-4px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.03)";
        el.style.borderColor = `${accentColor}33`;
        el.style.boxShadow = `0 0 0px ${accentColor}00`;
        el.style.transform = "translateY(0)";
      }}
    >
      <div style={{ position: "relative", lineHeight: 1 }}>
        <span style={{ fontSize: 48 }}>{icon}</span>
        {badge && (
          <span style={{
            position: "absolute", top: -8, right: -28,
            background: accentColor, color: "#000",
            fontSize: 9, fontWeight: 800, padding: "2px 6px",
            borderRadius: 4, letterSpacing: 1,
          }}>{badge}</span>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#e0e8ff", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: accentColor,
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: 0.8,
        }}>
          {subtitle}
        </div>
      </div>

      <p style={{
        fontSize: 13,
        color: "#7a8aaa",
        textAlign: "center",
        lineHeight: 1.7,
        margin: 0,
        direction: "rtl",
      }}>
        {description}
      </p>

      <div style={{
        marginTop: 8,
        padding: "8px 24px",
        borderRadius: 8,
        background: `${accentColor}18`,
        border: `1px solid ${accentColor}44`,
        color: accentColor,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 1,
      }}>
        اختر
      </div>
    </button>
  );
}
