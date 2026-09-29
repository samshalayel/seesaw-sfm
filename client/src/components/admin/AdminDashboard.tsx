import { useState, useEffect, useCallback } from "react";
import { clearAuthToken } from "../../lib/utils";
import { useGame } from "../../lib/stores/useGame";

interface UserRow {
  id: number;
  username: string;
  roomId: string;
  role: string;
  status: string;
  tier: string;
  subscriptionEnd: string | null;
  createdAt: string | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:    { label: "نشط",   color: "#22c55e" },
  suspended: { label: "موقوف", color: "#f59e0b" },
  cancelled: { label: "ملغى",  color: "#ef4444" },
};

interface Stats {
  totalUsers: number;
  byTier: Record<string, number>;
  byRole: Record<string, number>;
}

function computeStats(users: UserRow[]): Stats {
  const byTier: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  for (const u of users) {
    byTier[u.tier] = (byTier[u.tier] || 0) + 1;
    byRole[u.role] = (byRole[u.role] || 0) + 1;
  }
  return { totalUsers: users.length, byTier, byRole };
}

type Tab = "users" | "tiers";

const TIERS = ["free", "pro", "enterprise"];
const MODEL_OPTIONS = [
  "GPT-4o",
  "GPT-4o-mini",
  "Claude Sonnet",
  "Claude Haiku",
  "Gemini Flash",
  "Groq Llama",
  "GLM Flash",
  "Mistral Large",
];

const gold = "#c4a44a";
const darkBg = "rgba(12,10,24,0.98)";
const cardBg = "rgba(26,21,40,0.95)";
const borderCol = "rgba(196,164,74,0.25)";

