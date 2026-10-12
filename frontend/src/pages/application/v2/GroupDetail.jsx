import { useNavigate, useParams } from "react-router-dom";
import "../../../styles/app-v2.css";
import { useToast } from "../../../context/ToastContext";
import { useGroupDetail } from "../../../hooks/useGroupDetail";
import GroupHeader from "../../../components/application/v2/grup/GroupHeader";
import GroupHero from "../../../components/application/v2/grup/GroupHero";
import ProgressIuran from "../../../components/application/v2/grup/ProgressIuran";
import RecipientCard from "../../../components/application/v2/grup/RecipientCard";
import GiliranTimeline from "../../../components/application/v2/grup/GiliranTimeline";
import MemberStatusList from "../../../components/application/v2/grup/MemberStatusList";
import PayButton from "../../../components/application/v2/grup/PayButton";
import PayFooter from "../../../components/application/v2/grup/PayFooter";

export default function GroupDetail() {
  const navigate = useNavigate();
  const toast = useToast();
  // Route may include /app/grup/:id — fall back to null so the hook picks the first group.
  const { id: groupId } = useParams();

  const { group, stats, progress, recipient, giliran, members, loading, error } =
    useGroupDetail(groupId ?? null);

  const viewMembers = () => navigate("/app/anggota");
  const pay = () => toast(`Memproses pembayaran ${group.payAmount}…`);

  // Real mode with no group to show (no groups yet, or it failed to load and
  // isn't in the offline cache). Demo mode always has the mockup group.
  if (!group) {
    return (
      <div className="v2-screen">
        <div className="v2-inner overflow-y-auto">
          <GroupHeader title="Grup" onBack={() => navigate(-1)} />
          {loading ? (
            <div className="w-full h-0.5 bg-line-soft overflow-hidden">
              <div className="h-full w-1/2 bg-brand-primary animate-pulse" />
            </div>
          ) : (
            <div className="mx-auto flex max-w-140 flex-col items-center gap-3 px-5 py-16 text-center">
              <div className="text-4xl" aria-hidden="true">{error ? "📡" : "👥"}</div>
              <div className="text-[15px] font-semibold text-ink-2">
                {error
                  ? "Gagal memuat grup. Cek koneksi kamu, lalu coba lagi."
                  : "Kamu belum gabung grup arisan. Bikin grup baru atau gabung lewat undangan."}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="v2-screen">
      <div className="v2-inner overflow-y-auto">

        <GroupHeader title={group.name} sub={group.headerSub} onBack={() => navigate(-1)} />

        {/* Loading skeleton — thin progress bar at the top while fetching */}
        {loading && (
          <div className="w-full h-0.5 bg-line-soft overflow-hidden">
            <div className="h-full w-1/2 bg-brand-primary animate-pulse" />
          </div>
        )}

        {/* Error banner — the group shown comes from the offline cache */}
        {error && !loading && (
          <div className="mx-5 mt-3 rounded-lg bg-yellow-50 border border-yellow-200 px-3.5 py-2.5 text-[12px] text-yellow-800">
            Lagi gak bisa ambil data terbaru — menampilkan data terakhir yang tersimpan.
          </div>
        )}

        {/* Mobile: single stacked column. Desktop (lg): two columns filling a wide
            centered container — summary on the left, member list on the right. */}
        <div className="mx-auto grid w-full max-w-140 flex-1 grid-cols-1 gap-4 px-5 pb-5
                        lg:max-w-300 lg:grid-cols-2 lg:items-start lg:gap-7 lg:px-8 lg:py-6">

          {/* Left column — summary + (desktop-only) pay action */}
          <div className="flex flex-col gap-4 lg:gap-5">
            <GroupHero group={group} stats={stats} />
            <ProgressIuran progress={progress} />
            <RecipientCard recipient={recipient} onClick={viewMembers} />
            <GiliranTimeline items={giliran} />
            <div className="hidden lg:block">
              <PayButton label={group.payLabel} onPay={pay} />
            </div>
          </div>

          {/* Right column — members & status */}
          <div className="flex flex-col gap-4">
            <MemberStatusList members={members} count={group.memberCount} onViewAll={viewMembers} />
          </div>

        </div>

        {/* Mobile sticky pay bar (hidden on desktop via lg:hidden inside PayFooter) */}
        <PayFooter label={group.payLabel} onPay={pay} />

      </div>
    </div>
  );
}
