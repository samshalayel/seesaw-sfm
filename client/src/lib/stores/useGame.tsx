import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { setRoomId, apiFetch, clearAuthToken } from "../utils";

export type GamePhase = "locked" | "avatar_select" | "ready" | "playing" | "ended" | "admin";

export interface UserInfo {
  id: string;
  username: string;
  roomId: string;
  role?: string;
}

export type RoomAssignment = "main" | "stage0" | "stage1" | "manager" | "brA" | "brB" | "brC";

export interface HumanMemberInfo {
  id:             string;
  name:           string;
  role:           string;
  joinCode:       string;
  roomAssignment: string;
}

// ── مواضع مكاتب الموظفين البشريين — الجانب الأيمن من الصالة ──────────────────
interface HumanSlot {
  human:     [number, number, number];
  humanRot:  [number, number, number];
  desk:      [number, number, number];
  deskRot:   [number, number, number];
}
const HUMAN_SLOTS: HumanSlot[] = [
  // يواجهون الغرفة (نحو -X) من الحائط الأيمن
  { human: [6.5, 0,  0.5], humanRot: [0, -Math.PI / 2, 0], desk: [5.2, 0,  0.5], deskRot: [0,  Math.PI / 2, 0] },
  { human: [6.5, 0,  3.0], humanRot: [0, -Math.PI / 2, 0], desk: [5.2, 0,  3.0], deskRot: [0,  Math.PI / 2, 0] },
  { human: [6.5, 0,  5.5], humanRot: [0, -Math.PI / 2, 0], desk: [5.2, 0,  5.5], deskRot: [0,  Math.PI / 2, 0] },
  { human: [6.5, 0, -5.5], humanRot: [0, -Math.PI / 2, 0], desk: [5.2, 0, -5.5], deskRot: [0,  Math.PI / 2, 0] },
  { human: [6.5, 0,  6.8], humanRot: [0, -Math.PI / 2, 0], desk: [5.2, 0,  6.8], deskRot: [0,  Math.PI / 2, 0] },
  { human: [6.5, 0, -6.5], humanRot: [0, -Math.PI / 2, 0], desk: [5.2, 0, -6.5], deskRot: [0,  Math.PI / 2, 0] },
];
export function getHumanSlot(index: number): HumanSlot {
  return HUMAN_SLOTS[index % HUMAN_SLOTS.length];
}

export interface ModelInfo {
  id: string;
  name: string;
  alias?: string;
  index: number;
  modelId?: string;
  roomAssignment: RoomAssignment;
  systemPrompt?: string;
}

const ROBOT_COLORS = [
  "#4fc3f7", "#66bb6a", "#ff7043", "#ab47bc", "#ffa726",
  "#26c6da", "#ef5350", "#8d6e63", "#78909c", "#d4e157",
];

const DESK_START_Z = -1;
const DESK_SPACING = 3;
const ROOM_Z_MAX = 6.5;

export function getModelDeskPosition(index: number): [number, number, number] {
  const z = Math.min(DESK_START_Z + index * DESK_SPACING, ROOM_Z_MAX);
  return [-5.5, 0, z];
}

export function getModelRobotPosition(index: number): [number, number, number] {
  const z = Math.min(DESK_START_Z + index * DESK_SPACING, ROOM_Z_MAX);
  return [-6.8, 0, z];
}

export function getMaxModels(): number {
  return 7; // واحد لكل غرفة كحد أقصى
}

export function getModelColor(index: number): string {
  return ROBOT_COLORS[index % ROBOT_COLORS.length];
}

// ── Meeting layout — حساب أبعاد الطاولة ومواقع المقاعد حسب عدد الروبوتات ────
// الطاولة ثابتة عند [0, 0, 1.5] في إحداثيات الغرفة
const MT_CENTER: [number, number, number] = [0, 0, 1.5];
const MT_SEAT_Z_OFFSET = 1.4;   // مسافة الكرسي من مركز الطاولة (Z)
const MT_SPACING       = 1.1;   // المسافة بين الكراسي (X)
const MT_W_PADDING     = 0.5;   // هامش جانبي للطاولة

