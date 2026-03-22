import { useChat } from "@/lib/stores/useChat";
import { useGame } from "@/lib/stores/useGame";

export function GameUI() {
  const isOpen     = useChat((s) => s.isOpen);
  const models     = useGame((s) => s.models);
  const hallWorkers = useGame((s) => s.hallWorkers);
  const totalRobots = models.length + hallWorkers.length;

  const handleBroadcast = () => {
    useChat.setState({
      isBroadcast: true,
      broadcastResults: {},
      robotScreens: {},
      inputText: "",
    });
  };

  return (
    <>
      {/* زر المحادثة الجماعية */}
      <button
        onClick={handleBroadcast}
        title="محادثة جماعية مع كل الروبوتات"
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none",
          borderRadius: "14px",
          padding: "12px 20px",
          color: "white",
          fontSize: "15px",
          fontWeight: "bold",
          cursor: "pointer",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "Inter, sans-serif",
          backdropFilter: "blur(8px)",
          transition: "all 0.2s",
          direction: "rtl",
          boxShadow: "0 4px 20px rgba(99, 102, 241, 0.5)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, #4f46e5, #7c3aed)";
          e.currentTarget.style.boxShadow = "0 6px 28px rgba(99, 102, 241, 0.7)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, #6366f1, #8b5cf6)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(99, 102, 241, 0.5)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <span style={{ fontSize: "18px" }}>💬</span>
        <span>محادثة جماعية</span>
        {totalRobots > 0 && (
          <span style={{
            background: "rgba(255,255,255,0.25)",
            borderRadius: "10px",
            padding: "2px 8px",
            fontSize: "12px",
            color: "white",
            fontWeight: "bold",
          }}>{totalRobots}</span>
        )}
      </button>

      {/* تعليمات الحركة */}
      {!isOpen && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "12px 24px",
          borderRadius: "8px",
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
          pointerEvents: "none",
          userSelect: "none",
          direction: "rtl",
          textAlign: "center",
        }}>
          <div>استخدم مفاتيح الأسهم للتحرك</div>
          <div style={{ fontSize: "12px", marginTop: "4px", color: "#aaa" }}>
            اقترب من روبوت واضغط F للتحدث معه
          </div>
        </div>
      )}
    </>
  );
}