function getToken() {
  return localStorage.getItem("authToken") || "";
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("users");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tierModels, setTierModels] = useState<Record<string, string[]>>({
    free: [], pro: [], enterprise: [],
  });
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editTier, setEditTier] = useState("free");
  const [editRole, setEditRole] = useState("user");
  const [editSubEnd, setEditSubEnd] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", tier: "free", role: "user", status: "active" });
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const logout = useGame((s) => s.logout);

  const fetchUsers = useCallback(async () => {
    const r = await fetch("/api/admin/users", { headers: authHeaders() });
    if (r.ok) {
      const data = await r.json();
      setUsers(data);
      setStats(computeStats(data));
    }
  }, []);

  const fetchTierModels = useCallback(async () => {
    const r = await fetch("/api/admin/tier-models", { headers: authHeaders() });
    if (r.ok) setTierModels(await r.json());
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTierModels();
  }, [fetchUsers, fetchTierModels]);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditTier(u.tier);
    setEditRole(u.role);
    setEditSubEnd(u.subscriptionEnd ? u.subscriptionEnd.slice(0, 10) : "");
    setEditStatus(u.status || "active");
  };

  const createUser = async () => {
    if (!newUser.username.trim() || !newUser.password) { flash("✕ اسم المستخدم وكلمة السر مطلوبان"); return; }
    if (newUser.password.length < 6) { flash("✕ كلمة السر 6 أحرف على الأقل"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(newUser),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        flash("✓ تم إنشاء المستخدم");
        setAddingUser(false);
        setNewUser({ username: "", password: "", tier: "free", role: "user", status: "active" });
        fetchUsers();
      } else {
        flash("✕ " + (data.error || "خطأ في الإنشاء"));
      }
    } finally { setLoading(false); }
  };

  const changePassword = async () => {
    if (!pwUser) return;
    if (newPassword.length < 6) { flash("✕ كلمة السر 6 أحرف على الأقل"); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${pwUser.id}/password`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        flash("✓ تم تغيير كلمة السر");
        setPwUser(null);
        setNewPassword("");
      } else {
        flash("✕ " + (data.error || "خطأ"));
      }
    } finally { setLoading(false); }
  };

  const setStatus = async (u: UserRow, status: string) => {
    const meta = STATUS_META[status];
    if (status !== "active" && !confirm(`تغيير حالة "${u.username}" إلى ${meta.label}؟ لن يستطيع تسجيل الدخول.`)) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${u.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (r.ok) { flash(`✓ الحالة: ${meta.label}`); fetchUsers(); }
      else flash("✕ خطأ في تغيير الحالة");
    } finally { setLoading(false); }
  };

  const saveUser = async () => {
    if (!editingUser) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          tier: editTier,
          role: editRole,
          status: editStatus,
          subscriptionEnd: editSubEnd || null,
        }),
      });
      if (r.ok) {
        flash("✓ تم الحفظ");
        setEditingUser(null);
        fetchUsers();
      } else {
        flash("✕ خطأ في الحفظ");
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (u: UserRow) => {
    if (!confirm(`حذف المستخدم "${u.username}"؟`)) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${u.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (r.ok) {
        flash("✓ تم الحذف");
        fetchUsers();
      } else {
        flash("✕ خطأ في الحذف");
      }
    } finally {
      setLoading(false);
    }
  };

  const saveTierModels = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/tier-models", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(tierModels),
      });
      if (r.ok) flash("✓ تم حفظ إعدادات التايرز");
      else flash("✕ خطأ في الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const toggleTierModel = (tier: string, model: string) => {
    setTierModels((prev) => {
      const list = prev[tier] || [];
      return {
        ...prev,
        [tier]: list.includes(model) ? list.filter((m) => m !== model) : [...list, model],
      };
    });
  };

  const handleLogout = () => {
    clearAuthToken();
    logout();
  };

  const tierColor: Record<string, string> = {
    free: "#6b7280",
    pro: "#3b82f6",
    enterprise: "#a855f7",
  };

  const roleColor: Record<string, string> = {
    admin: "#ef4444",
    user: "#4b5563",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0814 0%, #0d0a1e 50%, #0a0814 100%)",
        color: "#e2d9c0",
        fontFamily: "Inter, monospace, sans-serif",
        direction: "rtl",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: darkBg,
          borderBottom: `1px solid ${borderCol}`,
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img
            src="/images/sillar_icon.png"
            alt="Sillar"
            style={{ width: 32, height: 32, objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div>
            <div style={{ color: gold, fontWeight: "bold", fontSize: "15px", letterSpacing: "2px" }}>
              SILLAR ADMIN
            </div>
            <div style={{ color: "#776a50", fontSize: "11px", letterSpacing: "1px" }}>
              لوحة التحكم
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {msg && (
            <div
              style={{
                color: msg.startsWith("✓") ? "#4ade80" : "#ef4444",
                fontSize: "13px",
                fontFamily: "monospace",
              }}
            >
              {msg}
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              color: "#ef4444",
              padding: "7px 16px",
              cursor: "pointer",
              fontSize: "12px",
              letterSpacing: "1px",
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
        {/* Stats Cards */}
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            {[
              { label: "إجمالي المستخدمين", value: stats.totalUsers, color: gold },
              { label: "مجاني", value: stats.byTier.free || 0, color: tierColor.free },
              { label: "Pro", value: stats.byTier.pro || 0, color: tierColor.pro },
              { label: "Enterprise", value: stats.byTier.enterprise || 0, color: tierColor.enterprise },
              { label: "مديرون", value: stats.byRole.admin || 0, color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: cardBg,
                  border: `1px solid ${borderCol}`,
                  borderRadius: "12px",
                  padding: "18px 20px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "28px", fontWeight: "bold", color }}>{value}</div>
                <div style={{ fontSize: "12px", color: "#776a50", marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "20px",
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: "10px",
            padding: "4px",
            width: "fit-content",
          }}
        >
          {(["users", "tiers"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 22px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: tab === t ? "bold" : "normal",
                background: tab === t ? `rgba(196,164,74,0.15)` : "transparent",
                color: tab === t ? gold : "#776a50",
                transition: "all 0.2s",
              }}
            >
              {t === "users" ? "المستخدمون" : "إعدادات التايرز"}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === "users" && (
          <div
            style={{
              background: cardBg,
              border: `1px solid ${borderCol}`,
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            {/* شريط الإضافة */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 18px", borderBottom: `1px solid ${borderCol}`,
            }}>
              <span style={{ color: "#776a50", fontSize: "12px" }}>{users.length} مستخدم</span>
              <button
                onClick={() => setAddingUser(true)}
                style={{
                  background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)",
                  borderRadius: "8px", color: "#22c55e", padding: "6px 14px",
                  cursor: "pointer", fontSize: "12px", fontWeight: 700,
                }}
              >+ إضافة مستخدم</button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 90px 100px 90px 110px 150px",
                padding: "12px 18px",
                borderBottom: `1px solid ${borderCol}`,
                color: "#776a50",
                fontSize: "11px",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              <span>اسم المستخدم</span>
              <span>Room ID</span>
              <span>الدور</span>
              <span>التايرز</span>
              <span>الحالة</span>
              <span>انتهاء الاشتراك</span>
              <span style={{ textAlign: "center" }}>إجراءات</span>
            </div>

            {users.length === 0 && (
              <div style={{ padding: "32px", textAlign: "center", color: "#776a50" }}>
                لا يوجد مستخدمون
              </div>
            )}

            {users.map((u, i) => (
              <div
                key={u.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 90px 100px 90px 110px 150px",
                  padding: "13px 18px",
                  borderBottom: i < users.length - 1 ? `1px solid rgba(196,164,74,0.08)` : "none",
                  alignItems: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(196,164,74,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontWeight: 500, color: "#e2d9c0" }}>{u.username}</span>
                <span style={{ fontSize: "11px", color: "#4b5563", fontFamily: "monospace" }}>
                  {u.roomId.slice(0, 22)}...
                </span>
                <span>
                  <span
                    style={{
                      background: `${roleColor[u.role] || "#4b5563"}22`,
                      border: `1px solid ${roleColor[u.role] || "#4b5563"}44`,
                      borderRadius: "6px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      color: roleColor[u.role] || "#9ca3af",
                    }}
                  >
                    {u.role}
                  </span>
                </span>
                <span>
                  <span
                    style={{
                      background: `${tierColor[u.tier] || "#6b7280"}22`,
                      border: `1px solid ${tierColor[u.tier] || "#6b7280"}44`,
                      borderRadius: "6px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      color: tierColor[u.tier] || "#9ca3af",
                    }}
                  >
                    {u.tier}
                  </span>
                </span>
                <span>
                  <select
                    value={u.status || "active"}
                    onChange={(e) => setStatus(u, e.target.value)}
                    disabled={loading}
                    style={{
                      background: `${(STATUS_META[u.status] || STATUS_META.active).color}18`,
                      border: `1px solid ${(STATUS_META[u.status] || STATUS_META.active).color}55`,
                      borderRadius: "6px",
                      padding: "3px 6px",
                      fontSize: "11px",
                      color: (STATUS_META[u.status] || STATUS_META.active).color,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k} style={{ background: "#12100c", color: v.color }}>{v.label}</option>
                    ))}
                  </select>
                </span>
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  {u.subscriptionEnd ? new Date(u.subscriptionEnd).toLocaleDateString("ar-SA") : "—"}
                </span>
                <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                  <button
                    onClick={() => openEdit(u)}
                    style={{
                      background: "rgba(196,164,74,0.1)",
                      border: `1px solid rgba(196,164,74,0.3)`,
                      borderRadius: "6px",
                      color: gold,
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => { setPwUser(u); setNewPassword(""); }}
                    title="تغيير كلمة السر"
                    style={{
                      background: "rgba(96,165,250,0.1)",
                      border: "1px solid rgba(96,165,250,0.35)",
                      borderRadius: "6px",
                      color: "#60a5fa",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    🔑
                  </button>
                  {u.role !== "admin" && (
                    <button
                      onClick={() => deleteUser(u)}
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: "6px",
                        color: "#ef4444",
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tiers Tab */}
        {tab === "tiers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {TIERS.map((tier) => (
              <div
                key={tier}
                style={{
                  background: cardBg,
                  border: `1px solid ${tierColor[tier]}44`,
                  borderRadius: "14px",
                  padding: "20px 24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <span
                    style={{
                      background: `${tierColor[tier]}22`,
                      border: `1px solid ${tierColor[tier]}55`,
                      borderRadius: "8px",
                      padding: "3px 14px",
                      color: tierColor[tier],
                      fontWeight: "bold",
                      fontSize: "13px",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                    }}
                  >
                    {tier}
                  </span>
                  <span style={{ color: "#776a50", fontSize: "12px" }}>
                    — الموديلات المسموح بها
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {MODEL_OPTIONS.map((model) => {
                    const active = (tierModels[tier] || []).includes(model);
                    return (
                      <button
                        key={model}
                        onClick={() => toggleTierModel(tier, model)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: active
                            ? `1px solid ${tierColor[tier]}88`
                            : "1px solid rgba(255,255,255,0.08)",
                          background: active ? `${tierColor[tier]}22` : "rgba(255,255,255,0.03)",
                          color: active ? tierColor[tier] : "#6b7280",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontFamily: "monospace",
                          transition: "all 0.2s",
                        }}
                      >
                        {active ? "✓ " : ""}{model}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={saveTierModels}
              disabled={loading}
              style={{
                alignSelf: "flex-end",
                padding: "10px 28px",
                borderRadius: "10px",
                border: `1px solid rgba(196,164,74,0.4)`,
                background: "rgba(196,164,74,0.12)",
                color: gold,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: "bold",
                letterSpacing: "2px",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.2s",
              }}
            >
              {loading ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </button>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {/* ── إضافة مستخدم ── */}
      {addingUser && (() => {
        const fieldStyle: React.CSSProperties = {
          display: "block", width: "100%", marginTop: "6px", padding: "9px 12px",
          borderRadius: "8px", border: `1px solid ${borderCol}`,
          background: "rgba(255,255,255,0.04)", color: "#e2d9c0", fontSize: "13px",
          outline: "none", boxSizing: "border-box",
        };
        return (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 200,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setAddingUser(false); }}
        >
          <div style={{
            background: "linear-gradient(145deg, rgba(26,21,40,0.99), rgba(20,16,32,0.99))",
            border: `1px solid ${borderCol}`, borderRadius: "16px",
            padding: "28px 32px", minWidth: "360px", boxShadow: "0 0 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ color: "#22c55e", fontWeight: "bold", fontSize: "14px", letterSpacing: "2px", marginBottom: "20px" }}>
              إضافة مستخدم جديد
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label style={{ fontSize: "12px", color: "#776a50" }}>
                اسم المستخدم
                <input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  autoFocus
                  style={{ ...fieldStyle, direction: "ltr", textAlign: "left" }}
                />
              </label>

              <label style={{ fontSize: "12px", color: "#776a50" }}>
                كلمة السر (6 أحرف على الأقل)
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  style={{ ...fieldStyle, direction: "ltr", textAlign: "left" }}
                />
              </label>

              <label style={{ fontSize: "12px", color: "#776a50" }}>
                الدور
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} style={fieldStyle}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </label>

              <label style={{ fontSize: "12px", color: "#776a50" }}>
                التايرز
                <select value={newUser.tier} onChange={(e) => setNewUser({ ...newUser, tier: e.target.value })} style={fieldStyle}>
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                  <option value="enterprise">enterprise</option>
                </select>
              </label>

              <label style={{ fontSize: "12px", color: "#776a50" }}>
                الحالة
                <select value={newUser.status} onChange={(e) => setNewUser({ ...newUser, status: e.target.value })} style={fieldStyle}>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k} style={{ background: "#12100c" }}>{v.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setAddingUser(false)}
                style={{
                  background: "transparent", border: `1px solid ${borderCol}`, borderRadius: "8px",
                  color: "#776a50", padding: "8px 18px", cursor: "pointer", fontSize: "12px",
                }}
              >إلغاء</button>
              <button
                onClick={createUser}
                disabled={loading}
                style={{
                  background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.5)",
                  borderRadius: "8px", color: "#22c55e", padding: "8px 18px",
                  cursor: loading ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 700,
                  opacity: loading ? 0.6 : 1,
                }}
              >{loading ? "..." : "إنشاء"}</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── تغيير كلمة السر ── */}
      {pwUser && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 200,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPwUser(null); }}
        >
          <div style={{
            background: "linear-gradient(145deg, rgba(26,21,40,0.99), rgba(20,16,32,0.99))",
            border: `1px solid ${borderCol}`, borderRadius: "16px",
            padding: "28px 32px", minWidth: "340px", boxShadow: "0 0 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ color: "#60a5fa", fontWeight: "bold", fontSize: "14px", letterSpacing: "2px", marginBottom: "6px" }}>
              تغيير كلمة السر
            </div>
            <div style={{ color: "#776a50", fontSize: "12px", marginBottom: "20px" }}>
              {pwUser.username}
            </div>

            <label style={{ fontSize: "12px", color: "#776a50" }}>
              كلمة السر الجديدة (6 أحرف على الأقل)
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") changePassword(); }}
                autoFocus
                style={{
                  display: "block", width: "100%", marginTop: "6px", padding: "9px 12px",
                  borderRadius: "8px", border: `1px solid ${borderCol}`,
                  background: "rgba(255,255,255,0.04)", color: "#e2d9c0", fontSize: "13px",
                  direction: "ltr", textAlign: "left", outline: "none", boxSizing: "border-box",
                }}
              />
            </label>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setPwUser(null)}
                style={{
                  background: "transparent", border: `1px solid ${borderCol}`, borderRadius: "8px",
                  color: "#776a50", padding: "8px 18px", cursor: "pointer", fontSize: "12px",
                }}
              >إلغاء</button>
              <button
                onClick={changePassword}
                disabled={loading}
                style={{
                  background: "rgba(96,165,250,0.18)", border: "1px solid rgba(96,165,250,0.5)",
                  borderRadius: "8px", color: "#60a5fa", padding: "8px 18px",
                  cursor: loading ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 700,
                  opacity: loading ? 0.6 : 1,
                }}
              >{loading ? "..." : "تغيير"}</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}
        >
          <div
            style={{
              background: "linear-gradient(145deg, rgba(26,21,40,0.99), rgba(20,16,32,0.99))",
              border: `1px solid ${borderCol}`,
              borderRadius: "16px",
              padding: "28px 32px",
              minWidth: "340px",
              boxShadow: "0 0 60px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ color: gold, fontWeight: "bold", fontSize: "14px", letterSpacing: "2px", marginBottom: "20px" }}>
              تعديل: {editingUser.username}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label style={{ fontSize: "12px", color: "#776a50" }}>
                الدور
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "6px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${borderCol}`,
                    background: "rgba(255,255,255,0.04)",
                    color: "#e2d9c0",
                    fontSize: "13px",
                  }}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </label>

              <label style={{ fontSize: "12px", color: "#776a50" }}>
                الحالة
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "6px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${borderCol}`,
                    background: "rgba(255,255,255,0.04)",
                    color: (STATUS_META[editStatus] || STATUS_META.active).color,
                    fontSize: "13px",
                  }}
                >
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k} style={{ background: "#12100c" }}>{v.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: "12px", color: "#776a50" }}>
                التايرز
                <select
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "6px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${borderCol}`,
                    background: "rgba(255,255,255,0.04)",
                    color: "#e2d9c0",
                    fontSize: "13px",
                  }}
                >
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label style={{ fontSize: "12px", color: "#776a50" }}>
                تاريخ انتهاء الاشتراك
                <input
                  type="date"
                  value={editSubEnd}
                  onChange={(e) => setEditSubEnd(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "6px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${borderCol}`,
                    background: "rgba(255,255,255,0.04)",
                    color: "#e2d9c0",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "22px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "#776a50",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                إلغاء
              </button>
              <button
                onClick={saveUser}
                disabled={loading}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  border: `1px solid rgba(196,164,74,0.4)`,
                  background: "rgba(196,164,74,0.15)",
                  color: gold,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
