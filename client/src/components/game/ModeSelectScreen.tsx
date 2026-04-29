import { useEffect } from "react";
import { useGame } from "@/lib/stores/useGame";

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

export function ModeSelectScreen() {
  const setAppMode = useGame((s) => s.setAppMode);

  // الموبايل أو رابط دعوة اجتماع — Classic تلقائياً بدون اختيار
  useEffect(() => {
    const hasAgoraMeeting = new URLSearchParams(window.location.search).get("agoraMeeting");
    if (isMobile() || hasAgoraMeeting) setAppMode("classic");
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
          onClick={() => setAppMode("classic")}
        />

        {/* Pro Card */}
        <ModeCard
          icon="🎮"
          title="برو"
          subtitle="Pro"
          description="التجربة الثلاثية الأبعاد الكاملة مع الأفاتار والروبوتات والمدينة"
          accentColor="#00ff88"
          onClick={() => setAppMode("pro")}
        />
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

interface ModeCardProps {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  onClick: () => void;
}

function ModeCard({ icon, title, subtitle, description, accentColor, onClick }: ModeCardProps) {
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
      <span style={{ fontSize: 48, lineHeight: 1 }}>{icon}</span>

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
