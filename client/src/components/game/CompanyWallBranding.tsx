import { Html } from "@react-three/drei";
import { useGame } from "@/lib/stores/useGame";

/**
 * Displays company logo + name directly on the back wall,
 * at the same position where the old WallScreen projector was.
 * No background panel — logo and text float on the wall surface.
 */
export function CompanyWallBranding() {
  const companyName = useGame((s) => s.companyName);
  const companyLogo = useGame((s) => s.companyLogo);
  const isExteriorView = useGame((s) => s.isExteriorView);

  if (!companyName && !companyLogo) return null;
  if (isExteriorView) return null;

  return (
    <group position={[-3.3, 5.2, -6.65]}>
      <Html
        transform
        occlude
        position={[0, 0, 0.01]}
        scale={0.22}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          style={{
            width: "1800px",
            height: "700px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "32px",
          }}
        >
          {/* شعار الشركة */}
          {companyLogo && (
            <img
              src={companyLogo}
              alt="company logo"
              style={{
                maxWidth: "700px",
                maxHeight: companyName ? "320px" : "480px",
                objectFit: "contain",
                filter:
                  "drop-shadow(0 0 30px rgba(196,164,74,0.55)) drop-shadow(0 4px 16px rgba(0,0,0,0.7))",
              }}
            />
          )}

          {/* اسم الشركة */}
          {companyName && (
            <div
              style={{
                color: "#ffffff",
                fontSize: companyLogo ? "96px" : "130px",
                fontWeight: "700",
                fontFamily: "'Almarai', sans-serif",
                textShadow:
                  "0 0 50px rgba(196,164,74,0.65), 0 0 20px rgba(196,164,74,0.3), 0 3px 10px rgba(0,0,0,0.9)",
                letterSpacing: "3px",
                direction: "rtl",
                lineHeight: 1.1,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {companyName}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
