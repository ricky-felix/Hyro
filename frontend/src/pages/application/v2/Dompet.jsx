import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/app-v2.css";
import { Users, Split, Wallet } from "../../../components/application/v2/icons";
import ScreenHeader from "../../../components/application/v2/ScreenHeader";
import WalletCard from "../../../components/application/v2/dompet/WalletCard";
import PanelRow from "../../../components/application/v2/dompet/PanelRow";
import { useDompet } from "../../../hooks/useDompet";

export default function Dompet() {
  const navigate = useNavigate();
  const [open, setOpen] = useState({ arisan: true, patungan: false, dompet: false });

  // Mockup cards in demo mode; live data (or blank cards) in real mode.
  const {
    arisanCard, patunganCard, dompetCard,
    arisanRows, patunganRows, dompetRows,
    loading, error,
  } = useDompet();

  function toggle(key) {
    setOpen(s => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div className="v2-screen v2-dompet">
      <div className="v2-inner overflow-y-auto">

        {/* Header */}
        <ScreenHeader title="Dompet Saya" onBack={() => navigate("/app")} />

        {/* Loading indicator */}
        {loading && (
          <div className="w-full h-0.5 bg-line-soft overflow-hidden">
            <div className="h-full w-1/3 bg-brand-primary animate-pulse" />
          </div>
        )}

        {/* Error banner — live data failed to load */}
        {error && !loading && (
          <div className="mx-5 mt-3 mb-1 rounded-lg bg-yellow-50 border border-yellow-200 px-3.5 py-2.5 text-[12px] text-yellow-800">
            Gagal memuat data. Cek koneksi kamu, lalu coba lagi.
          </div>
        )}

        {/* ── Wallet cards grid (single column on mobile, multi-column on desktop) ── */}
        <div className="wallet-cards-grid">

          {/* ── Arisan card ── */}
          <WalletCard
            {...arisanCard}
            icon={<Users size={18} stroke="white" strokeWidth={2} />}
            open={open.arisan}
            onToggle={() => toggle("arisan")}
          >
            {/* Live rows from API; fall back to static rows when empty */}
            {arisanRows.length > 0 ? (
              arisanRows.map(row => (
                <PanelRow
                  key={row.id}
                  icon={<Users size={18} stroke="var(--emerald-dark)" strokeWidth={2} />}
                  iconClass="em"
                  name={row.name}
                  meta={row.meta}
                  fillClass="em"
                  fillWidth={row.fillWidth}
                  amount={row.amount}
                  amountClass="em"
                  badge={row.badge}
                  onClick={() => navigate(`/app/grup/${row.id}`)}
                />
              ))
            ) : (
              /* Static fallback rows — shown while loading or when user has no groups */
              <>
                <PanelRow
                  icon={<Users size={18} stroke="var(--emerald-dark)" strokeWidth={2} />}
                  iconClass="em"
                  name="Belum ada grup arisan"
                  meta="Bikin grup baru atau gabung lewat undangan"
                  fillClass="em"
                  fillWidth="0%"
                  amount="—"
                  amountClass="em"
                  badge={null}
                />
              </>
            )}
          </WalletCard>

          {/* ── Patungan card ── */}
          <WalletCard
            {...patunganCard}
            icon={<Split size={18} stroke="white" strokeWidth={2} />}
            open={open.patungan}
            onToggle={() => toggle("patungan")}
          >
            {patunganRows.length > 0 ? (
              patunganRows.map(row => (
                <PanelRow
                  key={row.id}
                  icon="🧾"
                  iconClass={row.settled ? "grey" : "lv"}
                  name={row.name}
                  meta={row.meta}
                  fillClass={row.settled ? "grey" : "lv"}
                  fillWidth={row.fillWidth}
                  amount={row.amount}
                  amountClass={row.settled ? "neutral" : "lv"}
                  badge={row.badge}
                  rowClass={row.settled ? "settled" : undefined}
                />
              ))
            ) : (
              <PanelRow
                icon="🧾"
                iconClass="lv"
                name="Belum ada tagihan"
                meta="Buat tagihan patungan baru lewat tombol +"
                fillClass="lv"
                fillWidth="0%"
                amount="—"
                amountClass="lv"
                badge={null}
              />
            )}
          </WalletCard>

          {/* ── Dompet Grup card ── */}
          <WalletCard
            {...dompetCard}
            icon={<Wallet size={18} stroke="white" strokeWidth={2} />}
            open={open.dompet}
            onToggle={() => toggle("dompet")}
          >
            {dompetRows.length > 0 ? (
              dompetRows.map(row => (
                <PanelRow
                  key={row.id}
                  icon={<Wallet size={18} stroke="#0f766e" strokeWidth={2} />}
                  iconClass="teal"
                  name={row.name}
                  meta={row.meta}
                  fillClass="teal"
                  fillWidth={row.fillWidth}
                  amount={row.amount}
                  amountClass="teal"
                  badge={row.badge}
                  onClick={() => navigate(`/app/anggota`)}
                />
              ))
            ) : (
              <PanelRow
                icon={<Wallet size={18} stroke="#0f766e" strokeWidth={2} />}
                iconClass="teal"
                name="Belum ada dompet grup aktif"
                meta="Dompet grup terbentuk saat arisan berjalan"
                fillClass="teal"
                fillWidth="0%"
                amount="—"
                amountClass="teal"
                badge={null}
              />
            )}
          </WalletCard>

        </div>{/* end wallet-cards-grid */}

        <div className="h-8" />
      </div>
    </div>
  );
}
