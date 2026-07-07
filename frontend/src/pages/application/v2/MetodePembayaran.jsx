import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/app-v2.css";
import { useToast } from "../../../context/ToastContext";
import { paymentMethodsService } from "../../../services";
import { Plus } from "../../../components/application/v2/icons";
import ScreenHeader from "../../../components/application/v2/ScreenHeader";
import MethodCard from "../../../components/application/v2/metodePembayaran/MethodCard";
import MethodForm from "../../../components/application/v2/metodePembayaran/MethodForm";
import DeleteConfirmModal from "../../../components/application/v2/metodePembayaran/DeleteConfirmModal";

/**
 * MetodePembayaran — Phase 2 rewrite.
 *
 * Replaced the v0 string[] chip-toggle with a full per-method CRUD management screen.
 * Each method stores real account details (account_number / phone / holder_name)
 * so group members can pay the user directly without asking for details.
 *
 * Data contract: PRD-payment-methods.md §6 (backend built concurrently from same PRD).
 * Compliance: text labels only — no logos; no funds handling; QRIS display-only (Phase 4).
 */

// ── Legacy format detection helper (PRD §5 Backward Compatibility) ───────────
function isLegacyFormat(paymentMethods) {
  return (
    Array.isArray(paymentMethods) &&
    paymentMethods.length > 0 &&
    typeof paymentMethods[0] === "string"
  );
}

