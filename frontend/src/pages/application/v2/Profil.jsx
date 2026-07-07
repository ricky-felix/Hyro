import { useNavigate } from "react-router-dom";
import "../../../styles/app-v2.css";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import {
  UserSingle,
  Card,
  Lock,
  Bell,
  Globe,
  HelpCircle,
  Replay,
  LogOut,
  WalletRounded,
} from "../../../components/application/v2/icons";
import ProfileHero from "../../../components/application/v2/profil/ProfileHero";
import StatsCard from "../../../components/application/v2/profil/StatsCard";
import MenuRow from "../../../components/application/v2/profil/MenuRow";
import MenuSection from "../../../components/application/v2/profil/MenuSection";

export default function Profil() {
  const navigate = useNavigate();
  const toast = useToast();
  const { logout, profile, user } = useAuth();

  // All users are now authenticated — no anonymous branches.
  // Display name falls back to "Pengguna" if the DB profile hasn't loaded yet.
  const name = profile?.name?.trim() || "";
  const displayName = name || "Pengguna";
  // Show phone from profile if available, otherwise show email from auth user.
  const displayPhone = profile?.phone || user?.email || "";

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore — redirect regardless */
    }
    navigate("/masuk");
  };

  // Clear the coach-mark flag (same key HomeDeck reads) then jump to the deck
  // so the guided tour replays from the top.
  const handleReplayTutorial = () => {
    try {
      localStorage.removeItem("arisan.v2.coachSeen");
    } catch {
      /* private mode — nothing to clear */
    }
    navigate("/app");
  };

  return (
    <div className="v2-screen">
      <div className="v2-inner" style={{ overflowY: "auto" }}>

        <ProfileHero
          name={displayName}
          phone={displayPhone}
          joined="Bergabung sejak Januari 2024"
          onBack={() => navigate("/app")}
          onEdit={() => navigate("/app/profil/edit")}
        />

        {/* Past phone width the content collapses to a single centered column.
            Explicit lg:w-[620px] (not just max-w) so the column keeps a definite
            width as a flex child of .v2-inner — with mx-auto, a content-sized
            flex item would otherwise shrink and never reach 620px. */}
        <div className="lg:mx-auto lg:flex lg:w-[620px] lg:max-w-[620px] lg:flex-col lg:pb-12">

          <StatsCard />

          {/* Menu sections */}
          <div className="flex flex-col gap-5 px-5 pb-8 min-[481px]:mx-auto min-[481px]:max-w-[600px] min-[481px]:px-6 lg:mx-0 lg:w-full lg:max-w-none lg:px-0">

            {/* Akun */}
            <MenuSection title="Akun">
              <MenuRow
                icon={<UserSingle size={17} strokeWidth={2} />}
                tileClass="em"
                label="Edit Profil"
                sub="Nama, foto, nomor HP"
                onClick={() => navigate("/app/profil/edit")}
              />
              <MenuRow
                icon={<Card size={17} strokeWidth={2} />}
                tileClass="lv"
                label="Metode Pembayaran"
                sub="Dompet grup & transfer langsung"
                onClick={() => navigate("/app/profil/pembayaran")}
              />
              <MenuRow
                icon={<Lock size={17} strokeWidth={2} />}
                tileClass="em"
                label="Keamanan & PIN"
                sub="Ubah PIN, sidik jari"
                onClick={() => navigate("/app/profil/keamanan")}
              />
              <MenuRow
                icon={<WalletRounded size={17} strokeWidth={2} />}
                tileClass="lv"
                label="Riwayat Transaksi"
                sub="Semua iuran & patunganmu"
                onClick={() => navigate("/app/riwayat")}
              />
            </MenuSection>

            {/* WebApp */}
            <MenuSection title="WebApp">
              <MenuRow
                icon={<Bell size={17} strokeWidth={2} />}
                tileClass="lv"
                label="Notifikasi"
                sub="Pengingat iuran arisan & tagihan"
                onClick={() => navigate("/app/notifikasi")}
              />
              <MenuRow
                icon={<Globe size={17} strokeWidth={2} />}
                tileClass="gray"
                label="Bahasa"
                sub="Bahasa Indonesia"
                onClick={() => navigate("/app/profil/bahasa")}
              />
              <MenuRow
                icon={<HelpCircle size={17} strokeWidth={2} />}
                tileClass="gray"
                label="Bantuan"
                sub="FAQ & hubungi kami"
                onClick={() => navigate("/app/profil/bantuan")}
              />
              <MenuRow
                icon={<Replay size={17} strokeWidth={2} />}
                tileClass="em"
                label="Lihat Ulang Tutorial"
                sub="Putar ulang panduan beranda"
                onClick={handleReplayTutorial}
              />
            </MenuSection>

            {/* Keluar — no section label, no trailing chevron */}
            <MenuSection>
              <MenuRow
                icon={<LogOut size={17} strokeWidth={2} />}
                tileClass=""
                label="Keluar"
                danger
                onClick={handleLogout}
              />
            </MenuSection>

            <div className="mt-1 pb-2 text-center text-[11px] font-medium text-ink-3">
              Hyro v1.0.0
            </div>
          </div>

        </div>{/* end centered content column */}

      </div>
    </div>
  );
}
