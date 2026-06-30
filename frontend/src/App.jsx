import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "./components/application/AppLayout";
import "./styles/app-v1.css"; // v1 / app component classes (.app-*, badges, buttons, patungan)
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { AccountPromptProvider } from "./context/AccountPromptContext";

// website
import LandingPage from "./pages/LandingPage";
import { LoginOrRegister } from "./pages/LoginOrRegister";
import NotFound from "./pages/NotFound";
import SyaratKetentuan from "./pages/legal/SyaratKetentuan";
import KebijakanPrivasi from "./pages/legal/KebijakanPrivasi";

// v1 screens
import { AppHomepage } from "./pages/application/v1/AppHomepage";
import { ArisanPage } from "./pages/application/v1/ArisanPage";
import GroupDetailPage from "./pages/application/v1/GroupDetailPage";
import { BayarPage } from "./pages/application/v1/BayarPage";
import { ProfilPage } from "./pages/application/v1/ProfilPage";
import PatunganPage from "./pages/application/v1/PatunganPage";
import BillDetailPage from "./pages/application/v1/BillDetailPage";

// v2 screens
import HomeDeck from "./pages/application/v2/HomeDeck";
import Notifikasi from "./pages/application/v2/Notifikasi";
import Dompet from "./pages/application/v2/Dompet";
import MembersOrbit from "./pages/application/v2/MembersOrbit";
import GroupDetail from "./pages/application/v2/GroupDetail";
import Profil from "./pages/application/v2/Profil";
import BuktiTransfer from "./pages/application/v2/BuktiTransfer";
import Undang from "./pages/application/v2/Undang";
import GabungMasuk from "./pages/application/v2/GabungMasuk";
import Gabung from "./pages/application/v2/Gabung";
import BuatArisan from "./pages/application/v2/BuatArisan";
import BuatPatungan from "./pages/application/v2/BuatPatungan";
import NotFoundApp from "./pages/application/v2/NotFoundApp";
// v2 secondary screens (Workstream A)
import EditProfil from "./pages/application/v2/EditProfil";
import MetodePembayaran from "./pages/application/v2/MetodePembayaran";
import KeamananPin from "./pages/application/v2/KeamananPin";
import Bantuan from "./pages/application/v2/Bantuan";
import RiwayatTransaksi from "./pages/application/v2/RiwayatTransaksi";
import Onboarding from "./pages/application/v2/Onboarding";
import RekeningPayout from "./pages/application/v2/RekeningPayout";
import Bahasa from "./pages/application/v2/Bahasa";

// ── Landing page shell ────────────────────────────────────────
// "/" renders the marketing landing page. "/login" redirects to the new
// real auth route "/masuk" (kept for any old inbound links).
function LandingShell() {
  return <LandingPage />;
}

// ── ProtectedRoute ────────────────────────────────────────────
// Requires a real authenticated session. Unauthenticated users are
// redirected to /masuk with the originally-requested path preserved as
// `returnTo` in both the query string and location state, so that after
// login the user lands exactly where they intended (invite deep-links work).
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppLoadingScreen />;

  // TEMPORARY: the pre-launch password gate (see LoginOrRegister.jsx) grants
  // access without a real session. Remove this line when the gate is removed.
  if (sessionStorage.getItem("masuk_gate_unlocked") === "1") return children;

  if (!isAuthenticated) {
    // Build the returnTo value from the current path + search.
    const returnTo = location.pathname + location.search;
    return (
      <Navigate
        to={`/masuk?returnTo=${encodeURIComponent(returnTo)}`}
        state={{ returnTo }}
        replace
      />
    );
  }

  return children;
}

// ── Full-screen loading while auth resolves ───────────────────
function AppLoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#10b981]" />
        <p className="text-sm text-gray-400">Memuat...</p>
      </div>
    </div>
  );
}

// ── Skip-to-content link ──────────────────────────────────────
const SkipToContent = () => (
  <a
    href="#main-content"
    className="fixed left-4 top-4 z-9999 -translate-y-16 rounded-lg bg-[#10b981] px-4 py-2 text-white shadow-lg transition-transform duration-200 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
  >
    Langsung ke konten utama
  </a>
);

// ── Scroll-to-top button (landing only) ──────────────────────
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  // Only show on the marketing landing page
  const isLanding = pathname === "/";

  useEffect(() => {
    if (!isLanding) { setIsVisible(false); return; }
    const toggle = () => setIsVisible(window.scrollY > 500);
    window.addEventListener("scroll", toggle, { passive: true });
    return () => window.removeEventListener("scroll", toggle);
  }, [isLanding]);

  if (!isLanding) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#10b981] text-white shadow-lg transition-colors hover:bg-[#0d9e6e] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:ring-offset-2"
          aria-label="Kembali ke atas"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
};

