import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { useRef, useCallback, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls, OrbitControls, useGLTF, useAnimations, Edges, Text } from "@react-three/drei";
import { useChat } from "@/lib/stores/useChat";
import { useGame, getModelRobotPosition, getHallWorkerPosition } from "@/lib/stores/useGame";

const ENTER_SPAWN_Z  = 8.5;   // نقطة البداية خارج الباب
const ENTER_TARGET_Z = 4.5;   // نقطة الوصول — أمام الطاولة

const SPEED = 5;
const ROOM_BOUNDS_X = 7;
const ROOM_BOUNDS_Z_MIN = -7;
const ROOM_BOUNDS_Z_MAX = 7;
const PLAYER_RADIUS = 0.3;
const INTERACT_DISTANCE = 3;

const MANAGER_ROOM_X_MIN = 8;
const MANAGER_ROOM_X_MAX = 15.5;
const MANAGER_ROOM_Z_MIN = -6.5;
const MANAGER_ROOM_Z_MAX = 0.5;
const DOOR_Z_MIN = -5;
const DOOR_Z_MAX = 0;

// ── Stage0 room (on LEFT wall, x < −8) ───────────────────────────────────────
const STAGE0_ROOM_X_MAX = -8;
const STAGE0_ROOM_X_MIN = -15.5;
const STAGE0_ROOM_Z_MIN = -6.5;
const STAGE0_ROOM_Z_MAX = 0.5;

// ── Stage1 room (behind Stage0, x < −16) ─────────────────────────────────────
const STAGE1_ROOM_X_MAX = -16;
const STAGE1_ROOM_X_MIN = -23.5;
const STAGE1_ROOM_Z_MIN = -6.5;
const STAGE1_ROOM_Z_MAX = 0.5;

// ── Production Hall (behind all rooms, z < −7) ────────────────────────────────
const HALL_X_MIN   = -23.5;
const HALL_X_MAX   =  15.5;
const HALL_Z_MIN   = -18.5;
const HALL_Z_FRONT =  -7.0;
const HALL_DOOR1_X = -20.0;   // Stage1-side door (world x)
const HALL_DOOR2_X =  12.0;   // Manager-side door (world x)
const HALL_DOOR_HW =   1.2;   // door half-width guard (door=3 minus player margin)

// ── Back Rooms (behind production hall, z < −19) ──────────────────────────────
const BR_Z_MAX    = -19.0;   // entrance (= hall back wall)
const BR_Z_MIN    = -29.0;   // far back wall
const BR_A_X_MIN  = -24.0;
const BR_A_X_MAX  = -11.0;   // Room A: amber/orange
const BR_B_X_MIN  = -10.0;
const BR_B_X_MAX  =   3.0;   // Room B: purple
const BR_C_X_MIN  =   4.0;
const BR_C_X_MAX  =  16.0;   // Room C: teal
const BR_DOOR_A_X = -17.5;   // door center into Room A
const BR_DOOR_B_X =  -3.5;   // door center into Room B
const BR_DOOR_C_X =  10.0;   // door center into Room C
const BR_DOOR_HW  =   1.3;   // door half-width

const VAULT_POSITION           = new THREE.Vector3(15.2, 0, -6);
const VAULT_INTERACT_DISTANCE  = 3;
const MANAGER_DOOR_POSITION    = new THREE.Vector3(7.92, 0, -3);
const MANAGER_DOOR_INTERACT_DISTANCE = 3;
const STAGE0_DOOR_POSITION     = new THREE.Vector3(-7.92, 0, -3);
const STAGE0_DOOR_INTERACT_DIST = 2.5;
const STAGE1_DOOR_POSITION     = new THREE.Vector3(-15.82, 0, -3);
const STAGE1_DOOR_INTERACT_DIST = 2.5;
const VIDEO_SCREEN_POSITION    = new THREE.Vector3(7.92, 0, 3.5);
const VIDEO_SCREEN_INTERACT_DISTANCE = 1.8;
const HOLOGRAM_POSITION        = new THREE.Vector3(0, 0, 1.5);
const HOLOGRAM_INTERACT_DISTANCE = 1.0;
const HUMAN_DEV_POSITION       = new THREE.Vector3(-6.8, 0, -4);
const HUMAN_DEV_INTERACT_DIST  = 2.5;
const HALL_DOOR1_POSITION      = new THREE.Vector3(HALL_DOOR1_X, 0, HALL_Z_FRONT);
const HALL_DOOR1_INTERACT_DIST = 3.0;
const BR_DOOR_A_POSITION       = new THREE.Vector3(BR_DOOR_A_X, 0, BR_Z_MAX);
const BR_DOOR_B_POSITION       = new THREE.Vector3(BR_DOOR_B_X, 0, BR_Z_MAX);
const BR_DOOR_C_POSITION       = new THREE.Vector3(BR_DOOR_C_X, 0, BR_Z_MAX);
const BR_DOOR_INTERACT_DIST    = 3.0;

const AVATAR_SCALE    = 1.44;
const AVATAR_Y_OFFSET = 0;

// ── COLLISION BOXES [xMin, xMax, zMin, zMax] ──────────────────────────────
// الجدار الأمامي فقط — يمنع الخروج إلا من الباب (x ∈ [-1.8, 1.8])
const OBSTACLES: [number, number, number, number][] = [
  [-7.8, -1.8,  6.7,  9.0],  // جدار يسار الباب
  [ 1.8,  7.8,  6.7,  9.0],  // جدار يمين الباب
];

function isBlocked(x: number, z: number, r: number): boolean {
  for (const [xMin, xMax, zMin, zMax] of OBSTACLES) {
    if (x + r > xMin && x - r < xMax && z + r > zMin && z - r < zMax) {
      return true;
    }
  }
  return false;
}

// scale خاص لكل أفاتار (Mixamo قد يكون بوحدات مختلفة)
const AVATAR_SCALE_MAP: Record<string, number> = {
  avatar:   1.4,
  avatarss: 1.44,
  "1":      0.014,  // Mixamo FBX usually in cm → scale down
  "2":      0.014,
};

// تصحيح rotation لأفاتارات Mixamo (الـ Armature في الـ GLB عنده +90° X)
const AVATAR_ROTATION_MAP: Record<string, [number, number, number]> = {
  avatar:   [0, 0, 0],
  avatarss: [0, 0, 0],
  "1":      [Math.PI / 2, 0, 0],
  "2":      [Math.PI / 2, 0, 0],
};


function getAvatarPath(id: string): string {
  const map: Record<string, string> = {
    avatar:   "/models/avatar.glb",
    avatarss: "/models/avatarss.glb",
  };
  return map[id] ?? "/models/avatar.glb";
}