export default function MetodePembayaran() {
  const navigate = useNavigate();
  const toast = useToast();

  // ── Screen state ──────────────────────────────────────────────────────────
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Legacy data migration banner
  const [showLegacyBanner, setShowLegacyBanner] = useState(false);

  // Form sheet
  const [formOpen, setFormOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null); // null = add mode
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirm modal
  const [deletingMethod, setDeletingMethod] = useState(null); // null = hidden
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  // ── Load methods on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadMethods() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await paymentMethodsService.listMy();

        if (cancelled) return;

        // Detect v0 legacy format (bare string array like ["qris","gopay"])
        if (isLegacyFormat(data)) {
          // Backend should convert on read (PRD §5), but handle gracefully on frontend too.
          setShowLegacyBanner(true);
          setMethods([]); // Treat as empty until user migrates
        } else {
          setMethods(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[MetodePembayaran] load failed:", err.message);
        setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMethods();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Add / Edit handlers ───────────────────────────────────────────────────
  function openAdd() {
    setEditingMethod(null);
    setFormOpen(true);
  }

  function openEdit(method) {
    setEditingMethod(method);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingMethod(null);
  }

  async function handleFormSave(dto) {
    setFormSaving(true);
    try {
      if (editingMethod) {
        // Edit — PUT /users/me/payment-methods/{id}
        // type is excluded from the update DTO (immutable per PRD §3 Story 2)
        const { type: _type, ...updateDto } = dto;
        const updated = await paymentMethodsService.update(editingMethod.id, updateDto);
        setMethods((prev) =>
          prev.map((m) => (m.id === editingMethod.id ? { ...m, ...updated } : m))
        );
        // If is_primary was set, demote all others (backend does authoritative demotion,
        // but we also update local state optimistically)
        if (updated.is_primary) {
          setMethods((prev) =>
            prev.map((m) =>
              m.id === editingMethod.id ? { ...m, ...updated } : { ...m, is_primary: false }
            )
          );
        }
        toast("Metode pembayaran diperbarui ✓");
      } else {
        // Add — POST /users/me/payment-methods
        const created = await paymentMethodsService.create(dto);
        // If this new method is primary, demote all previous ones locally
        if (created.is_primary) {
          setMethods((prev) => [
            ...prev.map((m) => ({ ...m, is_primary: false })),
            created,
          ]);
        } else {
          setMethods((prev) => [...prev, created]);
        }
        toast("Metode pembayaran disimpan ✓");
      }
      closeForm();
    } catch (err) {
      console.error("[MetodePembayaran] save failed:", err.message);
      toast("Gagal menyimpan: " + err.message, "error");
      // Keep form open so user can retry
    } finally {
      setFormSaving(false);
    }
  }

  // ── Delete handlers ───────────────────────────────────────────────────────
  function openDelete(method) {
    setDeletingMethod(method);
  }

  function closeDelete() {
    setDeletingMethod(null);
  }

  async function handleDeleteConfirm() {
    if (!deletingMethod) return;
    setDeleteInProgress(true);
    try {
      // DELETE /users/me/payment-methods/{id}
      await paymentMethodsService.delete(deletingMethod.id);
      setMethods((prev) => {
        const remaining = prev.filter((m) => m.id !== deletingMethod.id);
        // If deleted method was primary and others remain, promote the oldest (first) one
        const wasPrimary = deletingMethod.is_primary;
        if (wasPrimary && remaining.length > 0 && !remaining.some((m) => m.is_primary)) {
          return remaining.map((m, i) => (i === 0 ? { ...m, is_primary: true } : m));
        }
        return remaining;
      });
      toast("Metode pembayaran dihapus");
      closeDelete();
    } catch (err) {
      console.error("[MetodePembayaran] delete failed:", err.message);
      toast("Gagal menghapus: " + err.message, "error");
    } finally {
      setDeleteInProgress(false);
    }
  }

  // ── Set primary handler ───────────────────────────────────────────────────
  async function handleSetPrimary(method) {
    // Optimistic update
    const prev = methods;
    setMethods((cur) =>
      cur.map((m) => ({ ...m, is_primary: m.id === method.id }))
    );
    try {
      // PUT /users/me/payment-methods/{id} with is_primary: true
      // Backend demotes all others automatically
      await paymentMethodsService.update(method.id, { is_primary: true });
      toast(`${method.label} dijadikan metode utama ✓`);
    } catch (err) {
      // Roll back optimistic update
      setMethods(prev);
      console.error("[MetodePembayaran] set primary failed:", err.message);
      toast("Gagal mengubah metode utama: " + err.message, "error");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="v2-screen">
      <div className="v2-inner" style={{ overflowY: "auto" }}>

        {/* ── Sticky header ── */}
        <ScreenHeader title="Metode Pembayaran" onBack={() => navigate("/app/profil")}>
          {loading && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-secondary"
              aria-hidden="true"
            />
          )}
        </ScreenHeader>

        {/* ── Content column ── */}
        <div className="mx-auto w-full max-w-[480px] px-5 py-6 lg:max-w-[600px] lg:px-6">

          <p className="text-[15px] font-extrabold tracking-[-0.01em] text-ink-1">
            Cara kamu menerima pembayaran
          </p>
          <p className="mt-1 mb-5 text-[13px] font-medium leading-relaxed text-ink-3">
            Tambahkan e-wallet agar anggota grup tahu cara membayarmu — tanpa perlu tanya lagi.
          </p>

          {/* ── Legacy migration banner (v0 → v1) ── */}
          {showLegacyBanner && (
            <div className="mb-5 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-[13px] font-bold text-amber-800">
                Format metode pembayaran telah diperbarui
              </p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-amber-700">
                Kami perbarui format metode pembayaran. Silakan tambahkan detail akun untuk setiap metode yang kamu terima.
              </p>
              <button
                type="button"
                onClick={() => setShowLegacyBanner(false)}
                className="mt-2 text-[12px] font-bold text-amber-800 underline"
              >
                Mengerti
              </button>
            </div>
          )}

          {/* ── Loading state ── */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[76px] animate-pulse rounded-[16px] bg-gray-soft"
                />
              ))}
            </div>
          ) : loadError ? (
            /* ── Error state ── */
            <div className="rounded-[16px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-5 text-center">
              <p className="text-[13px] font-semibold text-[var(--danger)]">
                Gagal memuat metode pembayaran
              </p>
              <p className="mt-1 text-[12px] text-ink-3">{loadError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 rounded-[10px] bg-[var(--danger)] px-4 py-2 text-[12px] font-bold text-white"
              >
                Coba Lagi
              </button>
            </div>
          ) : methods.length === 0 ? (
            /* ── Empty state ── */
            <div className="rounded-[16px] border border-dashed border-line bg-surface px-5 py-8 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-[14px] bg-brand-secondary-soft">
                <Plus size={22} strokeWidth={2.5} className="text-brand-secondary-dark" />
              </div>
              <p className="text-[14px] font-bold text-ink-1">Belum ada metode pembayaran</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-ink-3">
                Tambahkan satu untuk memudahkan pembayaran dari anggota grup.
              </p>
            </div>
          ) : (
            /* ── Methods list ── */
            <div className="space-y-3">
              {methods.map((method) => (
                <MethodCard
                  key={method.id}
                  method={method}
                  onEdit={openEdit}
                  onDelete={openDelete}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          )}

          {/* ── Add button ── */}
          {!loading && !loadError && (
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-brand-secondary/30 bg-brand-secondary-tint py-4 text-[13px] font-bold text-brand-secondary-dark transition-colors hover:border-brand-secondary/60 hover:bg-brand-secondary-soft"
            >
              <Plus size={16} strokeWidth={2.5} />
              Tambah Metode Pembayaran
            </button>
          )}

          {/* ── Compliance info note (kept from v0; PRD §⚖️) ── */}
          <div className="mt-8 rounded-[14px] bg-brand-secondary-soft/50 px-4 py-3.5">
            <p className="text-[12px] font-semibold leading-relaxed text-brand-secondary-dark">
              Hyro tidak menyimpan uangmu. Metode pembayaran dipakai hanya untuk memudahkan konfirmasi antar anggota grup — transfernya tetap langsung antarmu dan anggota lain.
            </p>
          </div>

        </div>
      </div>

      {/* ── Add/Edit form sheet ── */}
      {formOpen && (
        <MethodForm
          initial={editingMethod}
          onSave={handleFormSave}
          onCancel={closeForm}
          saving={formSaving}
        />
      )}

      {/* ── Delete confirm modal ── */}
      {deletingMethod && (
        <DeleteConfirmModal
          method={deletingMethod}
          onConfirm={handleDeleteConfirm}
          onCancel={closeDelete}
          deleting={deleteInProgress}
        />
      )}
    </div>
  );
}
