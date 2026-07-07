import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import Icon from "./Icon";
import Avatar from "./v1/Avatar";
import SaveAccountBanner from "./v1/SaveAccountBanner";

const NAV = [
  { id: "dashboard", label: "Beranda",    icon: "home",    path: "/app" },
  { id: "arisan",    label: "Arisan",     icon: "users",   path: "/app/arisan", module: "arisan" },
  { id: "patungan",  label: "Patungan",   icon: "split",   path: "/app/patungan", module: "patungan" },
  { id: "notifs",    label: "Notifikasi", icon: "bell",    path: "/app/notifikasi", pip: 3 },
  { id: "profile",   label: "Profil",     icon: "user",    path: "/app/profil" },
];

function getActive(pathname) {
  if (pathname === "/app") return "dashboard";
  if (pathname.startsWith("/app/arisan")) return "arisan";
  if (pathname.startsWith("/app/patungan")) return "patungan";
  if (pathname.startsWith("/app/notifikasi")) return "notifs";
  if (pathname.startsWith("/app/profil")) return "profile";
  if (pathname.startsWith("/app/analitik")) return "analytics";
  return "dashboard";
}

export default function AppLayout({ children, title, hideTabbar = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const active = getActive(location.pathname);
  const displayName = profile?.name || "Tamu";
  const firstName = displayName.split(" ")[0];

  return (
    <div className="app-root flex h-svh overflow-hidden" style={{ background: "var(--app-bg)", fontFamily: "var(--font-app)" }}>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex flex-col flex-shrink-0" style={{ width: 260, height: "100vh", position: "sticky", top: 0, background: "#fff", borderRight: "1px solid var(--line-soft)", padding: "20px 14px", overflowY: "auto" }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 20px" }}>
          <img src="/Arisan-Digital-Logo-icon.png" alt="Hyro" style={{ width: 32, height: 32, objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink-1)" }}>Hyro</div>
            <div style={{ color: "var(--ink-2)", fontSize: 11, fontWeight: 500 }}>Halo, {firstName}</div>
          </div>
        </div>
        {/* Nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(n => (
            <div key={n.id} className={`app-nav-item ${active === n.id ? "on" : ""}`} onClick={() => navigate(n.path)}>
              <div style={{ width: 20, height: 20, color: active === n.id ? "var(--emerald-dark)" : "var(--ink-2)", display: "grid", placeItems: "center" }}><Icon name={n.icon} size={18} /></div>
              <div>{n.label}</div>
              {n.pip && <span style={{ marginLeft: "auto", background: "var(--lavender)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 7px" }}>{n.pip}</span>}
            </div>
          ))}
          <div className={`app-nav-item ${active === "analytics" ? "on" : ""}`} onClick={() => navigate("/app/analitik")}>
            <div style={{ width: 20, height: 20, color: active === "analytics" ? "var(--emerald-dark)" : "var(--ink-2)", display: "grid", placeItems: "center" }}><Icon name="trending-up" size={18} /></div>
            <div>Analitik</div>
          </div>
        </div>
        {/* Create CTA */}
        <div style={{ marginTop: "auto", padding: 8 }}>
          <div style={{ background: "linear-gradient(135deg, var(--emerald-tint), var(--lavender-tint))", borderRadius: 14, padding: 14, border: "1px solid var(--emerald-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Icon name="sparkles" size={16} style={{ color: "var(--emerald)" }} />
              <div style={{ fontSize: 13, fontWeight: 700 }}>Buat Arisan Baru</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 10 }}>Atur kelompok arisan dalam 4 langkah.</div>
            <button className="app-btn btn-primary btn-block" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => navigate("/app/arisan/buat")}>
              <Icon name="plus" size={16} /> Mulai
            </button>
          </div>
        </div>
      </aside>

      {/* Right side: topbar + content + mobile nav */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Desktop topbar — hidden on mobile */}
        <header className="hidden md:flex items-center gap-4 flex-shrink-0" style={{ position: "sticky", top: 0, zIndex: 30, height: 64, padding: "0 28px", background: "#fff", borderBottom: "1px solid var(--line-soft)" }}>
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: "var(--ink-1)" }}>{title}</div>
          <div style={{ flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: 10, background: "var(--gray-soft)", borderRadius: 12, padding: "9px 14px", color: "var(--ink-2)" }}>
            <Icon name="search" size={16} />
            <input placeholder="Cari grup, anggota…" style={{ background: "none", outline: "none", border: "none", flex: 1, fontSize: 14, fontFamily: "inherit", color: "var(--ink-1)" }} />
          </div>
          <div style={{ flex: 1 }} />
          <button className="app-icon-btn" style={{ position: "relative" }} onClick={() => navigate("/app/notifikasi")}>
            <Icon name="bell" size={18} />
            <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: "var(--danger)", border: "2px solid #fff" }} />
          </button>
          <button className="app-icon-btn" style={{ padding: 0, overflow: "hidden", border: 0, marginLeft: 8 }} onClick={() => navigate("/app/profil")}>
            <Avatar name={displayName} size="md" />
          </button>
        </header>

        {/* Mobile header — hidden on desktop */}
        <header className="md:hidden flex-shrink-0 flex items-center justify-between" style={{ position: "sticky", top: 0, zIndex: 30, padding: "12px 16px 8px", background: "#fff", borderBottom: "1px solid var(--line-soft)" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Selamat datang kembali</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>Halo, {firstName} 👋</div>
          </div>
          <button className="app-icon-btn" style={{ position: "relative" }} onClick={() => navigate("/app/notifikasi")}>
            <Icon name="bell" size={18} />
            <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: "var(--danger)", border: "2px solid #fff" }} />
          </button>
        </header>

        {/* Deferred-registration nudge (anonymous users with data) */}
        <SaveAccountBanner />

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-hidden flex flex-col">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 overflow-hidden flex flex-col"
          >
            {children}
          </motion.div>
        </main>

        {/* Mobile bottom tab bar — hidden on desktop */}
        {!hideTabbar && (
          <nav className="app-tabbar md:hidden flex-shrink-0">
            {NAV.map(n => (
              <a key={n.id} className={active === n.id ? "on" : ""} onClick={() => navigate(n.path)}>
                <div style={{ width: 24, height: 24, display: "grid", placeItems: "center", position: "relative" }}>
                  <Icon name={n.icon} size={22} />
                  {n.id === "notifs" && <span style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 999, background: "var(--danger)", border: "2px solid #fff" }} />}
                </div>
                <div>{n.label}</div>
              </a>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
