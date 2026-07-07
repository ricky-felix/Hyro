# Hyro API Documentation

**Version:** 1.0.0
**Base URL:** `http://localhost:3000/api`
**Authentication:** Bearer Token (Supabase JWT)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Groups (Arisan)](#groups-arisan)
4. [Group Members](#group-members)
5. [Rounds](#rounds)
6. [Payments](#payments)
7. [Bills (Patungan)](#bills-patungan)
8. [Bill Participants](#bill-participants)
9. [Bill Settlements](#bill-settlements)
10. [Bill Comments](#bill-comments)
11. [Recurring Bills](#recurring-bills)
12. [Debt Simplification](#debt-simplification)
13. [Notifications](#notifications)
14. [Contacts](#contacts)
15. [Storage](#storage)
16. [Invite Links](#invite-links)
17. [Plans & Subscriptions](#plans--subscriptions)
18. [Usage](#usage)
19. [Error Responses](#error-responses)

---

## Authentication

All API endpoints require authentication via Supabase JWT token.

### Headers

```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

### Roles

| Role | Description |
|------|-------------|
| `user` | Standard authenticated user |
| `group_admin` | Administrator of a specific arisan group |
| `super_admin` | Platform-wide administrator |

---

## Users

### Get Current User Profile

```http
GET /api/users/me
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "Sari Wulandari",
  "phone": "+62812345678",
  "avatar_url": "https://...",
  "platform_role": "user",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Update Current User Profile

```http
PATCH /api/users/me
```

**Request Body:**
```json
{
  "full_name": "New Name",
  "phone": "+62812345678",
  "avatar_url": "https://..."
}
```

### List All Users (Super Admin Only)

```http
GET /api/users
```

**Authorization:** `super_admin` role required

---

## Groups (Arisan)

### List My Groups

```http
GET /api/groups
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Arisan Kantor Lt. 3",
    "description": "Monthly office arisan",
    "contribution_amount": 500000,
    "frequency": "monthly",
    "max_members": 12,
    "current_round": 8,
    "status": "active",
    "created_by": "uuid",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Get Group by ID

```http
GET /api/groups/:id
```

### Create Group

```http
POST /api/groups
```

**Request Body:**
```json
{
  "name": "Arisan Kantor",
  "description": "Monthly office arisan",
  "contribution_amount": 500000,
  "frequency": "monthly",
  "max_members": 12
}
```

**Frequency Options:** `weekly`, `biweekly`, `monthly`, `yearly`

### Update Group

```http
PATCH /api/groups/:id
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "contribution_amount": 600000
}
```

### Delete Group

```http
DELETE /api/groups/:id
```

**Authorization:** Group admin only

---

## Group Members

### List Group Members

```http
GET /api/groups/:groupId/members
```

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "group_id": "uuid",
    "role": "admin",
    "giliran_order": 1,
    "joined_at": "2024-01-01T00:00:00Z",
    "user": {
      "full_name": "Sari Wulandari",
      "avatar_url": "https://..."
    }
  }
]
```

### Add Member

```http
POST /api/groups/:groupId/members
```

**Request Body:**
```json
{
  "user_id": "uuid"
}
```

### Remove Member

```http
DELETE /api/groups/:groupId/members/:userId
```

### Assign Giliran Order

```http
POST /api/groups/:groupId/members/assign-giliran
```

**Request Body:**
```json
{
  "assignments": [
    { "user_id": "uuid", "giliran_order": 1 },
    { "user_id": "uuid", "giliran_order": 2 }
  ]
}
```

### Random Shuffle Giliran

```http
POST /api/groups/:groupId/members/random-shuffle
```

---

## Rounds

### List Rounds for Group

```http
GET /api/groups/:groupId/rounds
```

**Response:**
```json
[
  {
    "id": "uuid",
    "group_id": "uuid",
    "round_number": 8,
    "recipient_id": "uuid",
    "status": "active",
    "scheduled_date": "2024-05-25",
    "completed_at": null
  }
]
```

### Get Round by ID

```http
GET /api/rounds/:id
```

### Set Round Recipient

```http
PATCH /api/rounds/:id/recipient
```

**Request Body:**
```json
{
  "recipient_id": "uuid"
}
```

### Activate Round

```http
POST /api/rounds/:id/activate
```

### Complete Round

```http
POST /api/rounds/:id/complete
```

---

## Payments

Payments are for arisan group contributions.

### Get My Payments

```http
GET /api/payments/me
```

### Get Payments for Group

```http
GET /api/payments/group/:groupId
```

### Get Payments for Round

```http
GET /api/payments/round/:roundId
```

### Create Payment

```http
POST /api/payments
```

**Request Body:**
```json
{
  "round_id": "uuid",
  "amount": 500000,
  "proof_url": "https://storage.../proof.jpg",
  "notes": "Transfer BCA"
}
```

### Confirm Payment (Admin)

```http
PATCH /api/payments/:id/confirm
```

### Reject Payment (Admin)

```http
PATCH /api/payments/:id/reject
```

**Request Body:**
```json
{
  "reason": "Nominal tidak sesuai"
}
```

---

## Bills (Patungan)

Bill splitting module for shared expenses.

### List My Bills

```http
GET /api/bills
```

**Response:**
```json
{
  "as_payer": [
    {
      "id": "uuid",
      "title": "Makan malam Restoran Padang",
      "category": "makanan",
      "total_amount": 480000,
      "split_method": "equal",
      "status": "open",
      "created_by": "uuid",
      "created_at": "2024-05-14T10:00:00Z"
    }
  ],
  "as_participant": [
    {
      "id": "uuid",
      "title": "Kopi pagi tim ops",
      "my_share": 36000,
      "my_status": "pending"
    }
  ]
}
```

### Get Bill by ID

```http
GET /api/bills/:id
```

### Create Bill

```http
POST /api/bills
```

**Request Body:**
```json
{
  "title": "Makan malam di Restoran Padang",
  "category": "makanan",
  "total_amount": 480000,
  "split_method": "equal",
  "receipt_url": "https://storage.../receipt.jpg",
  "participants": [
    { "user_id": "uuid" },
    { "user_id": "uuid", "amount": 100000 },
    { "phone": "+62812345678" }
  ],
  "linked_group_id": "uuid"
}
```

**Split Methods:**
| Method | Description |
|--------|-------------|
| `equal` | Split equally among all participants |
| `exact` | Specify exact amount for each participant |
| `percentage` | Split by percentage |
| `shares` | Split by number of shares |

**Categories:**
- `makanan` - Food
- `transport` - Transportation
- `penginapan` - Accommodation
- `utilitas` - Utilities
- `hiburan` - Entertainment
- `lainnya` - Other

### Update Bill

```http
PATCH /api/bills/:id
```

### Delete Bill

```http
DELETE /api/bills/:id
```

### Mark Bill as Settled

```http
PATCH /api/bills/:id/settle
```

---

## Bill Participants

### Add Participant to Bill

```http
POST /api/bills/:billId/participants
```

**Request Body:**
```json
{
  "user_id": "uuid",
  "amount": 100000
}
```

### Remove Participant

```http
DELETE /api/bills/:billId/participants/:participantId
```

---

## Bill Settlements

Settlements track individual payments toward a bill.

### List Settlements for Bill

```http
GET /api/settlements/bill/:billId
```

### Get My Settlements

```http
GET /api/settlements/me
```

### Create Settlement

```http
POST /api/settlements
```

**Request Body:**
```json
{
  "bill_id": "uuid",
  "amount": 96000,
  "proof_url": "https://storage.../proof.jpg",
  "notes": "Transfer via BCA"
}
```

### Confirm Settlement (Payer)

```http
PATCH /api/settlements/:id/confirm
```

### Reject Settlement (Payer)

```http
PATCH /api/settlements/:id/reject
```

**Request Body:**
```json
{
  "reason": "Screenshot tidak jelas"
}
```

---

## Bill Comments

### List Comments for Bill

```http
GET /api/bills/:billId/comments
```

**Response:**
```json
[
  {
    "id": "uuid",
    "bill_id": "uuid",
    "user_id": "uuid",
    "content": "Sudah transfer ya, mohon dicek",
    "is_deleted": false,
    "created_at": "2024-05-14T12:00:00Z",
    "user": {
      "full_name": "Budi Santoso",
      "avatar_url": "https://..."
    }
  }
]
```

### Create Comment

```http
POST /api/comments
```

**Request Body:**
```json
{
  "bill_id": "uuid",
  "content": "Sudah transfer ya, mohon dicek"
}
```

### Update Comment

```http
PATCH /api/comments/:id
```

**Request Body:**
```json
{
  "content": "Updated comment"
}
```

### Delete Comment (Soft Delete)

```http
DELETE /api/comments/:id
```

---

## Recurring Bills

Automated recurring bill generation.

### List My Recurring Bills

```http
GET /api/recurring-bills
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Listrik kos bersama",
    "category": "utilitas",
    "base_amount": 650000,
    "frequency": "monthly",
    "next_due_date": "2024-05-31",
    "status": "active",
    "participant_count": 4
  }
]
```

### Get Recurring Bill by ID

```http
GET /api/recurring-bills/:id
```

### Create Recurring Bill

```http
POST /api/recurring-bills
```

**Request Body:**
```json
{
  "title": "Listrik kos bersama",
  "category": "utilitas",
  "base_amount": 650000,
  "frequency": "monthly",
  "split_method": "equal",
  "start_date": "2024-05-01",
  "participants": [
    { "user_id": "uuid" }
  ]
}
```

**Frequency Options:** `weekly`, `biweekly`, `monthly`, `yearly`

### Update Recurring Bill

```http
PATCH /api/recurring-bills/:id
```

### Delete Recurring Bill

```http
DELETE /api/recurring-bills/:id
```

### Run Due Bills (Super Admin)

```http
POST /api/recurring-bills/run-due
```

**Authorization:** `super_admin` role required

---

## Debt Simplification

Optimize multiple debts into fewer transactions.

### Calculate Simplification

```http
GET /api/debt-simplifications/bill/:billId
```

**Response:**
```json
{
  "original_transactions": 6,
  "simplified_transactions": 2,
  "transfers": [
    {
      "from_user_id": "uuid",
      "to_user_id": "uuid",
      "amount": 246000
    }
  ]
}
```

### Apply Simplification

```http
POST /api/debt-simplifications/bill/:billId/apply
```

---

## Notifications

### List My Notifications

```http
GET /api/notifications
```

**Response:**
```json
[
  {
    "id": "uuid",
    "type": "payment_confirmed",
    "title": "Pembayaran dikonfirmasi",
    "body": "Arisan Kantor Lt. 3 ronde 8 telah dikonfirmasi admin.",
    "is_read": false,
    "data": { "group_id": "uuid", "round_id": "uuid" },
    "created_at": "2024-05-14T10:00:00Z"
  }
]
```

**Notification Types:**
- `payment_confirmed` - Payment was confirmed
- `payment_rejected` - Payment was rejected
- `bill_created` - New bill created
- `settlement_received` - Settlement payment received
- `giliran_assigned` - Giliran was assigned
- `round_started` - New round started
- `member_joined` - New member joined group

### Get Unread Count

```http
GET /api/notifications/unread-count
```

**Response:**
```json
{
  "count": 4
}
```

### Mark as Read

```http
POST /api/notifications/:id/read
```

### Mark All as Read

```http
POST /api/notifications/read-all
```

---

## Contacts

### List Contacts

```http
GET /api/contacts?sort=recent&limit=50
```

**Query Parameters:**
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `sort` | string | `recent` | `recent`, `frequent`, `name` |
| `limit` | number | `50` | Positive integer |

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Budi Santoso",
    "phone": "+62812111222",
    "is_on_platform": true,
    "user_id": "uuid",
    "use_count": 5,
    "last_used_at": "2024-05-14T10:00:00Z"
  }
]
```

### Get Recent Contacts

```http
GET /api/contacts/recents
```

Returns the 10 most recently used contacts.

### Create Contact

```http
POST /api/contacts
```

**Request Body:**
```json
{
  "name": "Budi Santoso",
  "phone": "+62812111222"
}
```

### Touch Contact (Update Last Used)

```http
POST /api/contacts/touch
```

**Request Body:**
```json
{
  "phone": "+62812111222"
}
```
or
```json
{
  "contact_id": "uuid"
}
```

### Update Contact

```http
PATCH /api/contacts/:id
```

### Delete Contact

```http
DELETE /api/contacts/:id
```

---

## Storage

Signed URL management for file uploads.

### Get Upload URL

```http
POST /api/storage/upload-url
```

**Request Body:**
```json
{
  "bucket": "payment-proofs",
  "filename": "proof-2024-05-14.jpg",
  "content_type": "image/jpeg"
}
```

**Response:**
```json
{
  "bucket": "payment-proofs",
  "path": "user-uuid/proof-2024-05-14.jpg",
  "signed_url": "https://...",
  "token": "..."
}
```

**Buckets:**
- `payment-proofs` - Arisan payment proofs
- `bill-receipts` - Patungan receipts
- `avatars` - User profile pictures

### Get Read URL

```http
POST /api/storage/read-url
```

**Request Body:**
```json
{
  "bucket": "payment-proofs",
  "path": "user-uuid/proof.jpg"
}
```

**Response:**
```json
{
  "signed_url": "https://...",
  "expires_at": "2024-05-14T11:00:00Z"
}
```

### Delete Object

```http
DELETE /api/storage/object
```

**Request Body:**
```json
{
  "bucket": "payment-proofs",
  "path": "user-uuid/proof.jpg"
}
```

---

## Invite Links

### Create Invite Link

```http
POST /api/invite-links
```

**Request Body:**
```json
{
  "group_id": "uuid",
  "expires_in_days": 7,
  "max_uses": 10
}
```

**Response:**
```json
{
  "id": "uuid",
  "code": "SARI-K3X9",
  "group_id": "uuid",
  "expires_at": "2024-05-21T00:00:00Z",
  "max_uses": 10,
  "use_count": 0
}
```

### Validate Invite Code

```http
GET /api/invite-links/validate/:code
```

**Response:**
```json
{
  "valid": true,
  "group": {
    "id": "uuid",
    "name": "Arisan Kantor Lt. 3",
    "member_count": 10,
    "max_members": 12
  }
}
```

### Join via Invite Code

```http
POST /api/invite-links/join/:code
```

---

## Plans & Subscriptions

### List Available Plans

```http
GET /api/plans
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Free",
    "price_monthly": 0,
    "max_groups": 2,
    "max_bills": 5,
    "features": ["basic_analytics"]
  },
  {
    "id": "uuid",
    "name": "Pro",
    "price_monthly": 49000,
    "max_groups": 10,
    "max_bills": 50,
    "features": ["advanced_analytics", "export", "priority_support"]
  }
]
```

### Get Current Subscription

```http
GET /api/subscriptions/me
```

### Create Subscription

```http
POST /api/subscriptions
```

**Request Body:**
```json
{
  "plan_id": "uuid",
  "payment_method": "midtrans"
}
```

---

## Usage

### Get Current Usage

```http
GET /api/usage/me
```

**Response:**
```json
{
  "user_id": "uuid",
  "month": "2024-05",
  "groups_created": 2,
  "bills_created": 8,
  "max_groups": 10,
  "max_bills": 50
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `204` | No Content |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Invalid or missing token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found |
| `409` | Conflict - Resource already exists |
| `422` | Unprocessable Entity - Validation failed |
| `429` | Too Many Requests - Rate limited |
| `500` | Internal Server Error |

### Validation Errors

```json
{
  "statusCode": 400,
  "message": [
    "name must be a string",
    "contribution_amount must be a positive number"
  ],
  "error": "Bad Request"
}
```

---

## Rate Limiting

- Standard users: 100 requests per minute
- Authenticated users: 1000 requests per minute
- File uploads: 10 per minute

---

## Webhooks (Internal)

### Midtrans Payment Webhook

```http
POST /api/billing/midtrans/webhook
```

### Xendit Payment Webhook

```http
POST /api/billing/xendit/webhook
```

---

## Environment Variables

### Backend (.env)

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Server
PORT=3000
FRONTEND_URL=http://localhost:5173

# Payment Gateways (optional)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
XENDIT_SECRET_KEY=
```

### Frontend (.env)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:3000/api
```

---

## Testing

### Run Backend Tests

```bash
cd backend
npm test
```

### Run with Coverage

```bash
cd backend
npm run test:cov
```

### Test Results (Latest)

- **Test Suites:** 8 passed
- **Tests:** 49 passed
- **Time:** ~9.4s

---

## Quick Start

1. **Clone and install:**
   ```bash
   git clone <repo>
   cd Arisan-Digital
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your Supabase credentials
   ```

3. **Start backend:**
   ```bash
   cd backend && npm run start:dev
   ```

4. **Start frontend:**
   ```bash
   cd frontend && npm run dev
   ```

5. **Access:**
   - Frontend: http://localhost:5173
   - API: http://localhost:3000/api

---

*Last updated: May 2026*
