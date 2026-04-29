import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useState, useRef, useMemo, lazy } from "react";
import * as THREE from "three";
import { KeyboardControls, OrbitControls, useKeyboardControls } from "@react-three/drei";
import "@fontsource/inter";
import { Room } from "./components/game/Room";
import { Desk } from "./components/game/Desk";
import { HumanDeveloper } from "./components/game/HumanDeveloper";
import { Robot } from "./components/game/Robot";
import { Player } from "./components/game/Player";
import { GameUI } from "./components/game/GameUI";
import { GuestUI } from "./components/game/GuestUI";
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
import { CpOverlay } from "./components/game/CpOverlay";
import { BroadcastUI } from "./components/game/BroadcastUI";
import { MeetingMinutesOverlay } from "./components/game/MeetingMinutesOverlay";
const AgoraMeeting = lazy(() => import("./components/game/AgoraMeeting").then(m => ({ default: m.AgoraMeeting })));
import { CameraButtons } from "./components/game/CameraButtons";
import { CityBackground } from "./components/game/CityBackground";
import { ModeSelectScreen } from "./components/game/ModeSelectScreen";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { useGame, getRoomSlot, getModelColor, getHallWorkerPosition, getHallWorkerDeskPosition, getHallWorkerRotation, getHallWorkerDeskRotation, getHallWorkerColor, getModelRobotPosition, getMeetingLayout, getHumanSlot } from "./lib/stores/useGame";
import { useChat } from "./lib/stores/useChat";
import { useGLTF, useProgress } from "@react-three/drei";

// تفعيل Draco decoder للملفات المضغوطة
useGLTF.setDecoderPath("/draco-gltf/");
import { getAuthToken, setAuthToken, setRoomId } from "./lib/utils";

const controls = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "back", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "interact", keys: ["KeyF"] },
];

// ── نظام تصادم الكاميرا — يحوّل world↔local ويطبّق حدود المناطق ──────────────
// group position=[-20,0.3,190.5] rotation=[0,PI/2,0]:
//   x_local = 190.5 - world_z
//   z_local = world_x + 20
//   world_x = z_local - 20
//   world_z = 190.5 - x_local
const CAM_R = 0.4; // نصف قطر الكاميرا

interface DoorLocks {
  s0?: boolean; s1?: boolean; mgr?: boolean;
  hall?: boolean; hall2?: boolean;
  brA?: boolean; brB?: boolean; brC?: boolean;
}

function clampToBuilding(
  wx: number, wz: number,
  curWX: number, curWZ: number,
  locks: DoorLocks = {}
): [number, number] {
  // world → local
  const xl  = 190.5 - wz;
  const zl  = wx + 20;
  const cXl = 190.5 - curWZ;
  const cZl = curWX + 20;
  const R = CAM_R;

  // تحديد المنطقة الحالية
  // Manager/Stage1 مُمدَّدة إلى z=-7 لتغطية انتقال باب الصالة
  const inHall = cZl < -7    && cZl > -18.5 && cXl > -23.5 && cXl <  15.5;
  const inBR   = cZl <= -19  && cZl >= -29   && cXl >= -24  && cXl <=  16;
  const inMgr  = cXl >= 8    && cXl <= 15.5  && cZl >= -7   && cZl <=  0.5;
  const inSt1  = cXl >= -23.5 && cXl <= -16  && cZl >= -7   && cZl <=  0.5;
  const inSt0  = cXl >= -15.5 && cXl <= -8   && cZl >= -6.5 && cZl <=  0.5;

  let cx = xl, cz = zl;
  const atDoor = (lz: number, zmin: number, zmax: number) => lz >= zmin && lz <= zmax;

  if (inBR) {
    // الغرف الخلفية الثلاث
    cz = THREE.MathUtils.clamp(zl, -29 + R, -19 - R);
    if (cXl < -11)    cx = THREE.MathUtils.clamp(xl, -24 + R, -11 - R);
    else if (cXl < 4) cx = THREE.MathUtils.clamp(xl, -10 + R,   3 - R);
    else              cx = THREE.MathUtils.clamp(xl,   4 + R,  16 - R);
    // خروج للقاعة (لا يحتاج كود للخروج)
    if (zl > -19 - R) {
      const atBR = Math.abs(cXl - (-17.5)) <= 1.5 || Math.abs(cXl - (-3.5)) <= 1.5 || Math.abs(cXl - 10) <= 1.5;
      cz = atBR ? zl : -19 - R;
    }

  } else if (inHall) {
    // صالة الإنتاج
    cx = THREE.MathUtils.clamp(xl, -23.5 + R, 15.5 - R);
    cz = THREE.MathUtils.clamp(zl, -18.5 + R, -7 - R);
    // خروج للأمام (Stage1 أو Manager) — لا يحتاج كود للخروج
    if (zl > -7 - R) {
      const atD = Math.abs(cXl - (-20)) <= 1.5 || Math.abs(cXl - 12) <= 1.5;
      cz = atD ? zl : -7 - R;
    }
    // دخول الغرف الخلفية
    if (zl < -18.5 + R) {
      const nearA = Math.abs(cXl - (-17.5)) <= 1.5 && !locks.brA;
      const nearB = Math.abs(cXl - (-3.5))  <= 1.5 && !locks.brB;
      const nearC = Math.abs(cXl - 10)      <= 1.5 && !locks.brC;
      cz = (nearA || nearB || nearC) ? zl : -18.5 + R;
    }

  } else if (inMgr) {
    // غرفة المدير
    cx = THREE.MathUtils.clamp(xl,  8 + R, 15.5 - R);
    cz = THREE.MathUtils.clamp(zl, -7 + R, 0.5 - R);
    // الخروج للصالة الرئيسية عبر باب المدير
    if (xl < 8 + R && atDoor(zl, -5, 0)) cx = xl;
    // الدخول لصالة الإنتاج عبر Hall Door 2 (x≈12, z→-7)
    if (zl < -7 + R && Math.abs(xl - 12) <= 1.5 && !locks.hall2) cz = zl;

  } else if (inSt1) {
    // غرفة Stage1
    cx = THREE.MathUtils.clamp(xl, -23.5 + R, -16 - R);
    cz = THREE.MathUtils.clamp(zl, -7 + R,   0.5 - R);
    // الانتقال بين Stage0 وStage1
    if (xl > -16 - R  && atDoor(zl, -5, 0)) cx = xl;
    if (xl < -23.5 + R && atDoor(zl, -5, 0)) cx = xl;
    // الدخول لصالة الإنتاج عبر Hall Door 1 (x≈-20, z→-7)
    if (zl < -7 + R && Math.abs(xl - (-20)) <= 1.5 && !locks.hall) cz = zl;

  } else if (inSt0) {
    // غرفة Stage0
    cx = THREE.MathUtils.clamp(xl, -15.5 + R, -8 - R);
    cz = THREE.MathUtils.clamp(zl, -6.5 + R,   0.5 - R);
    // الخروج للصالة الرئيسية
    if (xl > -8 - R    && atDoor(zl, -5, 0)) cx = xl;
    // الدخول لـ Stage1 (يحتاج كود)
    if (xl < -15.5 + R && atDoor(zl, -5, 0) && !locks.s1) cx = xl;

  } else {
    // الصالة الرئيسية
    cx = THREE.MathUtils.clamp(xl, -7 + R, 7 - R);
    cz = THREE.MathUtils.clamp(zl, -7 + R, 7 - R);
    // دخول Stage0 (يحتاج كود)
    if (xl < -7 + R && atDoor(zl, -5, 0) && !locks.s0) cx = xl;
    // دخول Manager (يحتاج كود)
    if (xl >  7 - R && atDoor(zl, -5, 0) && !locks.mgr) cx = xl;
    // منع الخروج من الواجهة الأمامية
    if (zl > 7 - R) cz = 7 - R;
  }

  return [cz - 20, 190.5 - cx];
}

