/**
 * GameUI.tsx
 * تعليمات الحركة فقط — باقي الأدوات انتقلت إلى TopRightPanel
 */
import { useChat } from "@/lib/stores/useChat";
import { useGame } from "@/lib/stores/useGame";

export function GameUI() {
  const isOpen = useChat((s) => s.isOpen);
  const phase  = useGame((s) => s.phase);

  if (phase !== "playing" || isOpen) return null;

  return (
    <div style={{
      position:       "fixed",
      bottom:         "20px",
      left:           "50%",
      transform:      "translateX(-50%)",
      background:     "rgba(0,0,0,0.55)",
      backdropFilter: "blur(8px)",
      color:          "rgba(255,255,255,0.7)",
      padding:        "8px 20px",
      borderRadius:   "10px",
      border:         "1px solid rgba(255,255,255,0.07)",
      fontFamily:     "Inter, sans-serif",
      fontSize:       "12px",
      pointerEvents:  "none",
      userSelect:     "none",
      direction:      "rtl",
      textAlign:      "center",
      zIndex:         40,
    }}>
      <div>مفاتيح الأسهم للتحرك · F للتحدث مع الروبوت القريب</div>
    </div>
  );
}
