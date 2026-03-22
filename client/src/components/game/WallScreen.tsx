import { Html } from "@react-three/drei";
import { useChat } from "@/lib/stores/useChat";
import { useGame } from "@/lib/stores/useGame";

export function WallScreen() {
  const { messages, activeRobotId, isOpen } = useChat();
  const isExteriorView = useGame((s) => s.isExteriorView);

  const robotName = activeRobotId === "robot-1" ? "Sillar GPT" : activeRobotId === "robot-2" ? "Sillar Claude" : "";
  const robotColor = activeRobotId === "robot-1" ? "#4fc3f7" : "#66bb6a";

  const lastMessages = messages.slice(-6);

  return (
    <group position={[0, 5.2, -7.95]}>
      <mesh>
        <planeGeometry args={[10, 4]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.2} metalness={0.8} />
      </mesh>

      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[10.3, 4.3, 0.08]} />
        <meshStandardMaterial color="#222" roughness={0.3} metalness={0.6} />
      </mesh>

      {!isExteriorView && <Html
        transform
        position={[0, 0, 0.01]}
        scale={0.22}
        style={{
          width: "1800px",
          height: "700px",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(180deg, #0a0a1a 0%, #0d0d20 100%)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            fontFamily: "Inter, sans-serif",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 24px",
              borderBottom: `2px solid ${isOpen ? robotColor : "#333"}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: isOpen ? robotColor : "#444",
                  boxShadow: isOpen ? `0 0 12px ${robotColor}` : "none",
                }}
              />
              <span
                style={{
                  color: isOpen ? "#fff" : "#555",
                  fontSize: "28px",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                }}
              >
                {isOpen ? robotName : "Sillar Chat Display"}
              </span>
            </div>
            <span
              style={{
                color: isOpen ? robotColor : "#444",
                fontSize: "16px",
                fontFamily: "monospace",
              }}
            >
              {isOpen ? "LIVE" : "STANDBY"}
            </span>
          </div>

          <div
            style={{
              flex: 1,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: "14px",
              overflow: "hidden",
            }}
          >
            {!isOpen || messages.length === 0 ? (
              <div
                style={{
                  color: "#333",
                  fontSize: "28px",
                  textAlign: "center",
                  fontWeight: "bold",
                  letterSpacing: "3px",
                  margin: "auto",
                }}
              >
                SILLAR DIGITAL PRODUCTION
              </div>
            ) : (
              lastMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: msg.role === "user" ? "#2563eb" : robotColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {msg.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div
                    style={{
                      background: msg.role === "user" ? "rgba(37, 99, 235, 0.2)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${msg.role === "user" ? "rgba(37, 99, 235, 0.4)" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: "12px",
                      padding: "10px 16px",
                      color: "#e0e0e0",
                      fontSize: "28px",
                      lineHeight: "1.6",
                      maxWidth: "75%",
                      direction: "rtl",
                      wordBreak: "break-word",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Html>}
    </group>
  );
}
