import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { KeyboardControls } from "@react-three/drei";
import "@fontsource/inter";
import { Room } from "./components/game/Room";
import { Desk } from "./components/game/Desk";
import { HumanDeveloper } from "./components/game/HumanDeveloper";
import { Robot } from "./components/game/Robot";
import { Player } from "./components/game/Player";
import { GameUI } from "./components/game/GameUI";
import { ChatBubble } from "./components/game/ChatBubble";
import { BackgroundJobs } from "./components/game/BackgroundJobs";
import { AutoTriggerPanel } from "./components/game/AutoTriggerPanel";
import { LogoutDoor } from "./components/game/LogoutDoor";
import { DoorEntry } from "./components/game/DoorEntry";
import { ManagerRoom } from "./components/game/ManagerRoom";
import { ManagerDoor } from "./components/game/ManagerDoor";
import { Stage0Room } from "./components/game/Stage0Room";
import { Stage0Door } from "./components/game/Stage0Door";
import { Stage1Room } from "./components/game/Stage1Room";
import { Stage1Door } from "./components/game/Stage1Door";
import { ManagerKeypadOverlay } from "./components/game/ManagerKeypadOverlay";
import { StageKeypadOverlay } from "./components/game/StageKeypadOverlay";
import { VaultSettingsDialog } from "./components/game/VaultSettingsDialog";
import { AvatarSelect } from "./components/game/AvatarSelect";
import { CompanyWallBranding } from "./components/game/CompanyWallBranding";
import { BuildingEntrance } from "./components/game/BuildingEntrance";
import { PerimeterWall } from "./components/game/PerimeterWall";
import { ProductionHall } from "./components/game/ProductionHall";
import { BackRooms } from "./components/game/BackRooms";
import { HologramStats } from "./components/game/HologramStats";
import { ManagerDoorScreen } from "./components/game/ManagerDoorScreen";
import { ManagerVideoOverlay } from "./components/game/ManagerVideoOverlay";
import { HologramStatsOverlay } from "./components/game/HologramStatsOverlay";
import { HumanOverlay } from "./components/game/HumanOverlay";
import { BroadcastUI } from "./components/game/BroadcastUI";
import { CameraButtons } from "./components/game/CameraButtons";
import { useGame, getRoomSlot, getModelColor, getHallWorkerPosition, getHallWorkerDeskPosition, getHallWorkerRotation, getHallWorkerDeskRotation, getHallWorkerColor } from "./lib/stores/useGame";
import { useGLTF, useProgress } from "@react-three/drei";

// تفعيل Draco decoder للملفات المضغوطة
useGLTF.setDecoderPath("/draco-gltf/");
import { getAuthToken, setRoomId } from "./lib/utils";

const controls = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "back", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "interact", keys: ["KeyF"] },
];

function LoadingScreen() {
  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#0a0a1a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "24px",
    }}>
      <style>{`
        @keyframes pulse-logo {
          0%, 100% { transform: scale(1);   opacity: 1;    }
          50%       { transform: scale(1.1); opacity: 0.85; }
        }
        @keyframes spin-ring {
          to { transform: rotate(360deg); }
        }
        @keyframes fade-dots {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1;   }
        }
      `}</style>

      {/* Logo + spinning ring */}
      <div style={{ position: "relative", width: 88, height: 88 }}>
        {/* Outer spinning ring */}
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          border: "2px solid rgba(79,195,247,0.15)",
          borderTop: "2px solid #4fc3f7",
          animation: "spin-ring 1.1s linear infinite",
        }} />
        {/* Inner glow ring */}
        <div style={{
          position: "absolute", inset: 8,
          borderRadius: "50%",
          border: "1px solid rgba(0,255,136,0.12)",
          borderBottom: "1px solid #00ff88",
          animation: "spin-ring 1.8s linear infinite reverse",
        }} />
        {/* Logo */}
        <img
          src="/images/sillar_icon.png"
          alt="Sillar"
          style={{
            position: "absolute", inset: 18,
            width: 52, height: 52,
            objectFit: "contain",
            animation: "pulse-logo 2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Text */}
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#ffffff", fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: 2 }}>
          SILLAR
        </div>
        <div style={{
          color: "#4fc3f7", fontFamily: "Inter, sans-serif", fontSize: 12,
          marginTop: 6, animation: "fade-dots 1.4s ease-in-out infinite",
        }}>
          جارٍ التحميل...
        </div>
      </div>
    </div>
  );
}

function LoadingOverlay() {
  const { active } = useProgress();
  if (!active) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 999, pointerEvents: "none" }}>
      <LoadingScreen />
    </div>
  );
}