export interface MeetingLayout {
  tableW:    number;                                     // عرض الطاولة
  legX:      number;                                     // موضع الأرجل (±)
  seats:     [number, number, number][];                 // مواقع الروبوتات (coords الغرفة)
  rotations: [number, number, number][];                 // دوران كل روبوت
  relChairs: { pos: [number,number,number]; rot: [number,number,number] }[]; // للرسم في Room.tsx
}

export function getMeetingLayout(robotCount: number): MeetingLayout {
  const total  = Math.max(4, Math.min(12, robotCount));
  const frontN = Math.ceil(total  / 2);
  const backN  = Math.floor(total / 2);
  const perSide = Math.max(frontN, backN);  // أطول صف يحدد عرض الطاولة

  const tableW = perSide * MT_SPACING + MT_W_PADDING * 2;
  const halfW  = (perSide - 1) * MT_SPACING / 2;
  const legX   = tableW / 2 - 0.35;

  const seats:     [number, number, number][] = [];
  const rotations: [number, number, number][] = [];
  const relChairs: { pos: [number,number,number]; rot: [number,number,number] }[] = [];

  // الصف الأمامي — يواجه +Z (نحو مركز الطاولة)
  for (let i = 0; i < frontN; i++) {
    const x = -halfW + i * MT_SPACING;
    seats.push([MT_CENTER[0] + x, 0, MT_CENTER[2] - MT_SEAT_Z_OFFSET]);
    rotations.push([0, 0, 0]);
    relChairs.push({ pos: [x, 0, -MT_SEAT_Z_OFFSET], rot: [0, 0, 0] });
  }
  // الصف الخلفي — يواجه -Z (نحو مركز الطاولة)
  for (let i = 0; i < backN; i++) {
    const x = -halfW + i * MT_SPACING;
    seats.push([MT_CENTER[0] + x, 0, MT_CENTER[2] + MT_SEAT_Z_OFFSET]);
    rotations.push([0, Math.PI, 0]);
    relChairs.push({ pos: [x, 0,  MT_SEAT_Z_OFFSET], rot: [0, Math.PI, 0] });
  }

  return { tableW, legX, seats, rotations, relChairs };
}

// ── Hall Worker slots (inside ProductionHall, 2 rows) ─────────────────────────
// Hall: X ∈ [-24, 16], Z ∈ [-19, -7]
// الصف الأول (Z=-10) قريب من الغرف — وجه الروبوت نحو الجدار الخلفي (-Z)
// الصف الثاني (Z=-15) قريب من الجدار الخلفي — وجه الروبوت نحو المدخل (+Z)
interface HallSlot {
  robot:         [number, number, number];
  desk:          [number, number, number];
  robotRotation: [number, number, number];
  deskRotation:  [number, number, number];
}

const HALL_WORKER_SLOTS: HallSlot[] = [
  // 1 — يسار، صف أول
  { robot: [-20, 0, -10], desk: [-20, 0, -11.5], robotRotation: [0, Math.PI, 0], deskRotation: [0, 0, 0] },
  // 2 — وسط، صف أول
  { robot: [ -6, 0, -10], desk: [ -6, 0, -11.5], robotRotation: [0, Math.PI, 0], deskRotation: [0, 0, 0] },
  // 3 — يمين، صف أول
  { robot: [  6, 0, -10], desk: [  6, 0, -11.5], robotRotation: [0, Math.PI, 0], deskRotation: [0, 0, 0] },
  // 4 — يمين، صف ثاني
  { robot: [ 10, 0, -15], desk: [ 10, 0, -13.5], robotRotation: [0, 0, 0], deskRotation: [0, Math.PI, 0] },
  // 5 — وسط، صف ثاني
  { robot: [ -2, 0, -15], desk: [ -2, 0, -13.5], robotRotation: [0, 0, 0], deskRotation: [0, Math.PI, 0] },
  // 6 — وسط-يسار، صف ثاني
  { robot: [-10, 0, -15], desk: [-10, 0, -13.5], robotRotation: [0, 0, 0], deskRotation: [0, Math.PI, 0] },
  // 7 — يسار، صف ثاني
  { robot: [-18, 0, -15], desk: [-18, 0, -13.5], robotRotation: [0, 0, 0], deskRotation: [0, Math.PI, 0] },
];

