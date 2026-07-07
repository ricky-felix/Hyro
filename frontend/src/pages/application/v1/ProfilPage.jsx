import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../../components/application/AppLayout";
import Icon from "../../../components/application/Icon";
import Avatar from "../../../components/application/v1/Avatar";
import { useToast } from "../../../context/ToastContext";
import { useAuth, useAccountPrompt } from "./mockData";

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: on ? "var(--emerald)" : "var(--line)", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

function SettingRow({ ico, label, sub, iconBg, iconColor, children, onClick }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", width: onClick ? "100%" : undefined, textAlign: onClick ? "left" : undefined, background: "none", border: "none", cursor: onClick ? "pointer" : "default", fontFamily: "inherit" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: iconBg || "var(--lavender-tint)", color: iconColor || "var(--lavender)", display: "grid", placeItems: "center" }}>
        <Icon name={ico} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>{sub}</div>}
      </div>
      {children}
    </Wrapper>
  );
}

function SettingsGroup({ children }) {
  return <div className="app-card" style={{ padding: 0, overflow: "hidden", marginBottom: 16, display: "flex", flexDirection: "column" }}>{children}</div>;
}
function Divider() { return <div style={{ height: 1, background: "var(--line-soft)", marginLeft: 64 }} />; }

export function ProfilPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { profile, updateProfile, isAnonymous, signOut } = useAuth();
  const { promptRegister } = useAccountPrompt();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch { /* ignore */ }
    // Full reload back to the landing page; AuthProvider will bootstrap a
    // fresh anonymous guest session on next app visit.
    window.location.href = "/";
  };
  const [notifPrefs, setNotifPrefs] = useState({ bill: true, conf: true, marketing: false });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({ name: profile.name || "", phone: profile.phone || "" });
  }, [profile]);

  const displayName = profile?.name || "Tamu";

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await updateProfile({ name: form.name.trim(), phone: form.phone.trim() || null });
      toast("Profil disimpan", "success");
      setEditing(false);
    } catch (e) {
      toast(e.message || "Gagal menyimpan", "error");
    } finally { setSaving(false); }
  };

  return (
    <AppLayout title="Profil & Pengaturan">
      <div className="app-scroll" style={{ padding: "16px 16px 40px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        <div className="hidden md:block mb-6">
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Profil & Pengaturan</h1>
        </div>

        {/* Profile card */}
        <div className="app-card" style={{ padding: 18, marginBottom: 20 }}>
          {!editing ? (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Avatar name={displayName} size="xl" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{displayName}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon name="phone" size={12} /> {profile?.phone || "Belum diisi"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>Mode tamu · data tersimpan di akun perangkat ini</div>
              </div>
              <button className="app-btn btn-secondary" style={{ padding: "8px 12px", fontSize: 12, flexShrink: 0 }} onClick={() => setEditing(true)}>
                <Icon name="edit" size={14} /> Edit
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
                <Avatar name={form.name || "?"} size="xl" />
                <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Nama ini muncul di arisan &amp; patungan yang Anda buat.</div>
              </div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nama</label>
              <input className="app-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama Anda" style={{ marginBottom: 12 }} />
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nomor HP (opsional)</label>
              <input className="app-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+62 812-3456-7890" style={{ marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="app-btn btn-secondary" style={{ flex: 1 }} onClick={() => { setEditing(false); setForm({ name: profile?.name || "", phone: profile?.phone || "" }); }}>Batal</button>
                <button className="app-btn btn-primary" style={{ flex: 1, opacity: !form.name.trim() || saving ? 0.5 : 1 }} disabled={!form.name.trim() || saving} onClick={save}>{saving ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </div>
          )}
        </div>

        {/* Save-account card (anonymous users) */}
        {isAnonymous && (
          <div className="app-card" style={{ padding: 16, marginBottom: 20, background: "var(--emerald-tint)", borderColor: "var(--emerald-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--emerald)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="lock" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Simpan akunmu</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)" }}>Daftar agar datamu aman & bisa dibuka di perangkat lain. Sudah punya akun? Masuk di sini.</div>
              </div>
            </div>
            <button className="app-btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => promptRegister("Daftar agar arisan & patunganmu tersimpan dan bisa diakses di perangkat lain.")}>
              Daftar / Masuk
            </button>
          </div>
        )}

        {/* Notifications */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px 4px" }}>Notifikasi</div>
        <SettingsGroup>
          <SettingRow ico="bell" label="Tagihan baru" sub="Pemberitahuan saat ada tagihan iuran">
            <Toggle on={notifPrefs.bill} onChange={(v) => setNotifPrefs((p) => ({ ...p, bill: v }))} />
          </SettingRow>
          <Divider />
          <SettingRow ico="check-circle" label="Konfirmasi pembayaran" sub="Saat pembayaran dikonfirmasi/ditolak" iconBg="var(--emerald-tint)" iconColor="var(--emerald-dark)">
            <Toggle on={notifPrefs.conf} onChange={(v) => setNotifPrefs((p) => ({ ...p, conf: v }))} />
          </SettingRow>
          <Divider />
          <SettingRow ico="sparkles" label="Promo & info" sub="Update fitur dan penawaran" iconBg="var(--lavender-soft)" iconColor="var(--lavender)">
            <Toggle on={notifPrefs.marketing} onChange={(v) => setNotifPrefs((p) => ({ ...p, marketing: v }))} />
          </SettingRow>
        </SettingsGroup>

        {/* Account */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px 4px" }}>Akun</div>
        <SettingsGroup>
          <SettingRow ico="logout" label="Keluar" sub={isAnonymous ? "Akhiri sesi tamu & kembali ke halaman utama" : "Keluar dari akun ini"} iconBg="var(--danger-soft)" iconColor="var(--danger)" onClick={handleSignOut}>
            <Icon name="chevron-right" size={16} style={{ color: "var(--ink-3)" }} />
          </SettingRow>
        </SettingsGroup>

        {/* About */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px 4px" }}>Tentang</div>
        <SettingsGroup>
          <SettingRow ico="globe" label="Buka Website" sub="Kunjungi halaman utama Hyro" iconBg="var(--emerald-tint)" iconColor="var(--emerald-dark)" onClick={() => navigate("/")}>
            <Icon name="chevron-right" size={16} style={{ color: "var(--ink-3)" }} />
          </SettingRow>
          <Divider />
          <SettingRow ico="info" label="Versi WebApp" sub="MVP · Hyro" iconBg="var(--gray-soft)" iconColor="var(--ink-2)" />
          <Divider />
          <SettingRow ico="link" label="Syarat & Ketentuan" iconBg="var(--gray-soft)" iconColor="var(--ink-2)" onClick={() => {}}>
            <Icon name="chevron-right" size={16} style={{ color: "var(--ink-3)" }} />
          </SettingRow>
          <Divider />
          <SettingRow ico="lock" label="Kebijakan Privasi" iconBg="var(--gray-soft)" iconColor="var(--ink-2)" onClick={() => {}}>
            <Icon name="chevron-right" size={16} style={{ color: "var(--ink-3)" }} />
          </SettingRow>
        </SettingsGroup>

        <div style={{ textAlign: "center", padding: "8px 0 20px", fontSize: 12, color: "var(--ink-3)" }}>
          Hyro · Dibuat untuk komunitas Indonesia 🇮🇩
        </div>
      </div>
    </AppLayout>
  );
}

export default ProfilPage;