// ── Root app ──────────────────────────────────────────────────
function AppRoutes() {
  return (
    <>
      <SkipToContent />
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingShell />} />
        {/* Real auth page — required login gate (Workstream C4) */}
        <Route path="/masuk" element={<LoginOrRegister />} />
        {/* Legacy /login redirect → /masuk for any old inbound links */}
        <Route path="/login" element={<Navigate to="/masuk" replace />} />

        {/* Public legal pages (linked from the landing footer) */}
        <Route path="/syarat-ketentuan" element={<SyaratKetentuan />} />
        <Route path="/kebijakan-privasi" element={<KebijakanPrivasi />} />

        {/* App routes — all gated behind ProtectedRoute (real login required, C4) */}
        {/* v2 screens: /app, /app/notifikasi, /app/profil, etc. */}
        <Route path="/app" element={<ProtectedRoute><HomeDeck /></ProtectedRoute>} />
        <Route path="/app/notifikasi" element={<ProtectedRoute><Notifikasi /></ProtectedRoute>} />
        <Route path="/app/dompet" element={<ProtectedRoute><Dompet /></ProtectedRoute>} />
        <Route path="/app/anggota" element={<ProtectedRoute><MembersOrbit /></ProtectedRoute>} />
        <Route path="/app/anggota/:id" element={<ProtectedRoute><MembersOrbit /></ProtectedRoute>} />
        <Route path="/app/grup" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
        <Route path="/app/grup/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
        <Route path="/app/profil" element={<ProtectedRoute><Profil /></ProtectedRoute>} />
        <Route path="/app/bukti" element={<ProtectedRoute><BuktiTransfer /></ProtectedRoute>} />
        <Route path="/app/undang" element={<ProtectedRoute><Undang /></ProtectedRoute>} />
        <Route path="/app/undang/:id" element={<ProtectedRoute><Undang /></ProtectedRoute>} />
        <Route path="/app/gabung" element={<ProtectedRoute><GabungMasuk /></ProtectedRoute>} />
        <Route path="/app/gabung/preview" element={<ProtectedRoute><Gabung /></ProtectedRoute>} />
        
        {/* Legacy / supporting routes — unchanged */}
        <Route path="/app/arisan" element={<ProtectedRoute><ArisanPage /></ProtectedRoute>} />
        <Route path="/app/arisan/buat" element={<ProtectedRoute><BuatArisan /></ProtectedRoute>} />
        <Route path="/app/buat-arisan" element={<ProtectedRoute><BuatArisan /></ProtectedRoute>} />
        <Route path="/app/arisan/:id" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
        <Route path="/app/bayar" element={<ProtectedRoute><BayarPage /></ProtectedRoute>} />
        <Route path="/app/analitik" element={<ProtectedRoute><AppHomepage /></ProtectedRoute>} />
        <Route path="/app/patungan" element={<ProtectedRoute><AppLayout title="Patungan"><PatunganPage /></AppLayout></ProtectedRoute>} />
        <Route path="/app/patungan/buat" element={<ProtectedRoute><BuatPatungan /></ProtectedRoute>} />
        <Route path="/app/patungan/rutin" element={<ProtectedRoute><AppLayout title="Patungan"><PatunganPage /></AppLayout></ProtectedRoute>} />
        <Route path="/app/patungan/:billId" element={<ProtectedRoute><BillDetailPage /></ProtectedRoute>} />

        {/* ── Workstream A: secondary profil pages ── */}
        <Route path="/app/profil/edit"       element={<ProtectedRoute><EditProfil /></ProtectedRoute>} />
        <Route path="/app/profil/pembayaran" element={<ProtectedRoute><MetodePembayaran /></ProtectedRoute>} />
        <Route path="/app/profil/keamanan"   element={<ProtectedRoute><KeamananPin /></ProtectedRoute>} />
        <Route path="/app/profil/bantuan"    element={<ProtectedRoute><Bantuan /></ProtectedRoute>} />
        <Route path="/app/profil/rekening"   element={<ProtectedRoute><RekeningPayout /></ProtectedRoute>} />
        <Route path="/app/profil/bahasa"     element={<ProtectedRoute><Bahasa /></ProtectedRoute>} />
        {/* ── Workstream A: standalone screens ── */}
        <Route path="/app/riwayat"           element={<ProtectedRoute><RiwayatTransaksi /></ProtectedRoute>} />
        <Route path="/app/onboarding"        element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

        {/* In-app 404 — any unknown /app/* path, still behind the access gate */}
        <Route path="/app/*" element={<ProtectedRoute><NotFoundApp /></ProtectedRoute>} />

        {/* Dev-only unguarded routes for headless screenshot capture at 390×844.
            No auth, no AppLayout — each screen renders standalone / full-viewport.
            Exact slugs required by scripts/screenshot-app.mjs. */}
        {import.meta.env.DEV && (
          <>
            <Route path="/screens/beranda"     element={<HomeDeck />} />
            <Route path="/screens/beranda-kosong" element={<HomeDeck cards={[]} />} />
            <Route path="/screens/notifikasi"  element={<Notifikasi />} />
            <Route path="/screens/dompet"      element={<Dompet />} />
            <Route path="/screens/anggota"     element={<MembersOrbit />} />
            <Route path="/screens/grup"        element={<GroupDetail />} />
            <Route path="/screens/profil"      element={<Profil />} />
            <Route path="/screens/buat-arisan"   element={<BuatArisan />} />
            <Route path="/screens/buat-patungan" element={<BuatPatungan />} />
            <Route path="/screens/bukti"         element={<BuktiTransfer />} />
          </>
        )}

        {/* Fallback — marketing 404 for any unknown public route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ScrollToTop />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AccountPromptProvider>
          <AppRoutes />
        </AccountPromptProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