// ── Classic mode door positions in world space ────────────────────────────────
// group at [-20,0.3,190.5] rot=[0,PI/2,0]:  world_x=lz-20, world_z=190.5-lx
const CL_STAGE0_POS  = new THREE.Vector3(-23,   2.5, 198.42); // lx=-7.92,  lz=-3
const CL_STAGE1_POS  = new THREE.Vector3(-23,   2.5, 206.32); // lx=-15.82, lz=-3
const CL_MGR_POS     = new THREE.Vector3(-23,   2.5, 182.58); // lx=+7.92,  lz=-3
const CL_HALL_D1_POS = new THREE.Vector3(-27,   2.5, 210.5);  // lx=-20,    lz=-7
const CL_HALL_D2_POS = new THREE.Vector3(-27,   2.5, 178.5);  // lx=+12,    lz=-7
const CL_BR_A_POS    = new THREE.Vector3(-39,   2.5, 208.0);  // lx=-17.5,  lz=-19
const CL_BR_B_POS    = new THREE.Vector3(-39,   2.5, 194.0);  // lx=-3.5,   lz=-19
const CL_BR_C_POS    = new THREE.Vector3(-39,   2.5, 180.5);  // lx=+10,    lz=-19
const CL_DOOR_DIST   = 2.5;  // مسافة تفعيل الـ keypad

// ── Meeting mode ──────────────────────────────────────────────────────────────
// طاولة الاجتماعات: local [0,0,1.5] → world [-21.5, 0.3, 190.5]
// كاميرا الاجتماع:  local [0,5,5]   → world [-25,   5.3, 190.5]
const MEETING_TABLE_WORLD = new THREE.Vector3(-21.5, 0.3, 190.5);
const MEETING_CAM_WORLD   = new THREE.Vector3(-25,   5.3, 190.5);
const _meetQ = new THREE.Quaternion();
const _meetM = new THREE.Matrix4();
const _upVec = new THREE.Vector3(0, 1, 0);

// MEETING_SEATS / MEETING_ROTS محسوبة ديناميكياً في App() عبر getMeetingLayout

// ── Classic mode: كاميرا حرة — WASD + mouse drag ──────────────────────────
// مركز الشركة في الـ World Space (Classic mode، بدون تحويل local)
// مركز الشركة = world(-30, 0, 194)  [perimeter X:-55..−6, Z:168..221]
const CL_OVERVIEW_CAM    = new THREE.Vector3(-30, 50, 210);
const CL_OVERVIEW_TARGET = new THREE.Vector3(-30,  0, 194);
const CL_RESET_CAM       = new THREE.Vector3(-16, 5.5, 197);
const CL_RESET_TARGET    = new THREE.Vector3(-20, 2.1, 190.5);