export function getHallWorkerPosition(index: number): [number, number, number] {
  return HALL_WORKER_SLOTS[index % HALL_WORKER_SLOTS.length].robot;
}

export function getHallWorkerDeskPosition(index: number): [number, number, number] {
  return HALL_WORKER_SLOTS[index % HALL_WORKER_SLOTS.length].desk;
}

export function getHallWorkerRotation(index: number): [number, number, number] {
  return HALL_WORKER_SLOTS[index % HALL_WORKER_SLOTS.length].robotRotation;
}

export function getHallWorkerDeskRotation(index: number): [number, number, number] {
  return HALL_WORKER_SLOTS[index % HALL_WORKER_SLOTS.length].deskRotation;
}

export function getMaxHallWorkers(): number {
  return 7;
}

export function getHallWorkerColor(index: number): string {
  return ROBOT_COLORS[(index + 5) % ROBOT_COLORS.length]; // offset so colors differ from room robots
}

// ── Room-slot positions (robot + desk per room assignment) ────────────────────
interface RoomSlot {
  desk:          [number, number, number];
  robot:         [number, number, number];
  deskRotation:  [number, number, number];
  robotRotation: [number, number, number];
}

const HALF_PI = Math.PI / 2;

const ROOM_SLOTS: Record<string, RoomSlot[]> = {
  // Main room — left wall, Z axis (3 slots)
  main: [
    { desk: [-5.5, 0, -1],  robot: [-6.8, 0, -1],  deskRotation: [0, -HALF_PI, 0], robotRotation: [0, HALF_PI, 0] },
    { desk: [-5.5, 0,  2],  robot: [-6.8, 0,  2],  deskRotation: [0, -HALF_PI, 0], robotRotation: [0, HALF_PI, 0] },
    { desk: [-5.5, 0,  5],  robot: [-6.8, 0,  5],  deskRotation: [0, -HALF_PI, 0], robotRotation: [0, HALF_PI, 0] },
  ],
  // Stage 0 (S1) — center at world [-12, 0, -3], width=8, depth=8 → X[-16,-8], Z[-7,1]
  // slot0 = left wall (+z) middle, slot1/2 = back wall side
  stage0: [
    { desk: [-12,  0,  -1.0], robot: [-12,  0, 0.4], deskRotation: [0, 0,         0], robotRotation: [0, Math.PI, 0] },
    { desk: [-14,  0,  -5.5], robot: [-15,  0, -5.5], deskRotation: [0, HALF_PI,  0], robotRotation: [0, -HALF_PI, 0] },
    { desk: [-10,  0,  -5.5], robot: [-9.2, 0, -5.5], deskRotation: [0, -HALF_PI, 0], robotRotation: [0, HALF_PI,  0] },
  ],
  // Stage 1 (S2) — center at world [-20, 0, -3], width=8, depth=8 → X[-24,-16], Z[-7,1]
  // slot0 = left wall (+z) middle, slot1/2 = back wall side
  stage1: [
    { desk: [-20,  0,  -1.0], robot: [-20,  0, 0.4], deskRotation: [0, 0,         0], robotRotation: [0, Math.PI, 0] },
    { desk: [-22,  0,  -5.5], robot: [-23,  0, -5.5], deskRotation: [0, HALF_PI,  0], robotRotation: [0, -HALF_PI, 0] },
    { desk: [-18,  0,  -5.5], robot: [-17.2,0, -5.5], deskRotation: [0, -HALF_PI, 0], robotRotation: [0, HALF_PI,  0] },
  ],
  // Manager room — center at world [12, 0, -3], width=8, depth=8 → X[8,16], Z[-7,1]
  // left wall (X=9) facing +X (same mirror as main room)
  manager: [
    { desk: [10.5, 0, -1],   robot: [9,    0, -1],   deskRotation: [0, HALF_PI, 0],  robotRotation: [0, -HALF_PI, 0] },
    { desk: [10.5, 0, -3.5], robot: [9,    0, -3.5], deskRotation: [0, HALF_PI, 0],  robotRotation: [0, -HALF_PI, 0] },
    { desk: [10.5, 0, -5],   robot: [9,    0, -5],   deskRotation: [0, HALF_PI, 0],  robotRotation: [0, -HALF_PI, 0] },
  ],
  // BackRoom A — X[-24,-11], Z[-19,-29]  door(cx=-17.5,w=3) at Z=-19, opens to Z≈-22
  // slot0=center(door axis), slot1=left, slot2=right — desk at Z=-23.5, robot at Z=-25.5
  brA: [
    { desk: [-17.5, 0, -23.5], robot: [-17.5, 0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
    { desk: [-20.5, 0, -23.5], robot: [-20.5, 0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
    { desk: [-14.5, 0, -23.5], robot: [-14.5, 0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
  ],
  // BackRoom B — X[-10,3], Z[-19,-29]  door(cx=-3.5,w=3) at Z=-19, opens to Z≈-22
  brB: [
    { desk: [ -3.5, 0, -23.5], robot: [ -3.5, 0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
    { desk: [ -6.5, 0, -23.5], robot: [ -6.5, 0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
    { desk: [ -0.5, 0, -23.5], robot: [ -0.5, 0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
  ],
  // BackRoom C — X[4,16], Z[-19,-29]  door(cx=10,w=3) at Z=-19, opens to Z≈-22
  brC: [
    { desk: [  10,  0, -23.5], robot: [  10,  0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
    { desk: [   7,  0, -23.5], robot: [   7,  0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
    { desk: [  13,  0, -23.5], robot: [  13,  0, -25.5], deskRotation: [0, Math.PI, 0], robotRotation: [0, 0, 0] },
  ],
};

/** Returns position slot for a model in a given room. slotIndex = position within the room (0-based). */
export function getRoomSlot(room: string, slotIndex: number): RoomSlot {
  const slots = ROOM_SLOTS[room] || ROOM_SLOTS.main;
  return slots[slotIndex % slots.length];
}

interface GameState {
  phase: GamePhase;
  managerDoorLocked: boolean;
  managerKeypadOpen: boolean;
  stage0DoorLocked: boolean;
  stage1DoorLocked: boolean;
  hallDoorLocked: boolean;
  hall2DoorLocked: boolean;
  brADoorLocked: boolean;
  brBDoorLocked: boolean;
  brCDoorLocked: boolean;
  stage0KeypadOpen: boolean;
  stage1KeypadOpen: boolean;
  hallDoorKeypadOpen: boolean;
  hall2DoorKeypadOpen: boolean;
  brAKeypadOpen: boolean;
  brBKeypadOpen: boolean;
  brCKeypadOpen: boolean;
  videoScreenOpen: boolean;
  hologramOpen: boolean;
  humanOverlayOpen: boolean;
  vaultOpen: boolean;
  carryingBox: boolean;
  models: ModelInfo[];
  hallWorkers: ModelInfo[];
  humans: HumanMemberInfo[];
  user: UserInfo | null;
  selectedAvatar: string; // id of the chosen avatar glb (e.g. "avatar", "1", "2")
  pendingAutoEnter: boolean; // set by confirmAvatar so Player triggers walk-in even after Suspense
  companyName: string;
  companyLogo: string; // base64 or URL
  entranceBg:  string; // base64 or "" → fallback to /images/sillar-entrance.png
  isGuest: boolean; // دخل عبر رابط مشاركة — لا يمكنه دخول الغرف
  playerPos: { x: number; z: number }; // موضع اللاعب — يُحدَّث من Player.tsx كل frame
  setPlayerPos: (x: number, z: number) => void;
  teleportTarget: { x: number; z: number; lookAtX?: number; lookAtZ?: number } | null;
  setTeleportTarget: (t: { x: number; z: number; lookAtX?: number; lookAtZ?: number } | null) => void;

  unlock: (user: UserInfo, skipAvatarSelect?: boolean) => void;
  confirmAvatar: (avatarId: string) => void;
  clearAutoEnter: () => void;
  start: () => void;
  restart: () => void;
  end: () => void;
  logout: () => void;
  setIsGuest: (val: boolean) => void;
  unlockManagerDoor: () => void;
  openManagerKeypad: () => void;
  closeManagerKeypad: () => void;
  unlockStage0Door: () => void;
  lockStage0Door:   () => void;
  unlockStage1Door: () => void;
  lockStage1Door:   () => void;
  openStage0Keypad: () => void;
  closeStage0Keypad: () => void;
  openStage1Keypad: () => void;
  closeStage1Keypad: () => void;
  unlockHallDoor: () => void;
  lockHallDoor: () => void;
  unlockHall2Door: () => void;
  lockHall2Door: () => void;
  unlockBrADoor: () => void;
  lockBrADoor: () => void;
  unlockBrBDoor: () => void;
  lockBrBDoor: () => void;
  unlockBrCDoor: () => void;
  lockBrCDoor: () => void;
  openHallKeypad: () => void;
  closeHallKeypad: () => void;
  openHall2Keypad: () => void;
  closeHall2Keypad: () => void;
  openBrAKeypad: () => void;
  closeBrAKeypad: () => void;
  openBrBKeypad: () => void;
  closeBrBKeypad: () => void;
  openBrCKeypad: () => void;
  closeBrCKeypad: () => void;
  openVideoScreen: () => void;
  closeVideoScreen: () => void;
  openHologram: () => void;
  closeHologram: () => void;
  openHumanOverlay: () => void;
  closeHumanOverlay: () => void;
  openVault: () => void;
  closeVault: () => void;
  setCarryingBox: (val: boolean) => void;
  isExteriorView: boolean;
  setExteriorView: (val: boolean) => void;
  meetingMode: boolean;
  setMeetingMode: (val: boolean) => void;
  meetingMinutesOpen: boolean;
  openMeetingMinutes: () => void;
  closeMeetingMinutes: () => void;
  agoraMeetingOpen: boolean;
  openAgoraMeeting: () => void;
  closeAgoraMeeting: () => void;
  cameraMode: "focus" | "medium" | "top" | "fps" | "city" | "overview";
  setCameraMode: (mode: "focus" | "medium" | "top" | "fps" | "city" | "overview") => void;
  cameraResetToken: number;
  resetCamera: () => void;
  getRoomId: () => string;
  fetchModels: () => Promise<void>;
  fetchHallWorkers: () => Promise<void>;
  fetchHumans: () => Promise<void>;
  setCompanyInfo: (name: string, logo: string) => void;
  setEntranceBg:  (bg: string) => void;
  fetchCompanyInfo: () => void;
  appMode: "classic" | "pro" | null;
  setAppMode: (mode: "classic" | "pro") => void;
}

export const useGame = create<GameState>()(
  subscribeWithSelector((set) => ({
    phase: "locked",
    managerDoorLocked: true,
    managerKeypadOpen: false,
    stage0DoorLocked: true,
    stage1DoorLocked: true,
    hallDoorLocked: true,
    hall2DoorLocked: true,
    brADoorLocked: true,
    brBDoorLocked: true,
    brCDoorLocked: true,
    stage0KeypadOpen: false,
    stage1KeypadOpen: false,
    hallDoorKeypadOpen: false,
    hall2DoorKeypadOpen: false,
    brAKeypadOpen: false,
    brBKeypadOpen: false,
    brCKeypadOpen: false,
    videoScreenOpen: false,
    hologramOpen: false,
    humanOverlayOpen: false,
    vaultOpen: false,
    carryingBox: false,
    models: [],
    hallWorkers: [],
    humans: [],
    user: null,
    selectedAvatar: localStorage.getItem("selectedAvatar") || "lite",
    pendingAutoEnter: false,
    companyName: "",
    companyLogo: "",
    entranceBg:  "",
    isGuest: false,
    appMode: null,
    setAppMode: (mode) => set({ appMode: mode }),
    playerPos: { x: 0, z: 8.5 },
    setPlayerPos: (x, z) => set({ playerPos: { x, z } }),
    teleportTarget: null,
    setTeleportTarget: (t) => set({ teleportTarget: t }),
    isExteriorView: false,
    meetingMode: false,
    setMeetingMode: (val) => set({ meetingMode: val }),
    meetingMinutesOpen: false,
    openMeetingMinutes:  () => set({ meetingMinutesOpen: true }),
    closeMeetingMinutes: () => set({ meetingMinutesOpen: false }),
    agoraMeetingOpen: false,
    openAgoraMeeting:  () => set({ agoraMeetingOpen: true }),
    closeAgoraMeeting: () => set({ agoraMeetingOpen: false }),
    cameraMode: "city",
    cameraResetToken: 0,

    unlock: (user: UserInfo, skipAvatarSelect = false) => {
      if (user.role === "admin") {
        set({ phase: "admin", user });
        return;
      }
      setRoomId(user.roomId);
      const savedAvatar = localStorage.getItem("selectedAvatar") || "lite";
      set((state) => {
        if (state.phase === "locked") {
          return {
            phase: skipAvatarSelect ? "playing" : "avatar_select",
            user,
            selectedAvatar: savedAvatar,
            // trigger auto-enter animation even for returning users so camera repositions
            pendingAutoEnter: skipAvatarSelect ? true : false,
          };
        }
        return {};
      });
    },

    confirmAvatar: (avatarId: string) => {
      localStorage.setItem("selectedAvatar", avatarId);
      set({ selectedAvatar: avatarId, phase: "playing", pendingAutoEnter: true });
    },

    clearAutoEnter: () => set({ pendingAutoEnter: false }),

    start: () => {
      set((state) => {
        if (state.phase === "ready") {
          return { phase: "playing" };
        }
        return {};
      });
    },

    restart: () => {
      set({
        phase: "ready",
        managerDoorLocked: true,
        managerKeypadOpen: false,
        stage0DoorLocked: true,
        stage1DoorLocked: true,
        stage0KeypadOpen: false,
        stage1KeypadOpen: false,
        videoScreenOpen: false,
        hologramOpen: false,
        vaultOpen: false,
        carryingBox: false,
        hallDoorLocked: true,
        hall2DoorLocked: true,
        brADoorLocked: true,
        brBDoorLocked: true,
        brCDoorLocked: true,
      });
    },

    end: () => {
      set({ phase: "ended" });
    },

    logout: () => {
      setRoomId("default");
      clearAuthToken();
      set({
        phase: "locked",
        user: null,
        isGuest: false,
        managerDoorLocked: true,
        managerKeypadOpen: false,
        stage0DoorLocked: true,
        stage1DoorLocked: true,
        stage0KeypadOpen: false,
        stage1KeypadOpen: false,
        videoScreenOpen: false,
        hologramOpen: false,
        vaultOpen: false,
        carryingBox: false,
        companyName: "",
        companyLogo: "",
        hallDoorLocked: true,
        hall2DoorLocked: true,
        brADoorLocked: true,
        brBDoorLocked: true,
        brCDoorLocked: true,
      });
    },

    setIsGuest: (val: boolean) => set({ isGuest: val }),

    unlockManagerDoor: () => {
      set({ managerDoorLocked: false });
    },

    lockManagerDoor: () => {
      set({ managerDoorLocked: true });
    },

    openManagerKeypad: () => {
      set({ managerKeypadOpen: true });
    },

    closeManagerKeypad: () => {
      set({ managerKeypadOpen: false });
    },

    unlockStage0Door: () => set({ stage0DoorLocked: false }),
    lockStage0Door:   () => set({ stage0DoorLocked: true }),
    unlockStage1Door: () => set({ stage1DoorLocked: false }),
    lockStage1Door:   () => set({ stage1DoorLocked: true }),
    openStage0Keypad:  () => set({ stage0KeypadOpen: true }),
    closeStage0Keypad: () => set({ stage0KeypadOpen: false }),
    openStage1Keypad:  () => set({ stage1KeypadOpen: true }),
    closeStage1Keypad: () => set({ stage1KeypadOpen: false }),

    unlockHallDoor:  () => set({ hallDoorLocked: false }),
    lockHallDoor:    () => set({ hallDoorLocked: true }),
    unlockHall2Door: () => set({ hall2DoorLocked: false }),
    lockHall2Door:   () => set({ hall2DoorLocked: true }),
    unlockBrADoor:   () => set({ brADoorLocked: false }),
    lockBrADoor:     () => set({ brADoorLocked: true }),
    unlockBrBDoor:   () => set({ brBDoorLocked: false }),
    lockBrBDoor:     () => set({ brBDoorLocked: true }),
    unlockBrCDoor:   () => set({ brCDoorLocked: false }),
    lockBrCDoor:     () => set({ brCDoorLocked: true }),
    openHallKeypad:  () => set({ hallDoorKeypadOpen: true }),
    closeHallKeypad: () => set({ hallDoorKeypadOpen: false }),
    openHall2Keypad:  () => set({ hall2DoorKeypadOpen: true }),
    closeHall2Keypad: () => set({ hall2DoorKeypadOpen: false }),
    openBrAKeypad:   () => set({ brAKeypadOpen: true }),
    closeBrAKeypad:  () => set({ brAKeypadOpen: false }),
    openBrBKeypad:   () => set({ brBKeypadOpen: true }),
    closeBrBKeypad:  () => set({ brBKeypadOpen: false }),
    openBrCKeypad:   () => set({ brCKeypadOpen: true }),
    closeBrCKeypad:  () => set({ brCKeypadOpen: false }),

    openVideoScreen: () => {
      set({ videoScreenOpen: true });
    },

    closeVideoScreen: () => {
      set({ videoScreenOpen: false });
    },

    openHologram: () => {
      set({ hologramOpen: true });
    },

    closeHologram: () => {
      set({ hologramOpen: false });
    },

    openHumanOverlay: () => {
      set({ humanOverlayOpen: true });
    },

    closeHumanOverlay: () => {
      set({ humanOverlayOpen: false });
    },

    openVault: () => {
      set({ vaultOpen: true });
    },

    closeVault: () => {
      set({ vaultOpen: false });
    },

    setCarryingBox: (val: boolean) => {
      set({ carryingBox: val });
    },
    setExteriorView: (val: boolean) => {
      set({ isExteriorView: val });
    },

    setCameraMode: (mode: "focus" | "medium" | "top" | "fps" | "city" | "overview") => {
      set({ cameraMode: mode });
    },
    resetCamera: () => {
      set((s) => ({ cameraMode: "focus", cameraResetToken: s.cameraResetToken + 1 }));
    },

    getRoomId: (): string => {
      return useGame.getState().user?.roomId || "default";
    },

    fetchModels: async () => {
      try {
        const res = await apiFetch("/api/models");
        const data = await res.json();
        set({
          models: (data as any[]).map((m: any) => ({
            ...m,
            roomAssignment: m.roomAssignment || "main",
          })),
        });
      } catch (e) {
        console.error("Failed to fetch models:", e);
      }
    },

    fetchHallWorkers: async () => {
      try {
        const res = await apiFetch("/api/hall-workers");
        const data = await res.json();
        set({ hallWorkers: Array.isArray(data) ? data : [] });
      } catch (e) {
        console.error("Failed to fetch hall workers:", e);
      }
    },

    fetchHumans: async () => {
      try {
        const res = await apiFetch("/api/humans");
        const data = await res.json();
        set({ humans: Array.isArray(data) ? data : [] });
      } catch (e) {
        console.error("Failed to fetch humans:", e);
      }
    },

    setCompanyInfo: (name: string, logo: string) => {
      set({ companyName: name, companyLogo: logo });
    },

    setEntranceBg: (bg: string) => {
      set({ entranceBg: bg });
    },

    fetchCompanyInfo: async () => {
      try {
        const res = await apiFetch("/api/vault-settings");
        const data = await res.json();
        if (data.company) {
          set({
            companyName: data.company.name || "",
            companyLogo: data.company.logo || "",
          });
        }
        if (data.loginBg !== undefined) {
          set({ entranceBg: data.loginBg || "" });
        }
      } catch {
        // ignore
      }
    },
  }))
);
