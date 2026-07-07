import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../../styles/app-v2.css";
import PaySheet from "../../../components/application/v2/PaySheet";
import ComposeSheet from "../../../components/application/v2/ComposeSheet";
import CoachMarks from "../../../components/application/v2/CoachMarks";
import PaymentMethodSelector from "../../../components/application/v2/metodePembayaran/PaymentMethodSelector";
import { useToast } from "../../../context/ToastContext";
import { useHomeCards } from "../../../hooks/useGroups";

// First-run coach-mark gate. Defaults to "seen" if storage is unavailable so a
// private-mode visitor is never trapped, and skips the dev /screens/* capture
// routes so headless screenshots stay deterministic.
const COACH_KEY = "arisan.v2.coachSeen";
import { ChevronLeft, ChevronRight } from "../../../components/application/v2/icons";
import { ALL_CARDS } from "../../../components/application/v2/home/data";
import StoryTopBar from "../../../components/application/v2/home/StoryTopBar";
import SegFilter from "../../../components/application/v2/home/SegFilter";
import StoryCard from "../../../components/application/v2/home/StoryCard";
import EmptyCard from "../../../components/application/v2/home/EmptyCard";

// HomeDeck accepts an optional `cards` prop (used by Storybook / screenshot
// routes). When omitted it fetches live data from the API via useHomeCards.
export default function HomeDeck({ cards: cardsProp }) {
  // Live data — falls back to ALL_CARDS on API error (see useHomeCards).
  const { cards: liveCards, loading: cardsLoading } = useHomeCards();
  const cards = cardsProp ?? liveCards;
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState("semua");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [paidCards, setPaidCards] = useState({});
  const [paySheet, setPaySheet] = useState({ open: false, card: null });
  // PaymentMethodSelector — shown for patungan peer-to-peer pay when payeeUserId is known.
  const [methodSelector, setMethodSelector] = useState({ open: false, card: null });
  const [composeOpen, setComposeOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(() => {
    if (location.pathname.startsWith("/screens")) return false;
    try {
      return localStorage.getItem(COACH_KEY) !== "1";
    } catch {
      return false;
    }
  });

  function closeCoach() {
    try {
      localStorage.setItem(COACH_KEY, "1");
    } catch {
      /* private mode — flag just won't persist */
    }
    setCoachOpen(false);
  }

  // Filtered visible cards — by type (arisan/patungan) or by status
  // (tenggat = nearing/passed deadline, selesai = completed).
  const visibleCards = cards.filter(c => {
    switch (filter) {
      case "arisan":
      case "patungan":
        return c.type === filter;
      case "tenggat":
        return !c.settled && (c.status === "soon" || c.status === "overdue");
      case "selesai":
        return !!c.settled;
      default:
        return true; // "semua"
    }
  });

  // Clamp index when filter changes
  useEffect(() => {
    setCurrentIdx(0);
  }, [filter]);

  const safeIdx = Math.min(currentIdx, Math.max(visibleCards.length - 1, 0));

  function prevCard() {
    setCurrentIdx(i => Math.max(0, i - 1));
  }
  function nextCard() {
    setCurrentIdx(i => Math.min(visibleCards.length - 1, i + 1));
  }

  function getCardClass(idx) {
    if (idx === safeIdx) return "card-active";
    if (idx === safeIdx - 1) return "card-prev";
    if (idx === safeIdx + 1) return "card-next";
    return "card-hidden";
  }

  function openPaySheet(card) {
    setPaySheet({ open: true, card });
  }
  function closePaySheet() {
    setPaySheet({ open: false, card: null });
  }
  function handlePaid() {
    if (paySheet.card) {
      setPaidCards(p => ({ ...p, [paySheet.card.id]: true }));
    }
  }

  function fireReminder(card) {
    const msg = card.ctaType === "collect"
      ? `Tagihan dikirim ke ${card.reminderCount} orang`
      : `Pengingat terkirim ke ${card.reminderCount} teman`;
    toast(msg);
  }

  function handleCta(card) {
    if (card.ctaType === "pay") {
      // Patungan peer-to-peer: if the card carries a payeeUserId, show the
      // PaymentMethodSelector before navigating to BuktiTransfer.
      // TODO(wire-payee-id): patungan cards from the live API need to include
      // `payeeUserId` and `payeeName` so the selector can fetch masked methods.
      if (card.destType === "patungan" && card.payeeUserId) {
        setMethodSelector({ open: true, card });
      } else {
        // Arisan group-wallet pay (or patungan card without payeeUserId yet):
        // continue with the existing PaySheet confirm flow.
        openPaySheet(card);
      }
    } else if (card.ctaType === "remind" || card.ctaType === "collect") {
      fireReminder(card);
    } else if (card.ctaType === "proof") {
      navigate(`/app/bukti?type=${card.type}`);
    }
  }

  /**
   * Called by PaymentMethodSelector "Lanjutkan" — navigate to BuktiTransfer
   * passing the selected method's details as query params so the receipt can
   * show the "Ke Rekening" row (Frame 4 of the designer prototype).
   */
  function handleMethodSelected(selectedMethod) {
    const card = methodSelector.card;
    setMethodSelector({ open: false, card: null });
    if (!card) return;
    // Build the BuktiTransfer URL with the chosen method encoded as query params.
    const params = new URLSearchParams({
      type: card.destType ?? 'patungan',
      ...(card.billId      && { billId:      card.billId }),
      ...(card.payeeUserId && { toUserId:    card.payeeUserId }),
      ...(card.payerUserId && { fromUserId:  card.payerUserId }),
      ...(card.amount      && { amount:      String(card.amount).replace(/\D/g, '') }),
      // Selected method details for the receipt "Ke Rekening" row
      methodId:    selectedMethod.id,
      methodLabel: selectedMethod.label,
      // Pass the masked value (account_number for bank, phone for ewallet)
      methodMasked: selectedMethod.account_number ?? selectedMethod.phone ?? '',
      ...(selectedMethod.holder_name && { methodHolder: selectedMethod.holder_name }),
    });
    navigate(`/app/bukti?${params.toString()}`);
    // Mark the card as paid in the deck so the "paid" overlay renders immediately.
    setPaidCards(p => ({ ...p, [card.id]: true }));
  }

  // Background color drives the screen bg (visible behind the card deck on
  // mobile) — mirrors the card gradient so settled/urgent/type stay consistent.
  // With no cards (empty filter / no tagihan) there's no domain to mirror, so
  // fall back to the emerald→lavender brand gradient (the "no single domain /
  // Hyro itself" mark, same as the compose-pill icon).
  const activeCard = visibleCards[safeIdx];
  const bgCardColor = visibleCards.length === 0
    ? "linear-gradient(165deg, #059669 0%, #10b981 45%, #a78bfa 100%)" // profile-banner gradient
    : activeCard?.settled
    ? "#374151"
    : activeCard?.urgent
    ? "#7f1d1d"
    : activeCard?.type === "patungan"
    ? "#4c1d95"
    : "#065f46";

  return (
    <div className="v2-screen v2-home min-h-svh" style={{ background: bgCardColor }}>
      <div className="v2-inner" style={{ background: "transparent" }}>

        {/* Story segments */}
        <div className="story-bar">
          {/* While loading, render a single dimmed segment as a placeholder */}
          {cardsLoading && cardsProp == null
            ? <div className="story-seg" style={{ opacity: 0.3 }} />
            : visibleCards.map((c, i) => (
              <div
                key={c.id}
                className={`story-seg${i === safeIdx ? " active" : i < safeIdx ? " past" : ""}`}
              />
            ))
          }
        </div>

        <StoryTopBar
          onList={() => navigate("/app/dompet")}
          onNotif={() => navigate("/app/notifikasi")}
          onProfile={() => navigate("/app/profil")}
        />

        <SegFilter value={filter} onChange={setFilter} />

        {/* Deck */}
        <div className="deck-container">
          {/* Nav zones (mobile tap areas) */}
          <div className="nav-prev" onClick={prevCard} aria-label="Kartu sebelumnya" role="button" tabIndex={-1} onKeyDown={e => e.key === "Enter" && prevCard()} />
          <div className="nav-next" onClick={nextCard} aria-label="Kartu berikutnya" role="button" tabIndex={-1} onKeyDown={e => e.key === "Enter" && nextCard()} />

          {/* Desktop arrow buttons — visible only at >=1024px via CSS */}
          <button
            type="button"
            className="deck-arrow arrow-prev"
            onClick={prevCard}
            disabled={safeIdx === 0}
            aria-label="Kartu sebelumnya"
          >
            <ChevronLeft size={22} stroke="currentColor" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="deck-arrow arrow-next"
            onClick={nextCard}
            disabled={safeIdx === visibleCards.length - 1}
            aria-label="Kartu berikutnya"
          >
            <ChevronRight size={22} stroke="currentColor" strokeWidth={2.5} />
          </button>

          {visibleCards.length === 0 ? (
            cards.length === 0 ? (
              // Account genuinely empty (no arisan/patungan) — welcoming card.
              <EmptyCard onCta={() => setComposeOpen(true)} />
            ) : (
              // A filter is active but yields nothing while other cards exist.
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-text">Tidak ada item di filter ini</div>
              </div>
            )
          ) : (
            visibleCards.map((card, idx) => (
              <StoryCard
                key={card.id}
                card={card}
                isPaid={!!paidCards[card.id]}
                cardClass={getCardClass(idx)}
                onCta={() => handleCta(card)}
                onOpen={() => navigate("/app/grup")}
              />
            ))
          )}
        </div>

        {/* Swipe hint */}
        {visibleCards.length > 1 && (
          <div className="swipe-hint">
            <ChevronLeft size={13} stroke="currentColor" strokeWidth={2.5} />
            geser untuk berpindah
            <ChevronRight size={13} stroke="currentColor" strokeWidth={2.5} />
          </div>
        )}

        {/* Dimmer when compose open */}
        <div
          className={`dimmer${composeOpen ? " active" : ""}`}
          onClick={() => setComposeOpen(false)}
        />

        {/* Compose pill */}
        <ComposeSheet
          open={composeOpen}
          onOpen={() => setComposeOpen(true)}
          onClose={() => setComposeOpen(false)}
        />

        {/* First-run guided tour — overlays the deck, shares its coordinates */}
        {coachOpen && <CoachMarks onDone={closeCoach} />}

      </div>

      {/* Pay sheet — arisan group-wallet payments (portal-like, fixed) */}
      {paySheet.open && paySheet.card && (
        <PaySheet
          open={paySheet.open}
          onClose={closePaySheet}
          amount={paySheet.card.amount}
          label={paySheet.card.eyebrow}
          destName={paySheet.card.destName}
          destType={paySheet.card.destType}
          onPaid={handlePaid}
          onDest={() => { closePaySheet(); navigate("/app/grup"); }}
        />
      )}

      {/* Payment Method Selector — patungan peer-to-peer payments.
          Shown when a card carries a payeeUserId (Phase-3 wire-up).
          TODO(wire-payee-id): arisan cards with ctaType="pay" always pay into
          a group wallet, so they keep using PaySheet above and never reach here.
          For patungan cards the live API must supply card.payeeUserId and
          card.payeeName once the backend bill-detail endpoint is available. */}
      {methodSelector.open && methodSelector.card && (
        <PaymentMethodSelector
          payeeUserId={methodSelector.card.payeeUserId}
          payeeName={methodSelector.card.payeeName ?? methodSelector.card.destName ?? ''}
          contextLabel={methodSelector.card.eyebrow ?? ''}
          amount={methodSelector.card.amount ?? ''}
          onContinue={handleMethodSelected}
          onCancel={() => setMethodSelector({ open: false, card: null })}
        />
      )}
    </div>
  );
}