function ClassicCameraController() {
  const orbitRef = useRef<any>(null);
  const { camera } = useThree();
  const [, getKeys] = useKeyboardControls<Controls>();
  const fwd    = useMemo(() => new THREE.Vector3(), []);
  const rgt    = useMemo(() => new THREE.Vector3(), []);
  const mv     = useMemo(() => new THREE.Vector3(), []);
  const UP     = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);

  const cameraMode       = useGame((s) => s.cameraMode);
  const cameraResetToken = useGame((s) => s.cameraResetToken);

  // مرجع الكاميرا للوصول إليها من useEffect
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; });

  // ── تغيير وضع الكاميرا ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!orbitRef.current) return;
    // الـ target الحالي (مركز النظر) — نحافظ عليه في معظم الأوضاع
    const tx = orbitRef.current.target.x;
    const tz = orbitRef.current.target.z;
    orbitRef.current.enablePan = false; // الافتراضي: بدون بان

    if (cameraMode === "overview") {
      // مسقط رأسي — كل الشركة
      camera.position.copy(CL_OVERVIEW_CAM);
      orbitRef.current.target.copy(CL_OVERVIEW_TARGET);
      orbitRef.current.enablePan = true;
    } else if (cameraMode === "top") {
      // منظور علوي فوق نقطة النظر الحالية
      camera.position.set(tx, 28, tz);
      orbitRef.current.target.set(tx, 0, tz);
    } else if (cameraMode === "city") {
      // بانورامي من خارج الشركة
      camera.position.set(-10, 55, 220);
      orbitRef.current.target.set(-15, 0, 188);
    } else if (cameraMode === "focus") {
      // قريب — نفس الهدف بارتفاع منخفض
      camera.position.set(tx + 4, 4, tz + 6);
      orbitRef.current.target.set(tx, 1.5, tz);
    } else if (cameraMode === "medium") {
      // متوسط
      camera.position.set(tx + 6, 8, tz + 9);
      orbitRef.current.target.set(tx, 1.5, tz);
    } else if (cameraMode === "fps") {
      // مستوى العين — ارتفاع منخفض
      camera.position.set(tx, 2.2, tz + 0.1);
      orbitRef.current.target.set(tx, 2.2, tz - 2);
    }
    orbitRef.current.update();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode]);

  // ── زر المركزة — يرجع الكاميرا للموضع الافتراضي ────────────────────────────
  useEffect(() => {
    if (cameraResetToken === 0) return;
    camera.position.copy(CL_RESET_CAM);
    if (orbitRef.current) {
      orbitRef.current.target.copy(CL_RESET_TARGET);
      orbitRef.current.enablePan = false;
      orbitRef.current.update();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraResetToken]);

  // F key — فتح المحادثة مع أقرب روبوت (Classic mode)
  useEffect(() => {
    const CLASSIC_ROBOT_DIST = 5; // مسافة التفاعل في وضع الكاميرا الحرة
    // تحويل world → local  (group pos [-20,0.3,190.5], rot Y=π/2)
    // local_x = 190.5 - world_z
    // local_z = world_x + 20
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "KeyF") return;
      const chatState = useChat.getState();
      const gs = useGame.getState();
      // أغلق أي شيء مفتوح
      if (chatState.isOpen) { chatState.closeChat(); return; }
      if (gs.humanOverlayOpen) { gs.closeHumanOverlay(); return; }

      // Avatar mode: playerPos يُحدَّث كل frame من Player.tsx (local coords)
      // Classic mode: نحوّل camera world → local (group pos[-20,0.3,190.5] rot Y=π/2)
      //   local_x = 190.5 - world_z  |  local_z = world_x + 20
      const { x: avatarX, z: avatarZ } = useGame.getState().playerPos;
      const cx = cameraRef.current.position.x;
      const cz = cameraRef.current.position.z;
      const camLx = 190.5 - cz;
      const camLz = cx + 20;
      // استخدم الإحداثيات اللي تعطي أقرب مسافة لأي روبوت
      const getLocalPos = (rx: number, rz: number) => {
        const da = Math.hypot(avatarX - rx, avatarZ - rz);
        const dc = Math.hypot(camLx    - rx, camLz    - rz);
        return da <= dc ? { x: avatarX, z: avatarZ } : { x: camLx, z: camLz };
      };

      // الموظف البشري — local [-6.8, 0, -4]
      const { x: hx, z: hz } = getLocalPos(-6.8, -4);
      if (Math.sqrt((hx - (-6.8)) ** 2 + (hz - (-4)) ** 2) < 3.5) {
        gs.openHumanOverlay();
        return;
      }

      let nearest: string | null = null;
      let minDist = CLASSIC_ROBOT_DIST;

      const roomCounters: Record<string, number> = {};
      for (const model of gs.models) {
        const room    = model.roomAssignment || "main";
        const slotIdx = roomCounters[room] ?? 0;
        roomCounters[room] = slotIdx + 1;
        const pos = getRoomSlot(room, slotIdx).robot;
        const { x: px, z: pz } = getLocalPos(pos[0], pos[2]);
        const dist = Math.sqrt((px - pos[0]) ** 2 + (pz - pos[2]) ** 2);
        if (dist < minDist) { minDist = dist; nearest = model.id; }
      }
      for (const worker of gs.hallWorkers) {
        const pos = getHallWorkerPosition(worker.index);
        const { x: px, z: pz } = getLocalPos(pos[0], pos[2]);
        const dist = Math.sqrt((px - pos[0]) ** 2 + (pz - pos[2]) ** 2);
        if (dist < minDist) { minDist = dist; nearest = worker.id; }
      }

      if (nearest) { chatState.triggerRobotWave(nearest); chatState.openChat(nearest); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // refs لتتبع التقرّب من الأبواب (منع إعادة الفتح المتكرر)
  const wasNearS0  = useRef(false);
  const wasNearS1  = useRef(false);
  const wasNearMgr = useRef(false);
  const wasNearHD1 = useRef(false);
  const wasNearHD2 = useRef(false);
  const wasNearBrA = useRef(false);
  const wasNearBrB = useRef(false);
  const wasNearBrC = useRef(false);

  useEffect(() => {
    const blocked = new Set(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"]);
    const prevent = (e: KeyboardEvent) => { if (blocked.has(e.code)) e.preventDefault(); };
    window.addEventListener("keydown", prevent);
    return () => window.removeEventListener("keydown", prevent);
  }, []);

  useFrame((_, delta) => {
    const gs = useGame.getState();

    // ── Teleport navigation (من لوحة الروبوتات — Classic mode) ───────────────
    const tt = gs.teleportTarget;
    if (tt) {
      gs.setTeleportTarget(null);
      // تحويل local → world: world_x = local_z − 20 , world_z = 190.5 − local_x
      const tx = tt.z - 20;
      const tz = 190.5 - tt.x;

      if (tt.lookAtX !== undefined && tt.lookAtZ !== undefined) {
        // تحويل lookAt local → world
        const lx = tt.lookAtZ - 20;
        const lz = 190.5 - tt.lookAtX;
        // اتجاه من موضع الوقوف إلى الروبوت (world)
        const dx = lx - tx;
        const dz = lz - tz;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = dx / len;
        const nz = dz / len;
        // الكاميرا خلف اللاعب + ارتفاع
        camera.position.set(tx - nx * 4, 4, tz - nz * 4);
        if (orbitRef.current) {
          orbitRef.current.target.set(lx, 1.5, lz);
          orbitRef.current.update();
        }
      } else {
        camera.position.set(tx + 4, 4, tz + 4);
        if (orbitRef.current) {
          orbitRef.current.target.set(tx, 1.5, tz);
          orbitRef.current.update();
        }
      }
      return;
    }

    // ── وضع الاجتماع: حرّك الكاميرا نحو الطاولة ────────────────────────────
    if (gs.meetingMode) {
      camera.position.lerp(MEETING_CAM_WORLD, 0.05);
      if (orbitRef.current) {
        orbitRef.current.target.lerp(MEETING_TABLE_WORLD, 0.05);
        orbitRef.current.update();
      }
      return;
    }

    // ── وضع المسقط الرأسي: الماوس فقط، لا WASD ──────────────────────────────
    if (gs.cameraMode === "overview") {
      if (orbitRef.current) orbitRef.current.update();
      return;
    }

    const anyKeypadOpen = gs.stage0KeypadOpen || gs.stage1KeypadOpen ||
      gs.managerKeypadOpen || gs.hallDoorKeypadOpen || gs.hall2DoorKeypadOpen ||
      gs.brAKeypadOpen || gs.brBKeypadOpen || gs.brCKeypadOpen;

    const { forward, back, left, right } = getKeys();
    const moving = !anyKeypadOpen && (forward || back || left || right);

    if (moving) {
      const speed = 8 * delta;
      camera.getWorldDirection(fwd);
      fwd.y = 0; fwd.normalize();
      rgt.crossVectors(fwd, UP).normalize();
      mv.set(0, 0, 0);
      if (forward) mv.addScaledVector(fwd,  speed);
      if (back)    mv.addScaledVector(fwd, -speed);
      if (left)    mv.addScaledVector(rgt, -speed);
      if (right)   mv.addScaledVector(rgt,  speed);
    }

    // طبّق التصادم على الكاميرا والـ target في كل فريم (يمنع المرور عبر الجدران حتى بالماوس)
    const locks: DoorLocks = {
      s0:    gs.stage0DoorLocked,
      s1:    gs.stage1DoorLocked,
      mgr:   gs.managerDoorLocked,
      hall:  gs.hallDoorLocked,
      hall2: gs.hall2DoorLocked,
      brA:   gs.brADoorLocked,
      brB:   gs.brBDoorLocked,
      brC:   gs.brCDoorLocked,
    };

    const ox = orbitRef.current?.target.x ?? camera.position.x;
    const oz = orbitRef.current?.target.z ?? camera.position.z;

    const [tWX, tWZ] = clampToBuilding(
      ox + (moving ? mv.x : 0),
      oz + (moving ? mv.z : 0),
      ox, oz, locks
    );
    const [camWX, camWZ] = clampToBuilding(
      camera.position.x + (moving ? mv.x : 0),
      camera.position.z + (moving ? mv.z : 0),
      camera.position.x, camera.position.z, locks
    );

    camera.position.x = camWX;
    camera.position.z = camWZ;
    camera.position.y = THREE.MathUtils.clamp(camera.position.y + (moving ? mv.y : 0), 0.3, 12);

    if (orbitRef.current) {
      orbitRef.current.target.x = tWX;
      orbitRef.current.target.z = tWZ;
      orbitRef.current.target.y = THREE.MathUtils.clamp(orbitRef.current.target.y, 0, 8);
      orbitRef.current.update();
    }

    // ── كشف التقرّب من الأبواب وفتح الـ keypad ────────────────────────────
    if (!gs.isGuest) {
      camPos.set(camera.position.x, 2.5, camera.position.z);
      const D = CL_DOOR_DIST;

      const nearS0  = camPos.distanceTo(CL_STAGE0_POS)  < D;
      const nearS1  = camPos.distanceTo(CL_STAGE1_POS)  < D;
      const nearMgr = camPos.distanceTo(CL_MGR_POS)     < D;
      const nearHD1 = camPos.distanceTo(CL_HALL_D1_POS) < D;
      const nearHD2 = camPos.distanceTo(CL_HALL_D2_POS) < D;
      const nearBrA = camPos.distanceTo(CL_BR_A_POS)    < D;
      const nearBrB = camPos.distanceTo(CL_BR_B_POS)    < D;
      const nearBrC = camPos.distanceTo(CL_BR_C_POS)    < D;

      // Stage 0
      if (nearS0 && !wasNearS0.current && gs.stage0DoorLocked && !anyKeypadOpen)  gs.openStage0Keypad();
      if (!nearS0 && gs.stage0KeypadOpen) gs.closeStage0Keypad();
      wasNearS0.current = nearS0;

      // Stage 1
      if (nearS1 && !wasNearS1.current && gs.stage1DoorLocked && !anyKeypadOpen)  gs.openStage1Keypad();
      if (!nearS1 && gs.stage1KeypadOpen) gs.closeStage1Keypad();
      wasNearS1.current = nearS1;

      // Manager
      if (nearMgr && !wasNearMgr.current && gs.managerDoorLocked && !anyKeypadOpen) gs.openManagerKeypad();
      if (!nearMgr && gs.managerKeypadOpen) gs.closeManagerKeypad();
      wasNearMgr.current = nearMgr;

      // Hall Door 1
      if (nearHD1 && !wasNearHD1.current && gs.hallDoorLocked && !anyKeypadOpen)  gs.openHallKeypad();
      if (!nearHD1 && gs.hallDoorKeypadOpen) gs.closeHallKeypad();
      wasNearHD1.current = nearHD1;

      // Hall Door 2
      if (nearHD2 && !wasNearHD2.current && gs.hall2DoorLocked && !anyKeypadOpen) gs.openHall2Keypad();
      if (!nearHD2 && gs.hall2DoorKeypadOpen) gs.closeHall2Keypad();
      wasNearHD2.current = nearHD2;

      // Back Room A
      if (nearBrA && !wasNearBrA.current && gs.brADoorLocked && !anyKeypadOpen)   gs.openBrAKeypad();
      if (!nearBrA && gs.brAKeypadOpen) gs.closeBrAKeypad();
      wasNearBrA.current = nearBrA;

      // Back Room B
      if (nearBrB && !wasNearBrB.current && gs.brBDoorLocked && !anyKeypadOpen)   gs.openBrBKeypad();
      if (!nearBrB && gs.brBKeypadOpen) gs.closeBrBKeypad();
      wasNearBrB.current = nearBrB;

      // Back Room C
      if (nearBrC && !wasNearBrC.current && gs.brCDoorLocked && !anyKeypadOpen)   gs.openBrCKeypad();
      if (!nearBrC && gs.brCKeypadOpen) gs.closeBrCKeypad();
      wasNearBrC.current = nearBrC;
    }
  });

  return (
    <OrbitControls
      ref={orbitRef}
      enablePan={false}
      target={[-20, 2.1, 190.5]}
      minDistance={0.5}
      maxDistance={25}
      maxPolarAngle={Math.PI * 0.85}
    />
  );
}

// ── مؤثر كاميرا الاجتماع — يعمل داخل Canvas في وضع الأفاتار ─────────────────
function MeetingCameraAnimator() {
  const meetingMode = useGame((s) => s.meetingMode);
  useFrame(({ camera }) => {
    if (!meetingMode) return;
    camera.position.lerp(MEETING_CAM_WORLD, 0.06);
    _meetM.lookAt(camera.position, MEETING_TABLE_WORLD, _upVec);
    _meetQ.setFromRotationMatrix(_meetM);
    camera.quaternion.slerp(_meetQ, 0.06);
  }, 5); // priority 5 → يعمل بعد Player (يتغلب على حركة الكاميرا العادية)
  return null;
}

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
  const { active, progress } = useProgress();
  const [show,         setShow]         = useState(true);
  const [fading,       setFading]       = useState(false);
  const [readyToFade,  setReadyToFade]  = useState(false);

  // انتظر 600ms على الأقل قبل السماح بالـ fade-out
  useEffect(() => {
    const t = setTimeout(() => setReadyToFade(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (readyToFade && !active && !fading) {
      const t = setTimeout(() => setFading(true), 100);
      return () => clearTimeout(t);
    }
  }, [readyToFade, active, fading]);

  useEffect(() => {
    if (fading) {
      const t = setTimeout(() => setShow(false), 1100);
      return () => clearTimeout(t);
    }
  }, [fading]);

  if (!show) return null;

  const pct = Math.min(Math.round(progress), 100);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 8500,
      opacity: fading ? 0 : 1,
      transition: "opacity 1.1s cubic-bezier(0.4,0,0.2,1)",
      pointerEvents: fading ? "none" : "all",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes wv1 {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes wv2 {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
        @keyframes bbl {
          0%   { transform: translateY(0)     scale(1);   opacity: 0.7; }
          100% { transform: translateY(-90vh) scale(1.5); opacity: 0;   }
        }
        @keyframes wfloat {
          0%,100% { transform: translateY(0px);  }
          50%     { transform: translateY(-9px); }
        }
        @keyframes wpulse {
          0%,100% { box-shadow: 0 0 18px rgba(79,195,247,0.25), inset 0 0 12px rgba(79,195,247,0.08); }
          50%     { box-shadow: 0 0 40px rgba(79,195,247,0.55), inset 0 0 20px rgba(79,195,247,0.15); }
        }
        @keyframes shimmer {
          0%   { left: -80%; }
          100% { left: 160%; }
        }
        @keyframes ray-pulse {
          0%,100% { opacity: 0.04; }
          50%     { opacity: 0.10; }
        }
      `}</style>

      {/* ── خلفية عمق المحيط ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, #020a14 0%, #041220 40%, #071c34 100%)",
      }} />

      {/* ── أشعة ضوء تحت الماء ── */}
      {[12, 28, 45, 62, 78, 90].map((x, i) => (
        <div key={i} style={{
          position: "absolute",
          top: 0, left: `${x}%`,
          width: `${60 + i * 10}px`, height: "55%",
          background: `linear-gradient(180deg, rgba(79,195,247,0.07) 0%, transparent 100%)`,
          transform: `rotate(${-15 + i * 6}deg)`,
          transformOrigin: "top center",
          animation: `ray-pulse ${2.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
        }} />
      ))}

      {/* ── فقاعات طائرة ── */}
      {[
        { s:5,  x:8,  d:0,   t:7  },
        { s:9,  x:19, d:1.2, t:9  },
        { s:4,  x:33, d:0.5, t:6  },
        { s:7,  x:47, d:2.0, t:8  },
        { s:11, x:61, d:0.3, t:10 },
        { s:5,  x:73, d:1.7, t:7  },
        { s:8,  x:85, d:0.9, t:9  },
        { s:3,  x:92, d:2.5, t:6  },
        { s:6,  x:25, d:3.1, t:8  },
        { s:10, x:55, d:1.5, t:11 },
        { s:4,  x:40, d:2.8, t:7  },
        { s:7,  x:70, d:0.7, t:9  },
      ].map((b, i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: `${5 + (i % 5) * 6}%`,
          left: `${b.x}%`,
          width: b.s, height: b.s,
          borderRadius: "50%",
          background: "rgba(79,195,247,0.10)",
          border: "1px solid rgba(79,195,247,0.35)",
          animation: `bbl ${b.t}s ease-in ${b.d}s infinite`,
        }} />
      ))}

      {/* ── موجات الماء السفلية ── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%" }}>
        {/* موجة أمامية */}
        <div style={{
          position: "absolute", bottom: 0,
          width: "200%", height: "100%",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 80'%3E%3Cpath d='M0,40 C100,10 200,70 400,40 C600,10 700,70 800,40 L800,80 L0,80 Z' fill='%23071c34'/%3E%3C/svg%3E")`,
          backgroundSize: "50% 100%", backgroundRepeat: "repeat-x",
          animation: "wv1 5s linear infinite",
        }} />
        {/* موجة خلفية */}
        <div style={{
          position: "absolute", bottom: 0,
          width: "200%", height: "75%",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 60'%3E%3Cpath d='M0,30 C130,55 270,5 400,30 C530,55 670,5 800,30 L800,60 L0,60 Z' fill='%23051528'/%3E%3C/svg%3E")`,
          backgroundSize: "50% 100%", backgroundRepeat: "repeat-x",
          animation: "wv2 7s linear infinite",
          opacity: 0.75,
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "45%",
          background: "linear-gradient(180deg, #071c34 0%, #020a14 100%)",
        }} />
      </div>

      {/* ── المحتوى المركزي ── */}
      <div style={{
        position: "absolute", top: "42%", left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "22px", zIndex: 2,
      }}>

        {/* الشعار مع دوائر تموج */}
        <div style={{ position: "relative", width: 92, height: 92 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: "absolute",
              inset: `-${i * 16}px`,
              borderRadius: "50%",
              border: `1px solid rgba(79,195,247,${0.22 - i * 0.06})`,
              animation: `wfloat ${2.2 + i * 0.8}s ease-in-out ${i * 0.5}s infinite`,
            }} />
          ))}
          <div style={{
            width: 92, height: 92, borderRadius: "50%",
            background: "linear-gradient(135deg, #061628 0%, #0a2440 100%)",
            border: "2px solid rgba(79,195,247,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "wfloat 3s ease-in-out infinite, wpulse 2.8s ease-in-out infinite",
          }}>
            <img src="/images/sillar_icon.png" alt=""
              style={{ width: 56, height: 56, objectFit: "contain" }} />
          </div>
        </div>

        {/* الاسم */}
        <div style={{
          color: "#4fc3f7", fontSize: "13px", fontWeight: "700",
          fontFamily: "Inter, sans-serif", letterSpacing: "8px",
          textTransform: "uppercase",
          textShadow: "0 0 24px rgba(79,195,247,0.5)",
        }}>
          SILLAR
        </div>

        {/* شريط التحميل المائي */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "7px" }}>
          <div style={{
            width: "190px", height: "5px",
            background: "rgba(79,195,247,0.07)",
            borderRadius: "3px",
            border: "1px solid rgba(79,195,247,0.14)",
            overflow: "hidden", position: "relative",
          }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: "linear-gradient(90deg, #0b3a58, #4fc3f7)",
              borderRadius: "3px",
              transition: "width 0.4s ease",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, bottom: 0, width: "45%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                animation: "shimmer 1.6s linear infinite",
              }} />
            </div>
          </div>
          <div style={{
            color: "rgba(79,195,247,0.45)", fontSize: "10px",
            fontFamily: "monospace", letterSpacing: "3px",
          }}>
            {pct}%
          </div>
        </div>

        {/* نص عربي */}
        <div style={{
          color: "rgba(180,210,240,0.35)", fontSize: "11px",
          fontFamily: "Inter, sans-serif", letterSpacing: "0.5px",
          direction: "rtl",
        }}>
          جارٍ تحميل بيئة العمل...
        </div>
      </div>
    </div>
  );
}

