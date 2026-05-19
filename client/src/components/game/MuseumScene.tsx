/**
 * MuseumScene.tsx
 * متحف ويكيبيديا ثلاثي الأبعاد مع روبوتات ومكاتب مكتبية
 * مبني على linkwalk (Three.js vanilla) داخل React wrapper
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useGame } from "@/lib/stores/useGame";
import { useChat } from "@/lib/stores/useChat";
import { ChatBubble } from "@/components/game/ChatBubble";

// ─── Wikipedia helpers ────────────────────────────────────────────────────────
async function fetchWikiData(title: string, signal?: AbortSignal) {
  try {
    const lang = localStorage.getItem("linkwalk:language:v1") || "en";
    const base = `https://${lang}.wikipedia.org`;
    const summaryUrl = `${base}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(summaryUrl, { signal });
    if (!res.ok) throw new Error("wiki fetch failed");
    const data = await res.json();

    // photos via action API
    const params = new URLSearchParams({
      action: "query", titles: title, prop: "images",
      imlimit: "20", format: "json", origin: "*",
    });
    const imgRes = await fetch(`${base}/w/api.php?${params}`, { signal });
    const imgData = await imgRes.json();
    const pages = imgData?.query?.pages ?? {};
    const rawImages: string[] = [];
    for (const page of Object.values(pages) as any[]) {
      for (const img of page?.images ?? []) {
        const n = img?.title?.replace("File:", "") ?? "";
        if (n && !n.match(/\.(svg|ogv|ogg|webm)$/i)) {
          // نمرر عبر proxy السيرفر لحل مشكلة CORS مع Commons
          const commonsUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(n)}?width=800`;
          rawImages.push(`/api/museum/proxy-image?url=${encodeURIComponent(commonsUrl)}`);
        }
      }
    }

    // related via links
    const linksParams = new URLSearchParams({
      action: "query", titles: title, prop: "links",
      pllimit: "20", plnamespace: "0", format: "json", origin: "*",
    });
    const linksRes = await fetch(`${base}/w/api.php?${linksParams}`, { signal });
    const linksData = await linksRes.json();
    const relatedTitles: string[] = [];
    for (const page of Object.values(linksData?.query?.pages ?? {}) as any[]) {
      for (const link of page?.links ?? []) {
        if (link?.title) relatedTitles.push(link.title);
      }
    }

    return {
      title: data.title ?? title,
      extract: data.extract ?? "",
      thumbnail: data.thumbnail?.source ?? null,
      photos: rawImages.slice(0, 8),
      related: relatedTitles.slice(0, 6),
    };
  } catch {
    return { title, extract: "", thumbnail: null, photos: [], related: [] };
  }
}

// lobby categories
const LOBBY_CATEGORIES: Record<string, string[]> = {
  en: ["Technology", "Science", "History", "Art", "Nature", "Space", "Music", "Philosophy", "Animals", "Culture", "Geography", "Painting"],
  ar: ["تكنولوجيا", "علوم", "تاريخ", "فن", "طبيعة", "فضاء", "موسيقى", "فلسفة", "حيوانات", "ثقافة", "جغرافيا", "رسم"],
};
function getLobbyCategories() {
  const lang = localStorage.getItem("linkwalk:language:v1") || "en";
  return LOBBY_CATEGORIES[lang] ?? LOBBY_CATEGORIES.en;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MuseumScene() {
  const setAppMode = useGame((s) => s.setAppMode);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const engineRef  = useRef<any>(null);
  const abortRef   = useRef<AbortController | null>(null);

  const [locked,        setLocked]        = useState(false);
  const [loadingText,   setLoadingText]    = useState<string | null>("جاري تحميل المتحف…");
  const [currentTitle,  setCurrentTitle]   = useState<string | null>(null);
  const [nearRobotId,   setNearRobotId]    = useState<string | null>(null);
  const isChatOpen = useChat((s) => s.isOpen);

  // ── init engine ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stopped = false;

    async function boot() {
      // dynamic import — vanilla JS, no TS types needed
      const { startYourEngines } = await import("@/lib/museum/engine.js") as any;

      if (stopped || !canvasRef.current) return;

      engineRef.current = startYourEngines({
        canvas: canvasRef.current,
        roomMode: "gallery",
        roomSeedTitle: "Wikipedia",
        galleryEntryWall: "south",
        galleryTitle: "",
        galleryDescription: "",
        galleryMainThumbnailUrl: null,
        galleryPhotos: [],
        galleryLongExtract: "",
        galleryRelatedTitles: [],
        galleryTrail: [],
        roomSpawn: { type: "fromWall", wall: "south" },

        onPointerLockChange(locked: boolean) {
          setLocked(locked);
          document.body.classList.toggle("locked", locked);
        },

        onRandomExhibitRequested() { /* معطّل */ },
        onGoLobbyRequested()       { /* معطّل */ },
        onDoorTrigger()            { /* الأبواب معطّلة — S0-S6 للعرض فقط */ },
      });
    }

    boot().then(() => {
      if (!stopped) {
        // delay صغير حتى يستقر الـ engine
        setTimeout(() => { if (!stopped) loadCustomRoom(); }, 150);
      }
    });

    return () => {
      stopped = true;
      abortRef.current?.abort();
      engineRef.current?.stop?.();
      engineRef.current = null;
      document.body.classList.remove("locked");
    };
  }, []); // eslint-disable-line

  // ── proximity check + F key ───────────────────────────────────────────────
  useEffect(() => {
    const INTERACT_RANGE = 4;

    // حساب مواضع الروبوتات في الفضاء العالمي بناءً على أبعاد الغرفة
    function getRobotPositions() {
      const engine = engineRef.current;
      if (!engine) return [];
      const { halfL } = engine.getRoomDimensions();
      return [
        { id: "museum-robot-1", x: 0, z: halfL * 0.15 - 0.72 },  // station ry=π
        { id: "museum-robot-2", x: 0, z: -halfL * 0.15 + 0.72 }, // station ry=0
      ];
    }

    // proximity polling
    let rafId: number;
    function tick() {
      const engine = engineRef.current;
      if (engine && !useChat.getState().isOpen) {
        const pos = engine.getPlayerPosition();
        const robots = getRobotPositions();
        let nearest: string | null = null;
        let minDist = INTERACT_RANGE;
        for (const r of robots) {
          const d = Math.hypot(pos.x - r.x, pos.z - r.z);
          if (d < minDist) { minDist = d; nearest = r.id; }
        }
        setNearRobotId(nearest);
      } else {
        setNearRobotId(null);
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // F key
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "KeyF") return;
      const chatState = useChat.getState();
      if (chatState.isOpen) {
        chatState.closeChat();
        return;
      }
      const engine = engineRef.current;
      if (!engine) return;
      const pos = engine.getPlayerPosition();
      const robots = getRobotPositions();
      let nearest: string | null = null;
      let minDist = INTERACT_RANGE;
      for (const r of robots) {
        const d = Math.hypot(pos.x - r.x, pos.z - r.z);
        if (d < minDist) { minDist = d; nearest = r.id; }
      }
      if (nearest) {
        document.exitPointerLock?.();
        chatState.openChat(nearest);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // ── تحميل الغرفة بالصور المخصصة فقط (بدون ويكيبيديا) ────────────────────
  const loadCustomRoom = useCallback(() => {
    // اقرأ الصور من لوحة التحكم
    let customPhotos: string[] = [];
    try {
      const raw = localStorage.getItem("museum:wall-photos");
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        customPhotos = arr.filter((u: string) => u && u.trim());
      }
    } catch { /* ignore */ }

    engineRef.current?.setRoom?.({
      roomMode: "gallery",
      roomSeedTitle: "Museum",
      galleryEntryWall: "south",
      galleryTitle: "",
      galleryDescription: "",
      galleryMainThumbnailUrl: customPhotos[0] ?? null, // أول صورة كـ thumbnail
      galleryPhotos: customPhotos.slice(1),  // باقي الصور على الجدران
      galleryLongExtract: "",
      galleryRelatedTitles: [],
      galleryTrail: [],
      spawn: { type: "fromWall", wall: "south" },
    });

    setTimeout(() => applyStageLabels(), 400);
    setLoadingText(null);
    setCurrentTitle(null);
  }, []);

  // ── تسمية الأبواب S0-S6 وإلغاء التنقل ───────────────────────────────────
  const applyStageLabels = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const labels = ["S0","S1","S2","S3","S4","S5","S6"];
    labels.forEach((label, i) => {
      engine.setDoorMeta?.(`seealso-${i}`, { articleTitle: null, category: null, target: null });
      engine.setDoorLabelOverride?.(`seealso-${i}`, label);
    });
  }, []);


  return (
    <div
      style={{ width: "100vw", height: "100vh", background: "#05030a", position: "relative", overflow: "hidden" }}
      onClick={() => { if (!locked) canvasRef.current?.requestPointerLock(); }}
    >
      {/* Canvas يشغّله محرك linkwalk مباشرة */}
      <canvas
        ref={canvasRef}
        id="museum-scene"
        style={{ width: "100%", height: "100%", display: "block", cursor: locked ? "none" : "pointer" }}
      />

      {/* زر الرجوع — دائماً ظاهر */}
      <button
        onClick={e => { e.stopPropagation(); document.exitPointerLock?.(); setAppMode("classic"); }}
        style={{
          position: "absolute", top: 16, right: 20,
          background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.13)",
          color: "rgba(255,255,255,0.55)", padding: "6px 16px", borderRadius: 8,
          cursor: "pointer", fontSize: 12, fontFamily: "Inter, sans-serif", letterSpacing: 1,
          backdropFilter: "blur(6px)",
          zIndex: 10,
        }}
      >
        ← المكتب
      </button>

      {/* crosshair */}
      {locked && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none", width: 18, height: 18,
        }}>
          <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 2, background: "#4fc3f7", borderRadius: 1 }} />
          <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "#4fc3f7", borderRadius: 1 }} />
        </div>
      )}

      {/* hint — انقر للدخول */}
      {!locked && !isChatOpen && (
        <div style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 2,
          fontFamily: "Inter, sans-serif", pointerEvents: "none",
          background: "rgba(0,0,0,0.3)", padding: "6px 18px", borderRadius: 20,
          backdropFilter: "blur(4px)",
        }}>
          انقر أي مكان للدخول · ESC للخروج
        </div>
      )}

      {/* proximity hint — F للتحدث */}
      {locked && nearRobotId && (
        <div style={{
          position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
          color: "#4fc3f7", fontSize: 13, letterSpacing: 1,
          fontFamily: "Inter, sans-serif", pointerEvents: "none",
          background: "rgba(0,0,0,0.6)", padding: "8px 22px", borderRadius: 20,
          backdropFilter: "blur(6px)", border: "1px solid rgba(79,195,247,0.3)",
          animation: "pulse 1.5s ease-in-out infinite",
        }}>
          🤖 اضغط <strong>[F]</strong> للتحدث
        </div>
      )}

      {/* Loading indicator */}
      {loadingText && (
        <div style={{
          position: "absolute", bottom: 72, left: "50%", transform: "translateX(-50%)",
          color: "#4fc3f7", fontSize: 13, letterSpacing: 1,
          fontFamily: "Inter, sans-serif",
          background: "rgba(0,0,0,0.5)",
          padding: "8px 20px", borderRadius: 8,
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
        }}>
          ⏳ {loadingText}
        </div>
      )}

      {/* Current article label */}
      {currentTitle && locked && (
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: 2,
          fontFamily: "Inter, sans-serif", textTransform: "uppercase",
          pointerEvents: "none", background: "rgba(0,0,0,0.3)",
          padding: "4px 14px", borderRadius: 12,
        }}>
          📖 {currentTitle}
        </div>
      )}

      {/* ChatBubble — نفس مكوّن المكتب الرئيسي */}
      <ChatBubble />

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1; transform:translateX(-50%) scale(1); }
          50%      { opacity:.7; transform:translateX(-50%) scale(1.03); }
        }
      `}</style>
    </div>
  );
}
