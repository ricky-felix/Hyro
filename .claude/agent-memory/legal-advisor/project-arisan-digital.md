---
name: project-arisan-digital
description: Core product facts for Hyro — what it does, money flow model, and regulatory positioning
metadata:
  type: project
---

Hyro is an Indonesian fintech-adjacent web app (React/Vite + NestJS + Supabase) targeting Gen Z users. It has two core features:
1. **Arisan** — digital coordination of rotating savings groups (giliran/round management, iuran tracking)
2. **Patungan** — peer-to-peer bill splitting with 4 split strategies + debt simplification

**Money flow model (critical for regulatory analysis):**
- The platform does NOT hold, move, or custody user funds at any point
- `payments` table = iuran records; users upload a `proof_url` (screenshot of bank transfer); a group admin manually confirms/rejects
- `bill_settlements` table = patungan repayments; same proof-upload + human-confirm model
- `payment_method_details` JSONB = users store their own bank/e-wallet account numbers as a "directory" so peers can pay them directly bank-to-bank
- Xendit/Midtrans gateway is used ONLY for the platform's own subscription revenue (Boss Rp 29k/mo, Bisnis Rp 199k/mo); NOT for routing arisan iuran or patungan settlements
- `payment_transactions` table = tracks platform subscription payments only, not arisan iuran

**This model (pure coordination + proof upload, no fund custody) is the design choice that keeps the platform outside BI PJP licensing and OJK fund-management oversight.**

**Data collected (UU PDP relevance):**
- name, phone, email (auth)
- PIN hash (bcrypt, backend only)
- bank account numbers + holder names (stored in `users.payment_methods` JSONB; masked last-4 for peers)
- payment proof images (private Supabase Storage buckets)
- transaction history (subscription payments via gateway)

**Entity:** Licensed as "Titik Jalin Projects" per README — entity type/jurisdiction not confirmed
**Current stage:** MVP punchlist complete as of 2026-06-08; approaching closed alpha
**Regulatory posture documented in PRD:** PRD-payment-methods.md Section 8 has a "Regulatory & Compliance Constraints" section that articulates the pass-through/directory-only model correctly

**Why:** Founder asked for full legal/compliance readiness assessment before friends-and-family alpha and public launch.
**How to apply:** Use this money-flow analysis as the foundation for all licensing risk assessments. The platform is consciously designed as a coordination tool, not a payment processor. Maintain that distinction in all future advice.