// ── زر الخزنة — ظاهر دائماً في الزاوية العلوية اليمنى ──────────────────────
function VaultButton() {
  const openVault  = useGame((s) => s.openVault);
  const closeVault = useGame((s) => s.closeVault);
  const vaultOpen  = useGame((s) => s.vaultOpen);
  const isGuest    = useGame((s) => s.isGuest);
  const phase      = useGame((s) => s.phase);

  // مفتاح V عالمي يفتح/يغلق الخزنة
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyV" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        vaultOpen ? closeVault() : openVault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vaultOpen, openVault, closeVault]);

  if (phase !== "playing" || isGuest) return null;

  return (
    <button
      onClick={() => vaultOpen ? closeVault() : openVault()}
      title="الخزنة (V)"
      style={{
        position: "fixed", top: 14, right: 14, zIndex: 500,
        background: "rgba(10,14,22,0.85)",
        border: "1px solid rgba(196,164,74,0.5)",
        borderRadius: "8px",
        color: "#c4a44a",
        padding: "7px 12px",
        cursor: "pointer",
        fontSize: "18px",
        lineHeight: 1,
        backdropFilter: "blur(6px)",
        transition: "all 0.2s",
        boxShadow: "0 0 12px rgba(196,164,74,0.15)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(196,164,74,0.2)"; e.currentTarget.style.borderColor = "#c4a44a"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10,14,22,0.85)"; e.currentTarget.style.borderColor = "rgba(196,164,74,0.5)"; }}
    >
      ⚙️
    </button>
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
  const fetchHumans        = useGame((s) => s.fetchHumans);
  const fetchCompanyInfo   = useGame((s) => s.fetchCompanyInfo);
  const humans             = useGame((s) => s.humans);
  const setIsGuest         = useGame((s) => s.setIsGuest);
  const appMode            = useGame((s) => s.appMode);
  const meetingMode        = useGame((s) => s.meetingMode);

  // حساب مواقع مقاعد الاجتماع حسب عدد الروبوتات الحالي
  const { seats: meetingSeats, rotations: meetingRots } =
    getMeetingLayout(models.length + hallWorkers.length);

  // قراءة ?guest=TOKEN أو ?authToken=TOKEN أو ?humanCode=CODE أو ?agoraMeeting=1 من URL
  const guestToken      = new URLSearchParams(window.location.search).get("guest");
  const urlAuthToken    = new URLSearchParams(window.location.search).get("authToken");
  const humanCode       = new URLSearchParams(window.location.search).get("humanCode");
  const agoraMeetingParam = new URLSearchParams(window.location.search).get("agoraMeeting");

  // true = نحن نتحقق من توكن محفوظ أو guest token أو humanCode، لا تظهر DoorEntry حتى ننتهي
  const [checking, setChecking] = useState(() => !!getAuthToken() || !!guestToken || !!urlAuthToken || !!humanCode);

  const openAgoraMeeting = useGame((s) => s.openAgoraMeeting);

  useEffect(() => {
    if (phase === "playing") {
      fetchModels();
      fetchHallWorkers();
      fetchHumans();
      fetchCompanyInfo();
    }
  }, [phase, fetchModels, fetchHallWorkers, fetchHumans, fetchCompanyInfo]);

  // فتح الاجتماع المرئي تلقائياً إذا جاء المستخدم عبر رابط دعوة
  useEffect(() => {
    if (phase === "playing" && agoraMeetingParam) {
      openAgoraMeeting();
    }
  }, [phase]); // eslint-disable-line

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

  // دخول الموظف البشري عبر رابط الكود
  useEffect(() => {
    if (!humanCode) return;
    fetch(`/api/humans/verify?code=${encodeURIComponent(humanCode)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid && data.roomId && data.member) {
          setRoomId(data.roomId);
          setIsGuest(true);
          unlock({ id: data.roomId, username: data.member.name || "Guest", roomId: data.roomId }, true);
          window.history.replaceState({}, "", window.location.pathname);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line

  // استعادة الجلسة تلقائياً عند تحديث الصفحة (أو عبر ?authToken في iframe)
  useEffect(() => {
    if (guestToken || humanCode) return; // guest path يتولى الأمر بالـ effect أعلاه
    const token = urlAuthToken || getAuthToken();
    if (!token) {
      setChecking(false); // لا يوجد توكن، اعرض شاشة الدخول فوراً
      return;
    }
    // إذا جاء التوكن من URL، احفظه في localStorage للجلسة الحالية
    if (urlAuthToken) {
      setAuthToken(urlAuthToken);
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetch("/api/auth/verify", {
      headers: { "Authorization": `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid && data.user) {
          if (data.user.role !== "admin") setRoomId(data.user.roomId);
          unlock({
            id: data.user.roomId,
            username: data.user.username,
            roomId: data.user.roomId,
            role: data.user.role || "user",
          }, true); // skipAvatarSelect=true للدخول التلقائي
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false)); // انتهى التحقق في كلتا الحالتين
  }, []); // يشتغل مرة واحدة عند التحميل

  // جارٍ التحقق من الجلسة المحفوظة — لا تعرض أي شيء بعد
  if (checking) return <LoadingScreen />;

  // شاشة اختيار وضع التشغيل — قبل كل شيء
  if (appMode === null) return <ModeSelectScreen />;

  // لوحة الادمن
  if (phase === "admin") {
    return <AdminDashboard />;
  }

  // شاشة اللوجين — قبل أي تحميل 3D حتى لا تثقّل الـ GPU على الإدخال
  if (phase === "locked") {
    return (
      <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
        <DoorEntry onUnlock={(user) => unlock(user, appMode === "classic")} />
      </div>
    );
  }

  // ── Classic mode: مبنى بدون أفاتار، كاميرا ثابتة، خفيف ──────────────────
  if (appMode === "classic") {
    return (
      <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
        <KeyboardControls map={controls}>
        <Canvas
          flat
          shadows={false}
          camera={{ position: [-16, 2.1, 190.5], fov: 70, near: 0.1, far: 500 }}
          gl={{ antialias: false, powerPreference: "low-power" }}
        >
          <color attach="background" args={["#1a1a2a"]} />
          <ambientLight intensity={3.5} color="#ffffff" />
          <hemisphereLight intensity={1.5} color="#e0e0ff" groundColor="#4a4a6a" />
          <directionalLight position={[-15, 12, 190]} intensity={1.5} color="#ffffff" />

          <Suspense fallback={null}>
            <group position={[-20, 0.3, 190.5]} rotation={[0, Math.PI / 2, 0]}>
              <pointLight position={[0, 6, 0]} intensity={40} color="#ffffff" distance={20} decay={1.5} />
              <pointLight position={[-5, 6, -3]} intensity={35} color="#4fc3f7" distance={18} decay={1.5} />
              <pointLight position={[5, 6, -3]} intensity={35} color="#4fc3f7" distance={18} decay={1.5} />
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

              {/* ── الموظفون والروبوتات ── */}
              <Desk position={[-5.5, 0, -4]} rotation={[0, -Math.PI / 2, 0]} />
              <HumanDeveloper position={[-6.8, 0, -4]} rotation={[0, Math.PI / 2, 0]} />

              {/* ── الموظفون البشريون من الخزنة ── */}
              {humans.map((human, hIdx) => {
                const slot = getHumanSlot(hIdx);
                return (
                  <group key={human.id}>
                    <Desk position={slot.desk} rotation={slot.deskRot} />
                    <HumanDeveloper position={slot.human} rotation={slot.humanRot} />
                  </group>
                );
              })}

              {(() => {
                const roomSlotCounters: Record<string, number> = {};
                return models.map((model, mIdx) => {
                  const room = model.roomAssignment || "main";
                  const slotIdx = roomSlotCounters[room] ?? 0;
                  roomSlotCounters[room] = slotIdx + 1;
                  const slot = getRoomSlot(room, slotIdx);
                  return (
                    <group key={model.id}>
                      <Desk position={slot.desk} rotation={slot.deskRotation} />
                      <Robot
                        position={meetingMode ? meetingSeats[mIdx % meetingSeats.length] : slot.robot}
                        rotation={meetingMode ? meetingRots[mIdx % meetingRots.length]   : slot.robotRotation}
                        color={getModelColor(model.index)}
                        robotId={model.id}
                        label={model.name}
                      />
                    </group>
                  );
                });
              })()}

              {hallWorkers.map((worker, wIdx) => {
                const gIdx = models.length + wIdx;
                return (
                  <group key={worker.id}>
                    <Desk position={getHallWorkerDeskPosition(worker.index)} rotation={getHallWorkerDeskRotation(worker.index)} />
                    <Robot
                      position={meetingMode ? meetingSeats[gIdx % meetingSeats.length] : getHallWorkerPosition(worker.index)}
                      rotation={meetingMode ? meetingRots[gIdx % meetingRots.length]   : getHallWorkerRotation(worker.index)}
                      color={getHallWorkerColor(worker.index)}
                      robotId={worker.id}
                      label={worker.name}
                    />
                  </group>
                );
              })}
            </group>
          </Suspense>

          <ClassicCameraController />
        </Canvas>
        </KeyboardControls>

        <LoadingOverlay />
        <ManagerKeypadOverlay />
        <StageKeypadOverlay />
        <ManagerVideoOverlay />
        <HologramStatsOverlay />
        <HumanOverlay />
        <CpOverlay />
        <BroadcastUI />
        <MeetingMinutesOverlay />
        <Suspense fallback={null}><AgoraMeeting /></Suspense>
        <ChatBubble />
        <VaultSettingsDialog />
        <BackgroundJobs />
        <AutoTriggerPanel />
        <CameraButtons />
        <VaultButton />
        <GameUI />
        <GuestUI />
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
            far: 500,
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
          <Suspense fallback={null}>
            {/* المدينة في إحداثياتها الخاصة — خارج group الشركة */}
            <CityBackground />

            {/* ── الشركة في قلب المدينة — offset (-20, 0, 200) ── */}
            <group position={[-20, 0.3, 190.5]} rotation={[0, Math.PI / 2, 0]}>
              <pointLight position={[0, 6, 0]} intensity={40} color="#ffffff" distance={20} decay={1.5} />
              <pointLight position={[-5, 6, -3]} intensity={35} color="#4fc3f7" distance={18} decay={1.5} />
              <pointLight position={[5, 6, -3]} intensity={35} color="#4fc3f7" distance={18} decay={1.5} />

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

                  {/* ── الموظفون البشريون من الخزنة ── */}
                  {humans.map((human, hIdx) => {
                    const slot = getHumanSlot(hIdx);
                    return (
                      <group key={human.id}>
                        <Desk position={slot.desk} rotation={slot.deskRot} />
                        <HumanDeveloper position={slot.human} rotation={slot.humanRot} />
                      </group>
                    );
                  })}

                  {(() => {
                    const roomSlotCounters: Record<string, number> = {};
                    return models.map((model, mIdx) => {
                      const room = model.roomAssignment || "main";
                      const slotIdx = roomSlotCounters[room] ?? 0;
                      roomSlotCounters[room] = slotIdx + 1;
                      const slot = getRoomSlot(room, slotIdx);
                      return (
                        <group key={model.id}>
                          <Desk position={slot.desk} rotation={slot.deskRotation} />
                          <Robot
                            position={meetingMode ? MEETING_SEATS[mIdx % MEETING_SEATS.length] : slot.robot}
                            rotation={meetingMode ? MEETING_ROTS[mIdx % MEETING_ROTS.length]   : slot.robotRotation}
                            color={getModelColor(model.index)}
                            robotId={model.id}
                            label={model.name}
                          />
                        </group>
                      );
                    });
                  })()}

                  {/* Hall worker robots */}
                  {hallWorkers.map((worker, wIdx) => {
                    const gIdx = models.length + wIdx;
                    return (
                      <group key={worker.id}>
                        <Desk position={getHallWorkerDeskPosition(worker.index)} rotation={getHallWorkerDeskRotation(worker.index)} />
                        <Robot
                          position={meetingMode ? MEETING_SEATS[gIdx % MEETING_SEATS.length] : getHallWorkerPosition(worker.index)}
                          rotation={meetingMode ? MEETING_ROTS[gIdx % MEETING_ROTS.length]   : getHallWorkerRotation(worker.index)}
                          color={getHallWorkerColor(worker.index)}
                          robotId={worker.id}
                          label={worker.name}
                        />
                      </group>
                    );
                  })}

                </>
              )}
            </group> {/* end company group [50,0,130] */}
          </Suspense>
          <MeetingCameraAnimator />
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
      <MeetingMinutesOverlay />
      <AgoraMeeting />
      <ChatBubble />
      <VaultSettingsDialog />
      <BackgroundJobs />
      <AutoTriggerPanel />
      <CameraButtons />
      <VaultButton />
      <GameUI />
      <GuestUI />
    </div>
  );
}

export default App;
