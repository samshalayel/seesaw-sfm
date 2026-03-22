import { useState } from "react";
import { useGame } from "@/lib/stores/useGame";

const AVATARS = [
  {
    id: "lite",
    label: "لايت",
    emoji: "🤖",
    description: "روبوت فوري — 0 KB",
    color: "#a855f7",
    size: "0 KB",
  },
  {
    id: "avatar",
    label: "الكلاسيكي",
    emoji: "🧑‍💼",
    description: "الأفاتار الأصلي",
    color: "#4fc3f7",
    size: "3.3 MB",
  },
  {
    id: "avatarss",
    label: "المصغّر",
    emoji: "🧑",
    description: "نسخة خفيفة",
    color: "#66bb6a",
    size: "764 KB",
  },
];

export function AvatarSelect() {
  const confirmAvatar = useGame((s) => s.confirmAvatar);
  const savedAvatar   = useGame((s) => s.selectedAvatar);
  const user          = useGame((s) => s.user);
  const [picked, setPicked] = useState(savedAvatar || "lite");

  const accentColor = "#c4a44a";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 5, 15, 0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        fontFamily: "Inter, sans-serif",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ fontSize: "40px", marginBottom: "10px" }}>🎭</div>
        <h2 style={{ color: "white", fontSize: "24px", fontWeight: "bold", margin: 0, direction: "rtl" }}>
          اختر شخصيتك
        </h2>
        {user && (
          <p style={{ color: "#888", fontSize: "14px", marginTop: "6px", direction: "rtl" }}>
            مرحباً <strong style={{ color: accentColor }}>{user.username}</strong> — اختر الأفاتار الذي يمثلك
          </p>
        )}
      </div>

      {/* Avatar grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "32px",
          maxWidth: "640px",
          width: "90%",
        }}
      >
        {AVATARS.map((av) => {
          const isSelected = picked === av.id;
          return (
            <button
              key={av.id}
              onClick={() => setPicked(av.id)}
              style={{
                background: isSelected ? `${av.color}15` : "rgba(20,20,35,0.8)",
                border: isSelected ? `2px solid ${av.color}` : "2px solid #333",
                borderRadius: "16px",
                padding: "20px 16px",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                boxShadow: isSelected ? `0 0 20px ${av.color}30` : "none",
                position: "relative",
              }}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    width: "22px",
                    height: "22px",
                    background: av.color,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    color: "white",
                    fontWeight: "bold",
                  }}
                >
                  ✓
                </div>
              )}

              {/* Avatar emoji / icon */}
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: isSelected ? `${av.color}25` : "#1a1a2e",
                  border: `2px solid ${isSelected ? av.color : "#333"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "36px",
                  transition: "all 0.2s",
                }}
              >
                {av.emoji}
              </div>

              {/* Name */}
              <div style={{ color: isSelected ? av.color : "white", fontWeight: "bold", fontSize: "15px", direction: "rtl" }}>
                {av.label}
              </div>

              {/* Description */}
              <div style={{ color: "#888", fontSize: "12px", direction: "rtl" }}>
                {av.description}
              </div>

              {/* Size badge */}
              <div
                style={{
                  background: "#0a0a1a",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  color: "#666",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
              >
                {av.size}
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirm button */}
      <button
        onClick={() => confirmAvatar(picked)}
        style={{
          background: `linear-gradient(135deg, ${accentColor}, #a08030)`,
          border: "none",
          borderRadius: "12px",
          padding: "14px 48px",
          color: "white",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: "pointer",
          direction: "rtl",
          boxShadow: `0 4px 20px ${accentColor}40`,
          transition: "all 0.2s",
          letterSpacing: "0.5px",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        ادخل الصالة →
      </button>

      <p style={{ color: "#555", fontSize: "12px", marginTop: "16px", direction: "rtl" }}>
        يمكنك تغيير الشخصية لاحقاً عند تسجيل الدخول مجدداً
      </p>
    </div>
  );
}