function GlbPlayerInner() {
  const playerRef = useRef<THREE.Group>(null);
  const avatarRef = useRef<THREE.Group>(null);
  const orbitRef  = useRef<any>(null);

  const [, getKeys]      = useKeyboardControls();
  const lastInteractTime = useRef(0);
  const fpsYaw           = useRef(0);
  const fpsPitch         = useRef(0);
  const wasInManager     = useRef(false);
  const wasInStage0      = useRef(false);
  const wasInStage1      = useRef(false);
  const wasInHall        = useRef(false);
  const wasInBackRoom    = useRef(false);
  const wasNearDoor      = useRef(false);
  const wasNearStage0Door = useRef(false);
  const wasNearStage1Door = useRef(false);
  const wasNearHallDoor1  = useRef(false);
  const wasNearHallDoor2  = useRef(false);
  const wasNearBrADoor    = useRef(false);
  const wasNearBrBDoor    = useRef(false);
  const wasNearBrCDoor    = useRef(false);
  const wasInBackRoomA    = useRef(false);
  const wasInBackRoomB    = useRef(false);
  const wasInBackRoomC    = useRef(false);
  const wasNearScreen          = useRef(false);
  const videoManuallyClosed    = useRef(false);
  const wasVideoOpen           = useRef(false);
  const wasNearHologram        = useRef(false);
  const hologramManuallyClosed = useRef(false);
  const wasHologramOpen        = useRef(false);
  const currentAnim      = useRef<string | null>(null);
  const autoEnterT       = useRef<number | null>(null); // null=لا, 0-1=جارٍ الدخول
  // Cached vectors — reused every frame to avoid GC pressure
  const dirVec           = useRef(new THREE.Vector3());
  const camTargetVec     = useRef(new THREE.Vector3());
  // Glass box
  const boxRef           = useRef<THREE.Group>(null);
  const boxTimeRef       = useRef(0);
  const carryingBox      = useGame((s) => s.carryingBox);
  const setExteriorView  = useGame((s) => s.setExteriorView);
  const wasExteriorRef   = useRef(false);
  const cameraMode       = useGame((s) => s.cameraMode);
  const prevCameraMode   = useRef<"focus" | "medium" | "top" | "fps">(cameraMode);

  // ── GLB model + animations ─────────────────────────────────────────────────
  const selectedAvatar = useGame((s) => s.selectedAvatar);
  const avatarPath = getAvatarPath(selectedAvatar);

  // نحمّل الـ mesh + animations من نفس الملف
  const { scene, animations } = useGLTF(avatarPath);

  // SkeletonUtils.clone يضمن clone صحيح للـ SkinnedMesh (بدونه يظهر أفاتار ثاني)
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene) as THREE.Group, [scene]);
  const { mixer } = useAnimations(animations, avatarRef);

  const idleAnim = useMemo(
    () => animations.find((c) => /idle/i.test(c.name))?.name ?? animations[0]?.name ?? null,
    [animations],
  );
  const walkAnim = useMemo(
    () => animations.find((c) => /walk/i.test(c.name))?.name ?? animations[1]?.name ?? animations[0]?.name ?? null,
    [animations],
  );

  // Use mixer.clipAction directly — avoids the drei proxy which caches stale actions
  // after avatar switches. Three.js's own mixer cache (by clipUUID+rootUUID) is reliable.
  const playAnimation = useCallback(
    (name: string | null) => {
      if (!name || currentAnim.current === name || !avatarRef.current) return;
      const clip = animations.find((c) => c.name === name);
      if (!clip) return;
      if (currentAnim.current) {
        const prevClip = animations.find((c) => c.name === currentAnim.current);
        if (prevClip) mixer.clipAction(prevClip, avatarRef.current).fadeOut(0.25);
      }
      mixer.clipAction(clip, avatarRef.current).reset().fadeIn(0.25).play();
      currentAnim.current = name;
    },
    [animations, mixer],
  );

  // ── Animation init — runs whenever the model/clips change (e.g. avatar swap) ─
  // We bypass the actions proxy (which caches stale clip actions from the old model)
  // and call mixer.clipAction directly so we always get a fresh action on the new skeleton.
  useEffect(() => {
    if (!avatarRef.current || animations.length === 0) return;
    const clip = animations.find((c) => /idle/i.test(c.name)) ?? animations[0];
    if (!clip) return;
    mixer.stopAllAction();
    currentAnim.current = null;
    const action = mixer.clipAction(clip, avatarRef.current);
    action.reset().play();
    currentAnim.current = clip.name;
  }, [animations, mixer]);

  // وجه اللاعب للداخل عند البداية (خارج الباب)
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.rotation.y = Math.PI;
    }
  }, []);

  // ── تظهر الصندوق عند إغلاق المحادثة بأي طريقة (F أو زر X) ──────────────
  const chatIsOpen = useChat((s) => s.isOpen);
  const chatWasOpenRef = useRef(false);
  useEffect(() => {
    if (!chatIsOpen && chatWasOpenRef.current) {
      useGame.getState().setCarryingBox(true);
    }
    chatWasOpenRef.current = chatIsOpen;
  }, [chatIsOpen]);

  // ── Auto-enter — triggered by confirmAvatar() via store flag ──────────────
  // Using a store flag (pendingAutoEnter) instead of prevPhase ref so it
  // survives Suspense remounts when a new avatar model is being fetched.
  const pendingAutoEnter = useGame((s) => s.pendingAutoEnter);
  useEffect(() => {
    if (!pendingAutoEnter) return;
    useGame.getState().clearAutoEnter();
    autoEnterT.current = 0;
    if (playerRef.current) {
      playerRef.current.position.set(0, 0, ENTER_SPAWN_Z);
      playerRef.current.rotation.y = Math.PI;
    }
  }, [pendingAutoEnter]);

  // ── FPS mode: pointer-lock + cursor hide ──────────────────────────────────────
  useEffect(() => {
    const canvas = document.querySelector("canvas") as HTMLElement | null;
    if (cameraMode === "fps") {
      if (canvas) canvas.style.cursor = "none";   // أخفِ السهم فوراً
      canvas?.requestPointerLock?.();
    } else {
      if (canvas) canvas.style.cursor = "";        // أعِد الكرسر عند الخروج
      if (document.pointerLockElement) document.exitPointerLock?.();
    }
  }, [cameraMode]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      fpsYaw.current   -= e.movementX * 0.002;
      fpsPitch.current  = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5,
        fpsPitch.current - e.movementY * 0.002));
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  // ── Ctrl = toggle الماوس في وضع FPS (ضغطة تُظهر، ضغطة تُخفي) ───────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== "Control") return;
      if (useGame.getState().cameraMode !== "fps") return;
      e.preventDefault();
      const canvas = document.querySelector("canvas") as HTMLElement | null;
      if (document.pointerLockElement) {
        document.exitPointerLock();
        if (canvas) canvas.style.cursor = "default";  // أظهر الكرسر عند الفكّ
      } else {
        if (canvas) { canvas.style.cursor = "none"; canvas.focus(); canvas.requestPointerLock?.(); }
      }
    };
    // capture:true → يلتقط الحدث قبل أي dialog أو input
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);
  // ───────────────────────────────────────────────────────────────────────────

  const getNearestRobot = useCallback(() => {
    if (!playerRef.current) return null;
    const playerPos = playerRef.current.position;
    const models    = useGame.getState().models;
    let nearest: string | null = null;
    let minDist = Infinity;
    for (const model of models) {
      const pos  = getModelRobotPosition(model.index);
      const dist = playerPos.distanceTo(new THREE.Vector3(...pos));
      if (dist < INTERACT_DISTANCE && dist < minDist) {
        minDist  = dist;
        nearest  = model.id;
      }
    }
    return nearest;
  }, []);

  const getNearestHallWorker = useCallback(() => {
    if (!playerRef.current) return null;
    const playerPos   = playerRef.current.position;
    const hallWorkers = useGame.getState().hallWorkers;
    let nearest: string | null = null;
    let minDist = Infinity;
    for (const worker of hallWorkers) {
      const pos  = getHallWorkerPosition(worker.index);
      const dist = playerPos.distanceTo(new THREE.Vector3(...pos));
      if (dist < INTERACT_DISTANCE && dist < minDist) {
        minDist = dist;
        nearest = worker.id;
      }
    }
    return nearest;
  }, []);

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    // ── كشف الكاميرا برة / جوا لإخفاء عناصر Html الداخلية ──────────────────
    const nowExterior = state.camera.position.z > 8.5;
    if (nowExterior !== wasExteriorRef.current) {
      wasExteriorRef.current = nowExterior;
      setExteriorView(nowExterior);
    }

    // ── Auto-enter animation (بعد تسجيل الدخول) ─────────────────────────────
    if (autoEnterT.current !== null) {
      autoEnterT.current += delta * 0.42;
      const t     = Math.min(autoEnterT.current, 1);
      const eased = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out

      // اللاعب يمشي من الخارج للداخل
      const newZ = THREE.MathUtils.lerp(ENTER_SPAWN_Z, ENTER_TARGET_Z, eased);
      playerRef.current.position.z = newZ;
      playerRef.current.rotation.y = Math.PI;

      // الكاميرا تتحرك مباشرة من الخارج للداخل (تجاوز OrbitControls)
      const camZ = THREE.MathUtils.lerp(13, 7, eased);
      const camY = THREE.MathUtils.lerp(4,  5, eased);
      state.camera.position.set(0, camY, camZ);
      state.camera.lookAt(0, 1.2, newZ - 3);

      // زامن target الـ OrbitControls بصمت
      if (orbitRef.current) {
        orbitRef.current.target.set(0, 1.2, newZ);
      }

      playAnimation(walkAnim);

      if (t >= 1) {
        autoEnterT.current = null;
        if (orbitRef.current) orbitRef.current.update(); // استأنف OrbitControls
      }
      return;
    }

    const keys      = getKeys();
    const chatState = useChat.getState();
    const gameState = useGame.getState();

    // ── Interact key ──────────────────────────────────────────────────────────
    if (keys.interact) {
      const now = Date.now();
      if (now - lastInteractTime.current > 500) {
        lastInteractTime.current = now;
        if (chatState.isOpen) {
          chatState.closeChat();
        } else if (gameState.vaultOpen) {
          gameState.closeVault();
          gameState.setCarryingBox(false);  // اختفى الصندوق عند الإغلاق من الخزنة
        } else if (gameState.managerKeypadOpen) {
          gameState.closeManagerKeypad();
        } else {
          const pp = playerRef.current.position;
          if (!gameState.isGuest && pp.distanceTo(VAULT_POSITION) < VAULT_INTERACT_DISTANCE) {
            gameState.openVault();
            gameState.setCarryingBox(false); // تسليم الصندوق للخزنة
          } else {
            const pp2 = playerRef.current.position;
            if (pp2.distanceTo(HUMAN_DEV_POSITION) < HUMAN_DEV_INTERACT_DIST) {
              if (gameState.humanOverlayOpen) gameState.closeHumanOverlay();
              else gameState.openHumanOverlay();
            } else {
              const nearRobot = getNearestRobot() ?? getNearestHallWorker();
              if (nearRobot) chatState.openChat(nearRobot);
              else if (gameState.carryingBox) gameState.setCarryingBox(false);
            }
          }
        }
      }
    }

    // ── Manager door proximity ────────────────────────────────────────────────
    const playerPos      = playerRef.current.position;
    const distToDoor     = playerPos.distanceTo(MANAGER_DOOR_POSITION);
    const nearDoor       = distToDoor < MANAGER_DOOR_INTERACT_DISTANCE;
    const outsideManager = playerPos.x < MANAGER_ROOM_X_MIN;
    const nearDoorAndOut = nearDoor && outsideManager;

    const justApproachedDoor = nearDoorAndOut && !wasNearDoor.current;
    wasNearDoor.current      = nearDoorAndOut;

    if (justApproachedDoor && !chatState.isOpen && !gameState.vaultOpen && gameState.managerDoorLocked && !gameState.isGuest) {
      gameState.openManagerKeypad();
    }
    if (!nearDoorAndOut && gameState.managerKeypadOpen) {
      gameState.closeManagerKeypad();
    }

    // ── Stage0 door proximity ────────────────────────────────────────────────
    {
      const distS0     = playerPos.distanceTo(STAGE0_DOOR_POSITION);
      const nearS0     = distS0 < STAGE0_DOOR_INTERACT_DIST && playerPos.x > STAGE0_ROOM_X_MAX - PLAYER_RADIUS;
      const justNearS0 = nearS0 && !wasNearStage0Door.current;
      wasNearStage0Door.current = nearS0;
      if (justNearS0 && !chatState.isOpen && gameState.stage0DoorLocked && !gameState.isGuest) {
        gameState.openStage0Keypad();
      }
      if (!nearS0 && gameState.stage0KeypadOpen) {
        gameState.closeStage0Keypad();
      }
    }

    // ── Stage1 door proximity ────────────────────────────────────────────────
    {
      const distS1     = playerPos.distanceTo(STAGE1_DOOR_POSITION);
      const nearS1     = distS1 < STAGE1_DOOR_INTERACT_DIST && playerPos.x > STAGE1_ROOM_X_MAX - PLAYER_RADIUS;
      const justNearS1 = nearS1 && !wasNearStage1Door.current;
      wasNearStage1Door.current = nearS1;
      if (justNearS1 && !chatState.isOpen && gameState.stage1DoorLocked && !gameState.isGuest) {
        gameState.openStage1Keypad();
      }
      if (!nearS1 && gameState.stage1KeypadOpen) {
        gameState.closeStage1Keypad();
      }
    }

    // ── Hall Door 1 proximity (Stage1 ↔ Hall) ────────────────────────────────
    {
      const nearHD1 = playerPos.distanceTo(HALL_DOOR1_POSITION) < HALL_DOOR1_INTERACT_DIST;
      const justNearHD1 = nearHD1 && !wasNearHallDoor1.current;
      wasNearHallDoor1.current = nearHD1;
      if (justNearHD1 && !chatState.isOpen && gameState.hallDoorLocked && !gameState.isGuest) {
        gameState.openHallKeypad();
      }
      if (!nearHD1 && gameState.hallDoorKeypadOpen) gameState.closeHallKeypad();
    }

    // ── Hall Door 2 proximity (Manager ↔ Hall) ────────────────────────────────
    {
      const nearHD2 = playerPos.distanceTo(new THREE.Vector3(HALL_DOOR2_X, 0, HALL_Z_FRONT)) < HALL_DOOR1_INTERACT_DIST;
      const justNearHD2 = nearHD2 && !wasNearHallDoor2.current;
      wasNearHallDoor2.current = nearHD2;
      if (justNearHD2 && !chatState.isOpen && gameState.hall2DoorLocked && !gameState.isGuest) {
        gameState.openHall2Keypad();
      }
      if (!nearHD2 && gameState.hall2DoorKeypadOpen) gameState.closeHall2Keypad();
    }

    // ── Back Room door A proximity ───────────────────────────────────────────
    {
      const nearBrA = playerPos.distanceTo(BR_DOOR_A_POSITION) < BR_DOOR_INTERACT_DIST;
      const justNearBrA = nearBrA && !wasNearBrADoor.current;
      wasNearBrADoor.current = nearBrA;
      if (justNearBrA && !chatState.isOpen && gameState.brADoorLocked && !gameState.isGuest) {
        gameState.openBrAKeypad();
      }
      if (!nearBrA && gameState.brAKeypadOpen) gameState.closeBrAKeypad();
    }

    // ── Back Room door B proximity ───────────────────────────────────────────
    {
      const nearBrB = playerPos.distanceTo(BR_DOOR_B_POSITION) < BR_DOOR_INTERACT_DIST;
      const justNearBrB = nearBrB && !wasNearBrBDoor.current;
      wasNearBrBDoor.current = nearBrB;
      if (justNearBrB && !chatState.isOpen && gameState.brBDoorLocked && !gameState.isGuest) {
        gameState.openBrBKeypad();
      }
      if (!nearBrB && gameState.brBKeypadOpen) gameState.closeBrBKeypad();
    }

    // ── Back Room door C proximity ───────────────────────────────────────────
    {
      const nearBrC = playerPos.distanceTo(BR_DOOR_C_POSITION) < BR_DOOR_INTERACT_DIST;
      const justNearBrC = nearBrC && !wasNearBrCDoor.current;
      wasNearBrCDoor.current = nearBrC;
      if (justNearBrC && !chatState.isOpen && gameState.brCDoorLocked && !gameState.isGuest) {
        gameState.openBrCKeypad();
      }
      if (!nearBrC && gameState.brCKeypadOpen) gameState.closeBrCKeypad();
    }

    // ── Video screen proximity (auto open/close, respects manual close) ──────
    const nearScreen  = playerPos.distanceTo(VIDEO_SCREEN_POSITION) < VIDEO_SCREEN_INTERACT_DISTANCE
      && playerPos.x < MANAGER_ROOM_X_MIN;
    const videoOpen   = gameState.videoScreenOpen;
    if (!nearScreen) {
      videoManuallyClosed.current = false;
      if (videoOpen) gameState.closeVideoScreen();
    } else {
      if (wasVideoOpen.current && !videoOpen) {
        videoManuallyClosed.current = true;
      }
      if (!videoOpen && !videoManuallyClosed.current) {
        gameState.openVideoScreen();
      }
    }
    wasVideoOpen.current  = videoOpen;
    wasNearScreen.current = nearScreen;

    // ── Hologram proximity (auto open/close, respects manual close) ──────────
    const nearHologram  = playerPos.distanceTo(HOLOGRAM_POSITION) < HOLOGRAM_INTERACT_DISTANCE;
    const hologramOpen  = gameState.hologramOpen;
    if (!nearHologram) {
      // Reset manual-close flag when player leaves range
      hologramManuallyClosed.current = false;
      if (hologramOpen) gameState.closeHologram();
    } else {
      // Detect manual close: was open last frame, now closed, still in range
      if (wasHologramOpen.current && !hologramOpen) {
        hologramManuallyClosed.current = true;
      }
      if (!hologramOpen && !hologramManuallyClosed.current) {
        gameState.openHologram();
      }
    }
    wasHologramOpen.current  = hologramOpen;
    wasNearHologram.current  = nearHologram;

    // ── Manager room enter / exit ─────────────────────────────────────────────
    const playerInManager = playerPos.x >= MANAGER_ROOM_X_MIN && playerPos.z >= HALL_Z_FRONT;
    const justEntered     = playerInManager && !wasInManager.current;
    const justLeft        = !playerInManager && wasInManager.current;
    wasInManager.current  = playerInManager;
    if (justLeft) { (gameState as any).lockManagerDoor?.(); useGame.getState().lockHall2Door(); }

    // snap الكاميرا عند الدخول/الخروج من غرفة المدير
    if (justEntered && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(Math.max(playerPos.x - 3, 9.5), playerPos.y + 5, playerPos.z);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    } else if (justLeft && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 4, playerPos.z + 4);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    }

    // ── Stage1 room enter / exit (checked BEFORE Stage0 since Stage1 ⊂ Stage0) ─
    const playerInStage1      = playerPos.x <= STAGE1_ROOM_X_MAX && playerPos.z >= HALL_Z_FRONT;
    const justEnteredStage1   = playerInStage1 && !wasInStage1.current;
    const justLeftStage1      = !playerInStage1 && wasInStage1.current;
    wasInStage1.current       = playerInStage1;
    if (justLeftStage1 && playerPos.z < HALL_Z_FRONT) useGame.getState().lockHallDoor();
    if (justLeftStage1 && playerPos.z >= HALL_Z_FRONT) useGame.getState().lockStage1Door();

    if (justEnteredStage1 && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(Math.min(playerPos.x + 4, -17.5), playerPos.y + 5, playerPos.z);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    } else if (justLeftStage1 && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 4, playerPos.z);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    }

    // ── Stage0 room enter / exit ──────────────────────────────────────────────
    const playerInStage0      = playerPos.x <= STAGE0_ROOM_X_MAX && playerPos.z >= HALL_Z_FRONT;
    const justEnteredStage0   = playerInStage0 && !wasInStage0.current;
    const justLeftStage0      = !playerInStage0 && wasInStage0.current;
    wasInStage0.current       = playerInStage0;
    if (justLeftStage0 && playerPos.x > STAGE0_ROOM_X_MAX) useGame.getState().lockStage0Door();

    if (justEnteredStage0 && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(Math.min(playerPos.x + 4, -9.5), playerPos.y + 5, playerPos.z);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    } else if (justLeftStage0 && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 4, playerPos.z + 4);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    }

    // ── Back Rooms enter / exit ───────────────────────────────────────────────
    const playerInBackRoomA  = playerPos.z < BR_Z_MAX && playerPos.x >= BR_A_X_MIN && playerPos.x <= BR_A_X_MAX;
    const playerInBackRoomB  = playerPos.z < BR_Z_MAX && playerPos.x >= BR_B_X_MIN && playerPos.x <= BR_B_X_MAX;
    const playerInBackRoomC  = playerPos.z < BR_Z_MAX && playerPos.x >= BR_C_X_MIN && playerPos.x <= BR_C_X_MAX;
    const playerInBackRoom   = playerInBackRoomA || playerInBackRoomB || playerInBackRoomC;
    const justEnteredBackRoom  = playerInBackRoom && !wasInBackRoom.current;
    const justLeftBackRoomA    = !playerInBackRoomA && wasInBackRoomA.current;
    const justLeftBackRoomB    = !playerInBackRoomB && wasInBackRoomB.current;
    const justLeftBackRoomC    = !playerInBackRoomC && wasInBackRoomC.current;
    wasInBackRoom.current    = playerInBackRoom;
    wasInBackRoomA.current   = playerInBackRoomA;
    wasInBackRoomB.current   = playerInBackRoomB;
    wasInBackRoomC.current   = playerInBackRoomC;
    if (justLeftBackRoomA) useGame.getState().lockBrADoor()
    if (justLeftBackRoomB) useGame.getState().lockBrBDoor()
    if (justLeftBackRoomC) useGame.getState().lockBrCDoor()

    if (justEnteredBackRoom && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 7, playerPos.z + 5);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1, playerPos.z);
      orbitRef.current.update();
    }

    // ── Production Hall enter / exit ──────────────────────────────────────────
    const playerInHall      = playerPos.z < HALL_Z_FRONT && !playerInBackRoom;
    const justEnteredHall   = playerInHall && !wasInHall.current;
    const justLeftHall      = !playerInHall && wasInHall.current;
    wasInHall.current       = playerInHall;
    if (justLeftHall) {
      if (playerInStage1) useGame.getState().lockHallDoor();
      if (playerInManager) useGame.getState().lockHall2Door();
    }

    if (justEnteredHall && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 6, playerPos.z + 3);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1, playerPos.z);
      orbitRef.current.update();
    }

    // ── Camera mode switch ────────────────────────────────────────────────────
    if (prevCameraMode.current !== cameraMode && orbitRef.current) {
      prevCameraMode.current = cameraMode;
      const pp = playerRef.current.position;
      if (cameraMode === "top") {
        // منظور علوي ثابت يغطي الشركة كاملة
        state.camera.position.set(-4, 60, -10.5);
        orbitRef.current.target.set(-4, 0, -10.5);
      } else {
        // focus / medium — room-aware close follow
        const isFocus = cameraMode === "focus";
        const offY    = isFocus ? 5 : 8;
        let cx: number, cy: number, cz: number;
        if (playerInHall) {
          cx = pp.x; cy = pp.y + offY; cz = pp.z + (isFocus ? 3 : 5);
        } else if (playerInManager) {
          cx = Math.max(pp.x - (isFocus ? 3 : 5), 9.5); cy = pp.y + offY; cz = pp.z;
        } else if (playerInStage1) {
          cx = Math.min(pp.x + (isFocus ? 4 : 6), -17.5); cy = pp.y + offY; cz = pp.z;
        } else if (playerInStage0) {
          cx = Math.min(pp.x + (isFocus ? 4 : 6), -9.5); cy = pp.y + offY; cz = pp.z;
        } else {
          cx = pp.x; cy = pp.y + offY; cz = pp.z + (isFocus ? 4 : 7);
        }
        state.camera.position.set(cx, cy, cz);
        orbitRef.current.target.set(pp.x, pp.y + 1, pp.z);
      }
      orbitRef.current.update();
    }

    // ── Movement ──────────────────────────────────────────────────────────────
    let isMoving = false;

    if (!chatState.isOpen && !gameState.vaultOpen && !gameState.managerKeypadOpen && !gameState.stage0KeypadOpen && !gameState.stage1KeypadOpen && !gameState.hallDoorKeypadOpen && !gameState.hall2DoorKeypadOpen && !gameState.brAKeypadOpen && !gameState.brBKeypadOpen && !gameState.brCKeypadOpen && gameState.phase === "playing") {
      const direction = dirVec.current;
      direction.set(0, 0, 0);

      if (cameraMode === "fps") {
        // حركة نسبية لاتجاه الكاميرا (FPS style)
        const yaw = fpsYaw.current;
        if (keys.forward) { direction.x -= Math.sin(yaw); direction.z -= Math.cos(yaw); }
        if (keys.back)    { direction.x += Math.sin(yaw); direction.z += Math.cos(yaw); }
        if (keys.left)    { direction.x -= Math.cos(yaw); direction.z += Math.sin(yaw); }
        if (keys.right)   { direction.x += Math.cos(yaw); direction.z -= Math.sin(yaw); }
      } else {
        if (keys.forward) direction.z -= 1;
        if (keys.back)    direction.z += 1;
        if (keys.left)    direction.x -= 1;
        if (keys.right)   direction.x += 1;
      }

      if (direction.length() > 0) {
        isMoving = true;
        direction.normalize().multiplyScalar(SPEED * delta);

        const newX = playerRef.current.position.x + direction.x;
        const newZ = playerRef.current.position.z + direction.z;

        const currentZ        = playerRef.current.position.z;
        const isOutside       = currentZ > ROOM_BOUNDS_Z_MAX;
        const managerLocked   = gameState.managerDoorLocked;
        const stage0Locked    = gameState.stage0DoorLocked;
        const stage1Locked    = gameState.stage1DoorLocked;
        const isInDoorwayZ    = newZ >= DOOR_Z_MIN && newZ <= DOOR_Z_MAX;
        const isInManagerX    = !isOutside && (newX >= MANAGER_ROOM_X_MIN - PLAYER_RADIUS);
        const canEnterManager = !managerLocked && isInDoorwayZ;
        const canEnterStage0  = !stage0Locked && newZ >= STAGE0_ROOM_Z_MIN && newZ <= STAGE0_ROOM_Z_MAX;
        const canEnterStage1  = !stage1Locked && newZ >= STAGE1_ROOM_Z_MIN && newZ <= STAGE1_ROOM_Z_MAX;

        let clampedX = newX;
        let clampedZ = newZ;

        if (playerInBackRoom) {
          // ── داخل الغرف الخلفية ────────────────────────────────────────────
          const nearBRDoorA = Math.abs(playerPos.x - BR_DOOR_A_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorB = Math.abs(playerPos.x - BR_DOOR_B_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorC = Math.abs(playerPos.x - BR_DOOR_C_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearAnyBRDoor = nearBRDoorA || nearBRDoorB || nearBRDoorC;
          if (newZ > BR_Z_MAX - PLAYER_RADIUS && nearAnyBRDoor) {
            clampedZ = newZ; // الخروج للقاعة
          } else {
            clampedZ = THREE.MathUtils.clamp(newZ, BR_Z_MIN + PLAYER_RADIUS, BR_Z_MAX - PLAYER_RADIUS);
          }
          if (playerInBackRoomA) {
            clampedX = THREE.MathUtils.clamp(newX, BR_A_X_MIN + PLAYER_RADIUS, BR_A_X_MAX - PLAYER_RADIUS);
          } else if (playerInBackRoomB) {
            clampedX = THREE.MathUtils.clamp(newX, BR_B_X_MIN + PLAYER_RADIUS, BR_B_X_MAX - PLAYER_RADIUS);
          } else if (playerInBackRoomC) {
            clampedX = THREE.MathUtils.clamp(newX, BR_C_X_MIN + PLAYER_RADIUS, BR_C_X_MAX - PLAYER_RADIUS);
          }
        } else if (playerInHall) {
          // ── داخل القاعة الإنتاجية ─────────────────────────────────────────
          clampedX = THREE.MathUtils.clamp(newX, HALL_X_MIN + PLAYER_RADIUS, HALL_X_MAX - PLAYER_RADIUS);
          const nearD1 = Math.abs(playerPos.x - HALL_DOOR1_X) <= HALL_DOOR_HW + PLAYER_RADIUS;
          const nearD2 = Math.abs(playerPos.x - HALL_DOOR2_X) <= HALL_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorA = Math.abs(playerPos.x - BR_DOOR_A_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorB = Math.abs(playerPos.x - BR_DOOR_B_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorC = Math.abs(playerPos.x - BR_DOOR_C_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearAnyBRDoorUnlocked = (nearBRDoorA && !gameState.brADoorLocked)
            || (nearBRDoorB && !gameState.brBDoorLocked)
            || (nearBRDoorC && !gameState.brCDoorLocked);
          if (newZ > HALL_Z_FRONT - PLAYER_RADIUS && ((nearD1 && !gameState.hallDoorLocked) || (nearD2 && !gameState.hall2DoorLocked))) {
            clampedZ = newZ; // خروج للأمام
          } else if (newZ < HALL_Z_MIN + PLAYER_RADIUS && nearAnyBRDoorUnlocked) {
            clampedZ = newZ; // دخول للغرف الخلفية
          } else {
            clampedZ = THREE.MathUtils.clamp(newZ, HALL_Z_MIN + PLAYER_RADIUS, HALL_Z_FRONT - PLAYER_RADIUS);
          }
        } else if (isInManagerX) {
          if (managerLocked) {
            clampedX = Math.min(newX, ROOM_BOUNDS_X - PLAYER_RADIUS);
            clampedZ = THREE.MathUtils.clamp(newZ, ROOM_BOUNDS_Z_MIN + PLAYER_RADIUS, ROOM_BOUNDS_Z_MAX - PLAYER_RADIUS);
          } else {
            clampedX = THREE.MathUtils.clamp(newX, MANAGER_ROOM_X_MIN - PLAYER_RADIUS, MANAGER_ROOM_X_MAX - PLAYER_RADIUS);
            const atHallDoor2 = Math.abs(clampedX - HALL_DOOR2_X) <= HALL_DOOR_HW && !gameState.hall2DoorLocked;
            if (atHallDoor2) {
              // عند الباب: نمدّد الـ Z clamp للسماح بالدخول للقاعة
              clampedZ = THREE.MathUtils.clamp(newZ, HALL_Z_MIN + PLAYER_RADIUS, MANAGER_ROOM_Z_MAX - PLAYER_RADIUS);
            } else {
              clampedZ = THREE.MathUtils.clamp(newZ, MANAGER_ROOM_Z_MIN + PLAYER_RADIUS, MANAGER_ROOM_Z_MAX - PLAYER_RADIUS);
            }
          }
        } else if (playerInStage1 || (playerInStage0 && canEnterStage1 && newX <= STAGE1_ROOM_X_MAX + PLAYER_RADIUS)) {
          // داخل Stage1 أو عند الدخول من Stage0
          clampedX = THREE.MathUtils.clamp(newX, STAGE1_ROOM_X_MIN + PLAYER_RADIUS, STAGE1_ROOM_X_MAX + PLAYER_RADIUS);
          const atHallDoor1 = Math.abs(clampedX - HALL_DOOR1_X) <= HALL_DOOR_HW && !gameState.hallDoorLocked;
          if (atHallDoor1) {
            // عند الباب: نمدّد الـ Z clamp للسماح بالدخول للقاعة
            clampedZ = THREE.MathUtils.clamp(newZ, HALL_Z_MIN + PLAYER_RADIUS, STAGE1_ROOM_Z_MAX - PLAYER_RADIUS);
          } else {
            clampedZ = THREE.MathUtils.clamp(newZ, STAGE1_ROOM_Z_MIN + PLAYER_RADIUS, STAGE1_ROOM_Z_MAX - PLAYER_RADIUS);
          }
        } else if (playerInStage0 || (canEnterStage0 && newX <= STAGE0_ROOM_X_MAX + PLAYER_RADIUS)) {
          // داخل Stage0 أو عند الدخول وهو يحمل الصندوق
          const minX = canEnterStage1 ? STAGE1_ROOM_X_MAX : STAGE0_ROOM_X_MIN + PLAYER_RADIUS;
          clampedX = THREE.MathUtils.clamp(newX, minX, STAGE0_ROOM_X_MAX + PLAYER_RADIUS);
          clampedZ = THREE.MathUtils.clamp(newZ, STAGE0_ROOM_Z_MIN + PLAYER_RADIUS, STAGE0_ROOM_Z_MAX - PLAYER_RADIUS);
        } else if (isOutside) {
          // خارج الصالة: يُسمح بالدخول فقط، لا رجوع للخارج
          clampedX = THREE.MathUtils.clamp(newX, -ROOM_BOUNDS_X + PLAYER_RADIUS, ROOM_BOUNDS_X - PLAYER_RADIUS);
          clampedZ = newZ <= currentZ ? newZ : currentZ;
        } else {
          const maxX = canEnterManager ? MANAGER_ROOM_X_MAX - PLAYER_RADIUS : ROOM_BOUNDS_X - PLAYER_RADIUS;
          // عند canEnterStage0: نسمح بالتحرك حتى x=-8 (عتبة Stage0) بدل -6.7
          const minX = canEnterStage0 ? STAGE0_ROOM_X_MAX : -ROOM_BOUNDS_X + PLAYER_RADIUS;
          clampedX   = THREE.MathUtils.clamp(newX, minX, maxX);
          clampedZ   = THREE.MathUtils.clamp(newZ, ROOM_BOUNDS_Z_MIN + PLAYER_RADIUS, ROOM_BOUNDS_Z_MAX - PLAYER_RADIUS);
        }

        // ── Furniture & wall collision (AABB) — main room only ───────────────
        const curX = playerRef.current.position.x;
        const curZ = playerRef.current.position.z;

        if (!isInManagerX && !playerInStage0 && !isOutside) {
          if (isBlocked(clampedX, clampedZ, PLAYER_RADIUS)) {
            // حاول الانزلاق على محور واحد فقط
            if (!isBlocked(clampedX, curZ, PLAYER_RADIUS)) {
              clampedZ = curZ;  // انزلاق أفقي
            } else if (!isBlocked(curX, clampedZ, PLAYER_RADIUS)) {
              clampedX = curX;  // انزلاق عمودي
            } else {
              clampedX = curX;  // محاصر تماماً — لا تتحرك
              clampedZ = curZ;
            }
          }
        }

        playerRef.current.position.x = clampedX;
        playerRef.current.position.z = clampedZ;

        playerRef.current.rotation.y = Math.atan2(direction.x, direction.z);
      }
    }

    // ── Glass box float animation ──────────────────────────────────────────────
    if (boxRef.current && carryingBox) {
      boxTimeRef.current += delta;
      boxRef.current.position.y = 1.6 + Math.sin(boxTimeRef.current * 2.5) * 0.06;
      boxRef.current.rotation.y += delta * 0.9;
    }

    playAnimation(isMoving ? walkAnim : idleAnim);

    // ── Publish player position → store (used by doors/proximity checks) ───────
    {
      const pp = playerRef.current.position;
      useGame.getState().setPlayerPos(pp.x, pp.z);
    }

    // ── Camera follow ────────────────────────────────────────────────────────
    if (cameraMode === "fps") {
      if (orbitRef.current) orbitRef.current.enabled = false;
      const pp = playerRef.current.position;
      state.camera.position.set(pp.x, pp.y + 2.4, pp.z);
      state.camera.rotation.order = "YXZ";
      state.camera.rotation.y = fpsYaw.current;
      state.camera.rotation.x = fpsPitch.current;
      state.camera.rotation.z = 0;
      // الجسم يدور دائماً مع اتجاه النظر (ليس فقط عند الحركة)
      playerRef.current.rotation.y = fpsYaw.current;
    } else if (orbitRef.current) {
      orbitRef.current.enabled = true;
      const pp = playerRef.current.position;
      camTargetVec.current.set(pp.x, pp.y + 1.5, pp.z);
      orbitRef.current.target.lerp(camTargetVec.current, 0.15);
      orbitRef.current.update();
    }
  });

  return (
    <>
      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={70}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 1, 2]}
      />

      <group ref={playerRef} position={[0, 0, 8.5]}>
        <group
          ref={avatarRef}
          scale={(() => { const s = AVATAR_SCALE_MAP[selectedAvatar] ?? AVATAR_SCALE; return [s, s, s]; })()}
          position={[0, AVATAR_Y_OFFSET, 0]}
          rotation={AVATAR_ROTATION_MAP[selectedAvatar] ?? [0, 0, 0]}
        >
          <primitive object={clonedScene} />
        </group>

        {/* ── Glass box carried by avatar ─────────────────────────────────── */}
        {carryingBox && (
          <group ref={boxRef} position={[0, 2.1, 0.5]}>
            {/* الجسم الزجاجي */}
            <mesh>
              <boxGeometry args={[0.33, 0.33, 0.33]} />
              <meshStandardMaterial
                color="#99ddff"
                transparent
                opacity={0.45}
                roughness={0.05}
                metalness={0.3}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
              <Edges color="#c4a44a" lineWidth={2} />
            </mesh>
            {/* نص S0 على الأوجه الستة */}
            {/* أمام */}
            <Text position={[0, 0, 0.168]} rotation={[0, 0, 0]} fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            {/* خلف */}
            <Text position={[0, 0, -0.168]} rotation={[0, Math.PI, 0]} fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            {/* يمين */}
            <Text position={[0.168, 0, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            {/* يسار */}
            <Text position={[-0.168, 0, 0]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            {/* أعلى */}
            <Text position={[0, 0.168, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            {/* أسفل */}
            <Text position={[0, -0.168, 0]} rotation={[Math.PI / 2, 0, 0]} fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            {/* نقطة ضوئية داخل الصندوق */}
            <pointLight color="#88ccff" intensity={0.8} distance={1.5} decay={2} />
          </group>
        )}
      </group>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Lite Player — procedural robot body, zero GLB loading
// ══════════════════════════════════════════════════════════════════════════════
function LitePlayerInner() {
  const playerRef   = useRef<THREE.Group>(null);
  const orbitRef    = useRef<any>(null);
  const liteBodyRef = useRef<THREE.Group>(null);

  const [, getKeys]          = useKeyboardControls();
  const lastInteractTime     = useRef(0);
  const wasInManager         = useRef(false);
  const wasInStage0          = useRef(false);
  const wasInStage1          = useRef(false);
  const wasInHall            = useRef(false);
  const wasInBackRoom        = useRef(false);
  const wasNearDoor          = useRef(false);
  const wasNearStage0Door    = useRef(false);
  const wasNearStage1Door    = useRef(false);
  const wasNearHallDoor1     = useRef(false);
  const wasNearHallDoor2     = useRef(false);
  const wasNearBrADoor       = useRef(false);
  const wasNearBrBDoor       = useRef(false);
  const wasNearBrCDoor       = useRef(false);
  const wasInBackRoomA       = useRef(false);
  const wasInBackRoomB       = useRef(false);
  const wasInBackRoomC       = useRef(false);
  const wasNearScreen              = useRef(false);
  const videoManuallyClosed        = useRef(false);
  const wasVideoOpen               = useRef(false);
  const wasNearHologram            = useRef(false);
  const hologramManuallyClosed     = useRef(false);
  const wasHologramOpen            = useRef(false);
  const autoEnterT           = useRef<number | null>(null);
  const dirVec               = useRef(new THREE.Vector3());
  const camTargetVec         = useRef(new THREE.Vector3());
  const boxRef               = useRef<THREE.Group>(null);
  const boxTimeRef           = useRef(0);
  const fpsYaw               = useRef(0);
  const fpsPitch             = useRef(0);
  const bodyBobT             = useRef(0);
  const wasExteriorRef       = useRef(false);

  const carryingBox     = useGame((s) => s.carryingBox);
  const setExteriorView = useGame((s) => s.setExteriorView);
  const cameraMode      = useGame((s) => s.cameraMode);
  const prevCameraMode  = useRef<"focus" | "medium" | "top" | "fps">(cameraMode);

  // ── Chat → box appears ──────────────────────────────────────────────────────
  const chatIsOpen     = useChat((s) => s.isOpen);
  const chatWasOpenRef = useRef(false);
  useEffect(() => {
    if (!chatIsOpen && chatWasOpenRef.current) useGame.getState().setCarryingBox(true);
    chatWasOpenRef.current = chatIsOpen;
  }, [chatIsOpen]);

  // ── Face inward on spawn ────────────────────────────────────────────────────
  useEffect(() => {
    if (playerRef.current) playerRef.current.rotation.y = Math.PI;
  }, []);

  // ── Auto-enter ──────────────────────────────────────────────────────────────
  const pendingAutoEnter = useGame((s) => s.pendingAutoEnter);
  useEffect(() => {
    if (!pendingAutoEnter) return;
    useGame.getState().clearAutoEnter();
    autoEnterT.current = 0;
    if (playerRef.current) {
      playerRef.current.position.set(0, 0, ENTER_SPAWN_Z);
      playerRef.current.rotation.y = Math.PI;
    }
  }, [pendingAutoEnter]);

  // ── FPS mode: pointer-lock + cursor hide ──────────────────────────────────────
  useEffect(() => {
    const canvas = document.querySelector("canvas") as HTMLElement | null;
    if (cameraMode === "fps") {
      if (canvas) canvas.style.cursor = "none";
      canvas?.requestPointerLock?.();
    } else {
      if (canvas) canvas.style.cursor = "";
      if (document.pointerLockElement) document.exitPointerLock?.();
    }
  }, [cameraMode]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      fpsYaw.current   -= e.movementX * 0.002;
      fpsPitch.current  = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5,
        fpsPitch.current - e.movementY * 0.002));
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  // ── Ctrl = toggle الماوس في وضع FPS (ضغطة تُظهر، ضغطة تُخفي) ───────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== "Control") return;
      if (useGame.getState().cameraMode !== "fps") return;
      e.preventDefault();
      const canvas = document.querySelector("canvas") as HTMLElement | null;
      if (document.pointerLockElement) {
        document.exitPointerLock();
        if (canvas) canvas.style.cursor = "default";
      } else {
        if (canvas) { canvas.style.cursor = "none"; canvas.focus(); canvas.requestPointerLock?.(); }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const getNearestRobot = useCallback(() => {
    if (!playerRef.current) return null;
    const playerPos = playerRef.current.position;
    const models    = useGame.getState().models;
    let nearest: string | null = null;
    let minDist = Infinity;
    for (const model of models) {
      const pos  = getModelRobotPosition(model.index);
      const dist = playerPos.distanceTo(new THREE.Vector3(...pos));
      if (dist < INTERACT_DISTANCE && dist < minDist) {
        minDist = dist;
        nearest = model.id;
      }
    }
    return nearest;
  }, []);

  const getNearestHallWorker = useCallback(() => {
    if (!playerRef.current) return null;
    const playerPos   = playerRef.current.position;
    const hallWorkers = useGame.getState().hallWorkers;
    let nearest: string | null = null;
    let minDist = Infinity;
    for (const worker of hallWorkers) {
      const pos  = getHallWorkerPosition(worker.index);
      const dist = playerPos.distanceTo(new THREE.Vector3(...pos));
      if (dist < INTERACT_DISTANCE && dist < minDist) {
        minDist = dist;
        nearest = worker.id;
      }
    }
    return nearest;
  }, []);

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    // ── exterior detection ────────────────────────────────────────────────────
    const nowExterior = state.camera.position.z > 8.5;
    if (nowExterior !== wasExteriorRef.current) {
      wasExteriorRef.current = nowExterior;
      setExteriorView(nowExterior);
    }

    // ── auto-enter animation ──────────────────────────────────────────────────
    if (autoEnterT.current !== null) {
      autoEnterT.current += delta * 0.42;
      const t     = Math.min(autoEnterT.current, 1);
      const eased = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      const newZ  = THREE.MathUtils.lerp(ENTER_SPAWN_Z, ENTER_TARGET_Z, eased);
      playerRef.current.position.z = newZ;
      playerRef.current.rotation.y = Math.PI;
      const camZ = THREE.MathUtils.lerp(13, 7, eased);
      const camY = THREE.MathUtils.lerp(4,  5, eased);
      state.camera.position.set(0, camY, camZ);
      state.camera.lookAt(0, 1.2, newZ - 3);
      if (orbitRef.current) orbitRef.current.target.set(0, 1.2, newZ);
      if (t >= 1) {
        autoEnterT.current = null;
        if (orbitRef.current) orbitRef.current.update();
      }
      return;
    }

    const keys      = getKeys();
    const chatState = useChat.getState();
    const gameState = useGame.getState();

    // ── interact key ──────────────────────────────────────────────────────────
    if (keys.interact) {
      const now = Date.now();
      if (now - lastInteractTime.current > 500) {
        lastInteractTime.current = now;
        if (chatState.isOpen) {
          chatState.closeChat();
        } else if (gameState.vaultOpen) {
          gameState.closeVault();
          gameState.setCarryingBox(false);
        } else if (gameState.managerKeypadOpen) {
          gameState.closeManagerKeypad();
        } else {
          const pp = playerRef.current.position;
          if (!gameState.isGuest && pp.distanceTo(VAULT_POSITION) < VAULT_INTERACT_DISTANCE) {
            gameState.openVault();
            gameState.setCarryingBox(false);
          } else {
            const pp2 = playerRef.current.position;
            if (pp2.distanceTo(HUMAN_DEV_POSITION) < HUMAN_DEV_INTERACT_DIST) {
              if (gameState.humanOverlayOpen) gameState.closeHumanOverlay();
              else gameState.openHumanOverlay();
            } else {
              const nearRobot = getNearestRobot() ?? getNearestHallWorker();
              if (nearRobot) chatState.openChat(nearRobot);
              else if (gameState.carryingBox) gameState.setCarryingBox(false);
            }
          }
        }
      }
    }

    // ── manager door proximity ────────────────────────────────────────────────
    const playerPos      = playerRef.current.position;
    const distToDoor     = playerPos.distanceTo(MANAGER_DOOR_POSITION);
    const nearDoor       = distToDoor < MANAGER_DOOR_INTERACT_DISTANCE;
    const outsideManager = playerPos.x < MANAGER_ROOM_X_MIN;
    const nearDoorAndOut = nearDoor && outsideManager;
    const justApproachedDoor = nearDoorAndOut && !wasNearDoor.current;
    wasNearDoor.current      = nearDoorAndOut;
    if (justApproachedDoor && !chatState.isOpen && !gameState.vaultOpen && gameState.managerDoorLocked && !gameState.isGuest) {
      gameState.openManagerKeypad();
    }
    if (!nearDoorAndOut && gameState.managerKeypadOpen) gameState.closeManagerKeypad();

    // ── Stage0 door proximity ────────────────────────────────────────────────
    {
      const distS0     = playerPos.distanceTo(STAGE0_DOOR_POSITION);
      const nearS0     = distS0 < STAGE0_DOOR_INTERACT_DIST && playerPos.x > STAGE0_ROOM_X_MAX - PLAYER_RADIUS;
      const justNearS0 = nearS0 && !wasNearStage0Door.current;
      wasNearStage0Door.current = nearS0;
      if (justNearS0 && !chatState.isOpen && gameState.stage0DoorLocked && !gameState.isGuest) {
        gameState.openStage0Keypad();
      }
      if (!nearS0 && gameState.stage0KeypadOpen) gameState.closeStage0Keypad();
    }

    // ── Stage1 door proximity ────────────────────────────────────────────────
    {
      const distS1     = playerPos.distanceTo(STAGE1_DOOR_POSITION);
      const nearS1     = distS1 < STAGE1_DOOR_INTERACT_DIST && playerPos.x > STAGE1_ROOM_X_MAX - PLAYER_RADIUS;
      const justNearS1 = nearS1 && !wasNearStage1Door.current;
      wasNearStage1Door.current = nearS1;
      if (justNearS1 && !chatState.isOpen && gameState.stage1DoorLocked && !gameState.isGuest) {
        gameState.openStage1Keypad();
      }
      if (!nearS1 && gameState.stage1KeypadOpen) gameState.closeStage1Keypad();
    }

    // ── Hall Door 1 proximity (Stage1 ↔ Hall) ────────────────────────────────
    {
      const nearHD1 = playerPos.distanceTo(HALL_DOOR1_POSITION) < HALL_DOOR1_INTERACT_DIST;
      const justNearHD1 = nearHD1 && !wasNearHallDoor1.current;
      wasNearHallDoor1.current = nearHD1;
      if (justNearHD1 && !chatState.isOpen && gameState.hallDoorLocked && !gameState.isGuest) {
        gameState.openHallKeypad();
      }
      if (!nearHD1 && gameState.hallDoorKeypadOpen) gameState.closeHallKeypad();
    }

    // ── Hall Door 2 proximity (Manager ↔ Hall) ────────────────────────────────
    {
      const nearHD2 = playerPos.distanceTo(new THREE.Vector3(HALL_DOOR2_X, 0, HALL_Z_FRONT)) < HALL_DOOR1_INTERACT_DIST;
      const justNearHD2 = nearHD2 && !wasNearHallDoor2.current;
      wasNearHallDoor2.current = nearHD2;
      if (justNearHD2 && !chatState.isOpen && gameState.hall2DoorLocked && !gameState.isGuest) {
        gameState.openHall2Keypad();
      }
      if (!nearHD2 && gameState.hall2DoorKeypadOpen) gameState.closeHall2Keypad();
    }

    // ── Back Room door A proximity ───────────────────────────────────────────
    {
      const nearBrA = playerPos.distanceTo(BR_DOOR_A_POSITION) < BR_DOOR_INTERACT_DIST;
      const justNearBrA = nearBrA && !wasNearBrADoor.current;
      wasNearBrADoor.current = nearBrA;
      if (justNearBrA && !chatState.isOpen && gameState.brADoorLocked && !gameState.isGuest) {
        gameState.openBrAKeypad();
      }
      if (!nearBrA && gameState.brAKeypadOpen) gameState.closeBrAKeypad();
    }

    // ── Back Room door B proximity ───────────────────────────────────────────
    {
      const nearBrB = playerPos.distanceTo(BR_DOOR_B_POSITION) < BR_DOOR_INTERACT_DIST;
      const justNearBrB = nearBrB && !wasNearBrBDoor.current;
      wasNearBrBDoor.current = nearBrB;
      if (justNearBrB && !chatState.isOpen && gameState.brBDoorLocked && !gameState.isGuest) {
        gameState.openBrBKeypad();
      }
      if (!nearBrB && gameState.brBKeypadOpen) gameState.closeBrBKeypad();
    }

    // ── Back Room door C proximity ───────────────────────────────────────────
    {
      const nearBrC = playerPos.distanceTo(BR_DOOR_C_POSITION) < BR_DOOR_INTERACT_DIST;
      const justNearBrC = nearBrC && !wasNearBrCDoor.current;
      wasNearBrCDoor.current = nearBrC;
      if (justNearBrC && !chatState.isOpen && gameState.brCDoorLocked && !gameState.isGuest) {
        gameState.openBrCKeypad();
      }
      if (!nearBrC && gameState.brCKeypadOpen) gameState.closeBrCKeypad();
    }

    // ── video screen proximity ────────────────────────────────────────────────
    const nearScreen = playerPos.distanceTo(VIDEO_SCREEN_POSITION) < VIDEO_SCREEN_INTERACT_DISTANCE
      && playerPos.x < MANAGER_ROOM_X_MIN;
    const videoOpen = gameState.videoScreenOpen;
    if (!nearScreen) {
      videoManuallyClosed.current = false;
      if (videoOpen) gameState.closeVideoScreen();
    } else {
      if (wasVideoOpen.current && !videoOpen) videoManuallyClosed.current = true;
      if (!videoOpen && !videoManuallyClosed.current) gameState.openVideoScreen();
    }
    wasVideoOpen.current  = videoOpen;
    wasNearScreen.current = nearScreen;

    // ── hologram proximity ────────────────────────────────────────────────────
    const nearHologram = playerPos.distanceTo(HOLOGRAM_POSITION) < HOLOGRAM_INTERACT_DISTANCE;
    const hologramOpen = gameState.hologramOpen;
    if (!nearHologram) {
      hologramManuallyClosed.current = false;
      if (hologramOpen) gameState.closeHologram();
    } else {
      if (wasHologramOpen.current && !hologramOpen) hologramManuallyClosed.current = true;
      if (!hologramOpen && !hologramManuallyClosed.current) gameState.openHologram();
    }
    wasHologramOpen.current  = hologramOpen;
    wasNearHologram.current  = nearHologram;

    // ── manager room enter / exit ─────────────────────────────────────────────
    const playerInManager = playerPos.x >= MANAGER_ROOM_X_MIN && playerPos.z >= HALL_Z_FRONT;
    const justEntered     = playerInManager && !wasInManager.current;
    const justLeft        = !playerInManager && wasInManager.current;
    wasInManager.current  = playerInManager;
    if (justLeft) { (gameState as any).lockManagerDoor?.(); useGame.getState().lockHall2Door(); }
    if (justEntered && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(Math.max(playerPos.x - 3, 9.5), playerPos.y + 5, playerPos.z);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    } else if (justLeft && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 4, playerPos.z + 4);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    }

    // ── stage1 enter / exit ───────────────────────────────────────────────────
    const playerInStage1    = playerPos.x <= STAGE1_ROOM_X_MAX && playerPos.z >= HALL_Z_FRONT;
    const justEnteredStage1 = playerInStage1 && !wasInStage1.current;
    const justLeftStage1    = !playerInStage1 && wasInStage1.current;
    wasInStage1.current     = playerInStage1;
    if (justLeftStage1 && playerPos.z < HALL_Z_FRONT) useGame.getState().lockHallDoor();
    if (justLeftStage1 && playerPos.z >= HALL_Z_FRONT) useGame.getState().lockStage1Door();
    if (justEnteredStage1 && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(Math.min(playerPos.x + 4, -17.5), playerPos.y + 5, playerPos.z);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    } else if (justLeftStage1 && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 4, playerPos.z);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    }

    // ── stage0 enter / exit ───────────────────────────────────────────────────
    const playerInStage0    = playerPos.x <= STAGE0_ROOM_X_MAX && playerPos.z >= HALL_Z_FRONT;
    const justEnteredStage0 = playerInStage0 && !wasInStage0.current;
    const justLeftStage0    = !playerInStage0 && wasInStage0.current;
    wasInStage0.current     = playerInStage0;
    if (justLeftStage0 && playerPos.x > STAGE0_ROOM_X_MAX) useGame.getState().lockStage0Door();
    if (justEnteredStage0 && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(Math.min(playerPos.x + 4, -9.5), playerPos.y + 5, playerPos.z);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    } else if (justLeftStage0 && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 4, playerPos.z + 4);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    }

    // ── back rooms enter / exit ────────────────────────────────────────────────
    const playerInBackRoomA  = playerPos.z < BR_Z_MAX && playerPos.x >= BR_A_X_MIN && playerPos.x <= BR_A_X_MAX;
    const playerInBackRoomB  = playerPos.z < BR_Z_MAX && playerPos.x >= BR_B_X_MIN && playerPos.x <= BR_B_X_MAX;
    const playerInBackRoomC  = playerPos.z < BR_Z_MAX && playerPos.x >= BR_C_X_MIN && playerPos.x <= BR_C_X_MAX;
    const playerInBackRoom   = playerInBackRoomA || playerInBackRoomB || playerInBackRoomC;
    const justEnteredBackRoom  = playerInBackRoom && !wasInBackRoom.current;
    const justLeftBackRoomA    = !playerInBackRoomA && wasInBackRoomA.current;
    const justLeftBackRoomB    = !playerInBackRoomB && wasInBackRoomB.current;
    const justLeftBackRoomC    = !playerInBackRoomC && wasInBackRoomC.current;
    wasInBackRoom.current    = playerInBackRoom;
    wasInBackRoomA.current   = playerInBackRoomA;
    wasInBackRoomB.current   = playerInBackRoomB;
    wasInBackRoomC.current   = playerInBackRoomC;
    if (justLeftBackRoomA) useGame.getState().lockBrADoor()
    if (justLeftBackRoomB) useGame.getState().lockBrBDoor()
    if (justLeftBackRoomC) useGame.getState().lockBrCDoor()
    if (justEnteredBackRoom && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 5, playerPos.z + 4);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
      orbitRef.current.update();
    }

    // ── production hall enter / exit ──────────────────────────────────────────
    const playerInHall    = playerPos.z < HALL_Z_FRONT && !playerInBackRoom;
    const justEnteredHall = playerInHall && !wasInHall.current;
    const justLeftHall    = !playerInHall && wasInHall.current;
    wasInHall.current     = playerInHall;
    if (justLeftHall) {
      if (playerInStage1) useGame.getState().lockHallDoor();
      if (playerInManager) useGame.getState().lockHall2Door();
    }
    if (justEnteredHall && orbitRef.current && cameraMode !== "top") {
      state.camera.position.set(playerPos.x, playerPos.y + 6, playerPos.z + 3);
      orbitRef.current.target.set(playerPos.x, playerPos.y + 1, playerPos.z);
      orbitRef.current.update();
    }

    // ── Camera mode switch ────────────────────────────────────────────────────
    if (prevCameraMode.current !== cameraMode && orbitRef.current) {
      prevCameraMode.current = cameraMode;
      const pp = playerRef.current.position;
      if (cameraMode === "top") {
        // منظور علوي ثابت يغطي الشركة كاملة
        state.camera.position.set(-4, 60, -10.5);
        orbitRef.current.target.set(-4, 0, -10.5);
      } else {
        // focus / medium — room-aware close follow
        const isFocus = cameraMode === "focus";
        const offY    = isFocus ? 5 : 8;
        let cx: number, cy: number, cz: number;
        if (playerInHall) {
          cx = pp.x; cy = pp.y + offY; cz = pp.z + (isFocus ? 3 : 5);
        } else if (playerInManager) {
          cx = Math.max(pp.x - (isFocus ? 3 : 5), 9.5); cy = pp.y + offY; cz = pp.z;
        } else if (playerInStage1) {
          cx = Math.min(pp.x + (isFocus ? 4 : 6), -17.5); cy = pp.y + offY; cz = pp.z;
        } else if (playerInStage0) {
          cx = Math.min(pp.x + (isFocus ? 4 : 6), -9.5); cy = pp.y + offY; cz = pp.z;
        } else {
          cx = pp.x; cy = pp.y + offY; cz = pp.z + (isFocus ? 4 : 7);
        }
        state.camera.position.set(cx, cy, cz);
        orbitRef.current.target.set(pp.x, pp.y + 1, pp.z);
      }
      orbitRef.current.update();
    }

    // ── movement ──────────────────────────────────────────────────────────────
    let isMoving = false;
    if (!chatState.isOpen && !gameState.vaultOpen && !gameState.managerKeypadOpen && !gameState.stage0KeypadOpen && !gameState.stage1KeypadOpen && !gameState.hallDoorKeypadOpen && !gameState.hall2DoorKeypadOpen && !gameState.brAKeypadOpen && !gameState.brBKeypadOpen && !gameState.brCKeypadOpen && gameState.phase === "playing") {
      const direction = dirVec.current;
      direction.set(0, 0, 0);
      if (cameraMode === "fps") {
        // حركة نسبية لاتجاه الكاميرا (FPS style)
        const yaw = fpsYaw.current;
        if (keys.forward) { direction.x -= Math.sin(yaw); direction.z -= Math.cos(yaw); }
        if (keys.back)    { direction.x += Math.sin(yaw); direction.z += Math.cos(yaw); }
        if (keys.left)    { direction.x -= Math.cos(yaw); direction.z += Math.sin(yaw); }
        if (keys.right)   { direction.x += Math.cos(yaw); direction.z -= Math.sin(yaw); }
      } else {
        if (keys.forward) direction.z -= 1;
        if (keys.back)    direction.z += 1;
        if (keys.left)    direction.x -= 1;
        if (keys.right)   direction.x += 1;
      }

      if (direction.length() > 0) {
        isMoving = true;
        direction.normalize().multiplyScalar(SPEED * delta);
        const newX = playerRef.current.position.x + direction.x;
        const newZ = playerRef.current.position.z + direction.z;

        const currentZ        = playerRef.current.position.z;
        const isOutside       = currentZ > ROOM_BOUNDS_Z_MAX;
        const managerLocked   = gameState.managerDoorLocked;
        const stage0Locked    = gameState.stage0DoorLocked;
        const stage1Locked    = gameState.stage1DoorLocked;
        const isInDoorwayZ    = newZ >= DOOR_Z_MIN && newZ <= DOOR_Z_MAX;
        const isInManagerX    = !isOutside && (newX >= MANAGER_ROOM_X_MIN - PLAYER_RADIUS);
        const canEnterManager = !managerLocked && isInDoorwayZ;
        const canEnterStage0  = !stage0Locked && newZ >= STAGE0_ROOM_Z_MIN && newZ <= STAGE0_ROOM_Z_MAX;
        const canEnterStage1  = !stage1Locked && newZ >= STAGE1_ROOM_Z_MIN && newZ <= STAGE1_ROOM_Z_MAX;

        let clampedX = newX;
        let clampedZ = newZ;

        if (playerInBackRoom) {
          // ── داخل الغرف الخلفية ─────────────────────────────────────────────
          const nearBRDoorA = Math.abs(playerPos.x - BR_DOOR_A_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorB = Math.abs(playerPos.x - BR_DOOR_B_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorC = Math.abs(playerPos.x - BR_DOOR_C_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearAnyBRDoor = nearBRDoorA || nearBRDoorB || nearBRDoorC;
          if (newZ > BR_Z_MAX - PLAYER_RADIUS && nearAnyBRDoor) {
            clampedZ = newZ; // الخروج للقاعة
          } else {
            clampedZ = THREE.MathUtils.clamp(newZ, BR_Z_MIN + PLAYER_RADIUS, BR_Z_MAX - PLAYER_RADIUS);
          }
          if (playerInBackRoomA) {
            clampedX = THREE.MathUtils.clamp(newX, BR_A_X_MIN + PLAYER_RADIUS, BR_A_X_MAX - PLAYER_RADIUS);
          } else if (playerInBackRoomB) {
            clampedX = THREE.MathUtils.clamp(newX, BR_B_X_MIN + PLAYER_RADIUS, BR_B_X_MAX - PLAYER_RADIUS);
          } else if (playerInBackRoomC) {
            clampedX = THREE.MathUtils.clamp(newX, BR_C_X_MIN + PLAYER_RADIUS, BR_C_X_MAX - PLAYER_RADIUS);
          }
        } else if (playerInHall) {
          clampedX = THREE.MathUtils.clamp(newX, HALL_X_MIN + PLAYER_RADIUS, HALL_X_MAX - PLAYER_RADIUS);
          const nearD1 = Math.abs(playerPos.x - HALL_DOOR1_X) <= HALL_DOOR_HW + PLAYER_RADIUS;
          const nearD2 = Math.abs(playerPos.x - HALL_DOOR2_X) <= HALL_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorA = Math.abs(playerPos.x - BR_DOOR_A_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorB = Math.abs(playerPos.x - BR_DOOR_B_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearBRDoorC = Math.abs(playerPos.x - BR_DOOR_C_X) <= BR_DOOR_HW + PLAYER_RADIUS;
          const nearAnyBRDoorUnlocked = (nearBRDoorA && !gameState.brADoorLocked)
            || (nearBRDoorB && !gameState.brBDoorLocked)
            || (nearBRDoorC && !gameState.brCDoorLocked);
          if (newZ > HALL_Z_FRONT - PLAYER_RADIUS && ((nearD1 && !gameState.hallDoorLocked) || (nearD2 && !gameState.hall2DoorLocked))) {
            clampedZ = newZ;
          } else if (newZ < HALL_Z_MIN + PLAYER_RADIUS && nearAnyBRDoorUnlocked) {
            clampedZ = newZ; // دخول للغرف الخلفية
          } else {
            clampedZ = THREE.MathUtils.clamp(newZ, HALL_Z_MIN + PLAYER_RADIUS, HALL_Z_FRONT - PLAYER_RADIUS);
          }
        } else if (isInManagerX) {
          if (managerLocked) {
            clampedX = Math.min(newX, ROOM_BOUNDS_X - PLAYER_RADIUS);
            clampedZ = THREE.MathUtils.clamp(newZ, ROOM_BOUNDS_Z_MIN + PLAYER_RADIUS, ROOM_BOUNDS_Z_MAX - PLAYER_RADIUS);
          } else {
            clampedX = THREE.MathUtils.clamp(newX, MANAGER_ROOM_X_MIN - PLAYER_RADIUS, MANAGER_ROOM_X_MAX - PLAYER_RADIUS);
            const atHallDoor2 = Math.abs(clampedX - HALL_DOOR2_X) <= HALL_DOOR_HW && !gameState.hall2DoorLocked;
            if (atHallDoor2) {
              clampedZ = THREE.MathUtils.clamp(newZ, HALL_Z_MIN + PLAYER_RADIUS, MANAGER_ROOM_Z_MAX - PLAYER_RADIUS);
            } else {
              clampedZ = THREE.MathUtils.clamp(newZ, MANAGER_ROOM_Z_MIN + PLAYER_RADIUS, MANAGER_ROOM_Z_MAX - PLAYER_RADIUS);
            }
          }
        } else if (playerInStage1 || (playerInStage0 && canEnterStage1 && newX <= STAGE1_ROOM_X_MAX + PLAYER_RADIUS)) {
          clampedX = THREE.MathUtils.clamp(newX, STAGE1_ROOM_X_MIN + PLAYER_RADIUS, STAGE1_ROOM_X_MAX + PLAYER_RADIUS);
          const atHallDoor1 = Math.abs(clampedX - HALL_DOOR1_X) <= HALL_DOOR_HW && !gameState.hallDoorLocked;
          if (atHallDoor1) {
            clampedZ = THREE.MathUtils.clamp(newZ, HALL_Z_MIN + PLAYER_RADIUS, STAGE1_ROOM_Z_MAX - PLAYER_RADIUS);
          } else {
            clampedZ = THREE.MathUtils.clamp(newZ, STAGE1_ROOM_Z_MIN + PLAYER_RADIUS, STAGE1_ROOM_Z_MAX - PLAYER_RADIUS);
          }
        } else if (playerInStage0 || (canEnterStage0 && newX <= STAGE0_ROOM_X_MAX + PLAYER_RADIUS)) {
          const minX = canEnterStage1 ? STAGE1_ROOM_X_MAX : STAGE0_ROOM_X_MIN + PLAYER_RADIUS;
          clampedX = THREE.MathUtils.clamp(newX, minX, STAGE0_ROOM_X_MAX + PLAYER_RADIUS);
          clampedZ = THREE.MathUtils.clamp(newZ, STAGE0_ROOM_Z_MIN + PLAYER_RADIUS, STAGE0_ROOM_Z_MAX - PLAYER_RADIUS);
        } else if (isOutside) {
          clampedX = THREE.MathUtils.clamp(newX, -ROOM_BOUNDS_X + PLAYER_RADIUS, ROOM_BOUNDS_X - PLAYER_RADIUS);
          clampedZ = newZ <= currentZ ? newZ : currentZ;
        } else {
          const maxX = canEnterManager ? MANAGER_ROOM_X_MAX - PLAYER_RADIUS : ROOM_BOUNDS_X - PLAYER_RADIUS;
          const minX = canEnterStage0 ? STAGE0_ROOM_X_MAX : -ROOM_BOUNDS_X + PLAYER_RADIUS;
          clampedX   = THREE.MathUtils.clamp(newX, minX, maxX);
          clampedZ   = THREE.MathUtils.clamp(newZ, ROOM_BOUNDS_Z_MIN + PLAYER_RADIUS, ROOM_BOUNDS_Z_MAX - PLAYER_RADIUS);
        }

        const curX = playerRef.current.position.x;
        const curZ = playerRef.current.position.z;
        if (!isInManagerX && !playerInStage0 && !isOutside) {
          if (isBlocked(clampedX, clampedZ, PLAYER_RADIUS)) {
            if (!isBlocked(clampedX, curZ, PLAYER_RADIUS))      clampedZ = curZ;
            else if (!isBlocked(curX, clampedZ, PLAYER_RADIUS)) clampedX = curX;
            else { clampedX = curX; clampedZ = curZ; }
          }
        }

        playerRef.current.position.x = clampedX;
        playerRef.current.position.z = clampedZ;
        playerRef.current.rotation.y = Math.atan2(direction.x, direction.z);
      }
    }

    // ── glass box float ───────────────────────────────────────────────────────
    if (boxRef.current && carryingBox) {
      boxTimeRef.current += delta;
      boxRef.current.position.y = 1.6 + Math.sin(boxTimeRef.current * 2.5) * 0.06;
      boxRef.current.rotation.y += delta * 0.9;
    }

    // ── body bob (walk) / breathe (idle) ──────────────────────────────────────
    bodyBobT.current += delta;
    if (liteBodyRef.current) {
      if (isMoving) {
        liteBodyRef.current.position.y = 0.65 + Math.sin(bodyBobT.current * 9) * 0.02;
      } else {
        liteBodyRef.current.position.y = 0.65 + Math.sin(bodyBobT.current * 1.6) * 0.006;
      }
    }

    // ── camera follow ─────────────────────────────────────────────────────────
    if (cameraMode === "fps") {
      // ── منظور الشخص الأول ──────────────────────────────────────────────────
      if (orbitRef.current) orbitRef.current.enabled = false;
      const pp = playerRef.current.position;
      state.camera.position.set(pp.x, pp.y + 2.4, pp.z);
      state.camera.rotation.order = "YXZ";
      state.camera.rotation.y = fpsYaw.current;
      state.camera.rotation.x = fpsPitch.current;
      state.camera.rotation.z = 0;
      // الجسم يدور دائماً مع اتجاه النظر
      playerRef.current.rotation.y = fpsYaw.current;
    } else if (orbitRef.current) {
      orbitRef.current.enabled = true;
      const pp = playerRef.current.position;
      camTargetVec.current.set(pp.x, pp.y + 1.5, pp.z);
      orbitRef.current.target.lerp(camTargetVec.current, 0.15);
      orbitRef.current.update();
      if (cameraMode !== "top") {
        const isFocus = cameraMode === "focus";
        const offY    = isFocus ? 4 : 7;
        let tx: number, ty: number, tz: number;
        if (playerInManager) {
          tx = Math.max(pp.x - (isFocus ? 3 : 5), 9.2);
          ty = pp.y + offY;
          tz = Math.max(pp.z - 1, MANAGER_ROOM_Z_MIN + 0.8);
        } else if (playerInStage1) {
          tx = Math.min(pp.x + (isFocus ? 4 : 6), -17.2);
          ty = pp.y + offY;
          tz = Math.max(pp.z - 1, STAGE1_ROOM_Z_MIN + 0.8);
        } else if (playerInStage0) {
          tx = Math.min(pp.x + (isFocus ? 4 : 6), -9.2);
          ty = pp.y + offY;
          tz = Math.max(pp.z - 1, STAGE0_ROOM_Z_MIN + 0.8);
        } else if (playerInHall) {
          tx = pp.x; ty = pp.y + offY; tz = Math.min(pp.z + (isFocus ? 3 : 5), -7.5);
        } else {
          tx = pp.x; ty = pp.y + offY; tz = Math.min(pp.z + (isFocus ? 4 : 7), 6.5);
        }
        const lf = 0.08;
        state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, tx, lf);
        state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, ty, lf);
        state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, tz, lf);
        // hard clamp — camera must stay inside current room walls
        if (playerInManager) {
          state.camera.position.x = Math.max(9.0, Math.min(14.5, state.camera.position.x));
          state.camera.position.z = Math.max(MANAGER_ROOM_Z_MIN + 0.5, Math.min(MANAGER_ROOM_Z_MAX - 0.5, state.camera.position.z));
        } else if (playerInStage1) {
          state.camera.position.x = Math.max(STAGE1_ROOM_X_MIN + 0.5, Math.min(-16.5, state.camera.position.x));
          state.camera.position.z = Math.max(STAGE1_ROOM_Z_MIN + 0.5, Math.min(STAGE1_ROOM_Z_MAX - 0.5, state.camera.position.z));
        } else if (playerInStage0) {
          state.camera.position.x = Math.max(STAGE0_ROOM_X_MIN + 0.5, Math.min(-8.5, state.camera.position.x));
          state.camera.position.z = Math.max(STAGE0_ROOM_Z_MIN + 0.5, Math.min(STAGE0_ROOM_Z_MAX - 0.5, state.camera.position.z));
        } else if (playerInHall) {
          state.camera.position.z = Math.max(HALL_Z_MIN + 0.5, Math.min(HALL_Z_FRONT - 0.5, state.camera.position.z));
        } else {
          state.camera.position.z = Math.min(state.camera.position.z, 6.5);
        }
        state.camera.lookAt(orbitRef.current.target);
      }
    }
  });

  const C = "#a855f7"; // purple accent

  return (
    <>
      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={70}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 1, 2]}
      />

      <group ref={playerRef} position={[0, 0, 8.5]}>
        {/* ── Standing robot body ─────────────────────────────────────────── */}
        <group scale={1.44}>
          {/* Legs */}
          <mesh position={[-0.09, 0.22, 0]} castShadow>
            <boxGeometry args={[0.11, 0.44, 0.11]} />
            <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />
          </mesh>
          <mesh position={[0.09, 0.22, 0]} castShadow>
            <boxGeometry args={[0.11, 0.44, 0.11]} />
            <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />
          </mesh>
          {/* Feet */}
          <mesh position={[-0.09, 0.02, 0.04]} castShadow>
            <boxGeometry args={[0.14, 0.04, 0.18]} />
            <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.6} />
          </mesh>
          <mesh position={[0.09, 0.02, 0.04]} castShadow>
            <boxGeometry args={[0.14, 0.04, 0.18]} />
            <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.6} />
          </mesh>

          {/* Body group — bobs when walking / breathes at idle */}
          <group ref={liteBodyRef} position={[0, 0.65, 0]}>
            {/* Waist */}
            <mesh position={[0, 0.30, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.18, 0.18, 12]} />
              <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.6} />
            </mesh>
            {/* Torso */}
            <mesh position={[0, 0.52, 0]} castShadow>
              <boxGeometry args={[0.42, 0.38, 0.28]} />
              <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />
            </mesh>
            {/* Chest plate */}
            <mesh position={[0, 0.54, 0.142]}>
              <boxGeometry args={[0.32, 0.26, 0.008]} />
              <meshStandardMaterial color="#3a3a4a" roughness={0.2} metalness={0.8} />
            </mesh>
            {/* Accent stripes */}
            <mesh position={[0, 0.62, 0.15]}>
              <boxGeometry args={[0.28, 0.018, 0.006]} />
              <meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.5} roughness={0.1} metalness={0.3} />
            </mesh>
            <mesh position={[-0.21, 0.52, 0]}>
              <boxGeometry args={[0.008, 0.3, 0.24]} />
              <meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.45} roughness={0.1} metalness={0.3} />
            </mesh>
            <mesh position={[0.21, 0.52, 0]}>
              <boxGeometry args={[0.008, 0.3, 0.24]} />
              <meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.45} roughness={0.1} metalness={0.3} />
            </mesh>
            {/* Arms */}
            <mesh position={[-0.33, 0.52, 0]} castShadow>
              <boxGeometry args={[0.10, 0.34, 0.10]} />
              <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />
            </mesh>
            <mesh position={[0.33, 0.52, 0]} castShadow>
              <boxGeometry args={[0.10, 0.34, 0.10]} />
              <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />
            </mesh>
            {/* Neck */}
            <mesh position={[0, 0.78, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.10, 0.14, 10]} />
              <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.6} />
            </mesh>
            {/* Head */}
            <group position={[0, 0.98, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.32, 0.28, 0.28]} />
                <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />
              </mesh>
              {/* Face screen */}
              <mesh position={[0, 0.01, 0.142]}>
                <planeGeometry args={[0.24, 0.18]} />
                <meshStandardMaterial color="#040d18" emissive="#0a1628" emissiveIntensity={0.9} roughness={0.05} />
              </mesh>
              {/* Eyes */}
              <mesh position={[-0.07, 0.03, 0.145]}>
                <planeGeometry args={[0.065, 0.055]} />
                <meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.7} roughness={0.05} />
              </mesh>
              <mesh position={[0.07, 0.03, 0.145]}>
                <planeGeometry args={[0.065, 0.055]} />
                <meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.7} roughness={0.05} />
              </mesh>
              {/* Mouth */}
              <mesh position={[0, -0.065, 0.143]}>
                <planeGeometry args={[0.10, 0.012]} />
                <meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.5} />
              </mesh>
              {/* Accent side panels */}
              <mesh position={[-0.162, 0, 0]}>
                <boxGeometry args={[0.008, 0.22, 0.24]} />
                <meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.45} roughness={0.1} metalness={0.3} />
              </mesh>
              <mesh position={[0.162, 0, 0]}>
                <boxGeometry args={[0.008, 0.22, 0.24]} />
                <meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.45} roughness={0.1} metalness={0.3} />
              </mesh>
              {/* Antenna */}
              <mesh position={[0, 0.20, 0]} castShadow>
                <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
                <meshStandardMaterial color="#aaaaaa" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[0, 0.31, 0]}>
                <sphereGeometry args={[0.022, 8, 8]} />
                <meshStandardMaterial color={C} emissive={C} emissiveIntensity={1} />
              </mesh>
              <pointLight position={[0, 0, 0.4]} intensity={0.6} color={C} distance={1.4} decay={2} />
            </group>
          </group>
        </group>

        {/* ── Glass box carried by avatar ──────────────────────────────────── */}
        {carryingBox && (
          <group ref={boxRef} position={[0, 2.1, 0.5]}>
            <mesh>
              <boxGeometry args={[0.33, 0.33, 0.33]} />
              <meshStandardMaterial
                color="#99ddff"
                transparent
                opacity={0.45}
                roughness={0.05}
                metalness={0.3}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
              <Edges color="#c4a44a" lineWidth={2} />
            </mesh>
            <Text position={[0, 0, 0.168]}  rotation={[0, 0, 0]}          fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            <Text position={[0, 0, -0.168]} rotation={[0, Math.PI, 0]}    fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            <Text position={[0.168, 0, 0]}  rotation={[0, Math.PI/2, 0]}  fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            <Text position={[-0.168, 0, 0]} rotation={[0, -Math.PI/2, 0]} fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            <Text position={[0, 0.168, 0]}  rotation={[-Math.PI/2, 0, 0]} fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            <Text position={[0, -0.168, 0]} rotation={[Math.PI/2, 0, 0]}  fontSize={0.11} color="#c4a44a" anchorX="center" anchorY="middle">S0</Text>
            <pointLight color="#88ccff" intensity={0.8} distance={1.5} decay={2} />
          </group>
        )}
      </group>
    </>
  );
}

// ── Wrapper: chooses GlbPlayerInner or LitePlayerInner ───────────────────────
export function Player() {
  const selectedAvatar = useGame((s) => s.selectedAvatar);
  if (selectedAvatar === "lite") return <LitePlayerInner />;
  return <GlbPlayerInner />;
}