function App() {
  const phase              = useGame((s) => s.phase);
  const unlock             = useGame((s) => s.unlock);
  const managerDoorLocked  = useGame((s) => s.managerDoorLocked);
  const models             = useGame((s) => s.models);
  const hallWorkers        = useGame((s) => s.hallWorkers);
  const fetchModels        = useGame((s) => s.fetchModels);
  const fetchHallWorkers   = useGame((s) => s.fetchHallWorkers);
  const fetchCompanyInfo   = useGame((s) => s.fetchCompanyInfo);
  const setIsGuest         = useGame((s) => s.setIsGuest);

  // قراءة ?guest=TOKEN من URL
  const guestToken = new URLSearchParams(window.location.search).get("guest");

  // true = نحن نتحقق من توكن محفوظ أو guest token، لا تظهر DoorEntry حتى ننتهي
  const [checking, setChecking] = useState(() => !!getAuthToken() || !!guestToken);

  useEffect(() => {
    if (phase === "playing") {
      fetchModels();
      fetchHallWorkers();
      fetchCompanyInfo();
    }
  }, [phase, fetchModels, fetchHallWorkers, fetchCompanyInfo]);

  // دخول الضيف عبر رابط المشاركة
  useEffect(() => {
    if (!guestToken) return;
    fetch(`/api/share-link/verify?token=${encodeURIComponent(guestToken)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid && data.roomId) {
          setRoomId(data.roomId);
          setIsGuest(true);
          unlock({ id: data.roomId, username: "Guest", roomId: data.roomId }, true);
          // نظّف الـ URL من الـ token
          window.history.replaceState({}, "", window.location.pathname);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line

  // استعادة الجلسة تلقائياً عند تحديث الصفحة
  useEffect(() => {
    if (guestToken) return; // guest path يتولى الأمر بالـ effect أعلاه
    const token = getAuthToken();
    if (!token) {
      setChecking(false); // لا يوجد توكن، اعرض شاشة الدخول فوراً
      return;
    }

    fetch("/api/auth/verify", {
      headers: { "Authorization": `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid && data.user) {
          setRoomId(data.user.roomId);
          unlock({
            id: data.user.roomId,
            username: data.user.username,
            roomId: data.user.roomId,
          }, true); // skipAvatarSelect=true للدخول التلقائي
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false)); // انتهى التحقق في كلتا الحالتين
  }, []); // يشتغل مرة واحدة عند التحميل

  // جارٍ التحقق من الجلسة المحفوظة — لا تعرض أي شيء بعد
  if (checking) return <LoadingScreen />;

  // شاشة اللوجين — قبل أي تحميل 3D حتى لا تثقّل الـ GPU على الإدخال
  if (phase === "locked") {
    return (
      <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
        <DoorEntry onUnlock={(user) => unlock(user)} />
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <KeyboardControls map={controls}>
        <Canvas
          flat
          shadows
          camera={{
            position: [0, 5, 10],
            fov: 55,
            near: 0.1,
            far: 150,
          }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
            }, false);
          }}
        >
          <color attach="background" args={["#1a1a2a"]} />

          <ambientLight intensity={2.5} color="#ffffff" />
          <hemisphereLight intensity={1.2} color="#e0e0ff" groundColor="#4a4a6a" />
          <directionalLight
            position={[5, 12, 5]}
            intensity={1.5}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
            shadow-camera-far={50}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
            color="#ffffff"
          />
          <pointLight position={[0, 6, 0]} intensity={40} color="#ffffff" distance={20} decay={1.5} />
          <pointLight position={[-5, 6, -3]} intensity={35} color="#4fc3f7" distance={18} decay={1.5} />
          <pointLight position={[5, 6, -3]} intensity={35} color="#4fc3f7" distance={18} decay={1.5} />

          <Suspense fallback={null}>
            <Room />
            <CompanyWallBranding />
            <BuildingEntrance />
            <LogoutDoor />
            <ManagerDoor isLocked={managerDoorLocked} />
            <ManagerDoorScreen />
            <ManagerRoom />
            <Stage0Door />
            <Stage0Room />
            <Stage1Door />
            <Stage1Room />
            <ProductionHall />
            <BackRooms />
            <HologramStats />
            <PerimeterWall />

            {phase === "playing" && (
              <>
                <Player />
                <Desk position={[-5.5, 0, -4]} rotation={[0, -Math.PI / 2, 0]} />
                <HumanDeveloper position={[-6.8, 0, -4]} rotation={[0, Math.PI / 2, 0]} />

                {(() => {
                  // Track slot index per room to place multiple models side-by-side
                  const roomSlotCounters: Record<string, number> = {};
                  return models.map((model) => {
                    const room = model.roomAssignment || "main";
                    const slotIdx = roomSlotCounters[room] ?? 0;
                    roomSlotCounters[room] = slotIdx + 1;
                    const slot = getRoomSlot(room, slotIdx);
                    return (
                      <group key={model.id}>
                        <Desk position={slot.desk} rotation={slot.deskRotation} />
                        <Robot
                          position={slot.robot}
                          rotation={slot.robotRotation}
                          color={getModelColor(model.index)}
                          robotId={model.id}
                          label={model.name}
                        />
                      </group>
                    );
                  });
                })()}

                {/* Hall worker robots — distributed inside ProductionHall */}
                {hallWorkers.map((worker) => (
                  <group key={worker.id}>
                    <Desk position={getHallWorkerDeskPosition(worker.index)} rotation={getHallWorkerDeskRotation(worker.index)} />
                    <Robot
                      position={getHallWorkerPosition(worker.index)}
                      rotation={getHallWorkerRotation(worker.index)}
                      color={getHallWorkerColor(worker.index)}
                      robotId={worker.id}
                      label={worker.name}
                    />
                  </group>
                ))}

              </>
            )}
          </Suspense>
        </Canvas>
      </KeyboardControls>

      {/* شاشة اختيار الأفاتار بعد تسجيل الدخول */}
      {phase === "avatar_select" && <AvatarSelect />}

      <LoadingOverlay />
      <ManagerKeypadOverlay />
      <StageKeypadOverlay />
      <ManagerVideoOverlay />
      <HologramStatsOverlay />
      <HumanOverlay />
      <BroadcastUI />
      <ChatBubble />
      <VaultSettingsDialog />
      <BackgroundJobs />
      <AutoTriggerPanel />
      <CameraButtons />
      <GameUI />
    </div>
  );
}

export default App;
