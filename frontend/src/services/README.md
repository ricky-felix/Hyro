# API Services Documentation

This directory contains all API service modules for the Hyro frontend application. These services provide a clean, type-safe interface for communicating with the backend API.

## Architecture Overview

The service layer follows a modular architecture:

```
services/
├── index.js                  # Barrel export for all services
├── users.service.js          # User profile management
├── groups.service.js         # Arisan groups, members, rounds, and invite links
├── payments.service.js       # Arisan payment transactions
├── bills.service.js          # Bills, participants, settlements, comments, recurring, debt simplification
├── notifications.service.js  # User notifications
├── contacts.service.js       # Contact management
├── storage.service.js        # File upload/download (Supabase Storage signed URLs)
├── examples.js               # End-to-end usage recipes
└── README.md                 # This document
```

> **Note:** `bills.service.js` and `groups.service.js` each export multiple named services (e.g. `groupMembersService`, `roundsService`, `inviteLinksService`, `billParticipantsService`, `billSettlementsService`, `billCommentsService`, `recurringBillsService`, `debtSimplificationService`). They are re-exported through `index.js`, so import everything from `@/services`.

## Base API Client

All services use the centralized `ApiClient` class from `lib/api.js`:

```javascript
import { api } from '../lib/api';
```

### Features:
- Automatic authentication header injection using Supabase session tokens
- Standardized error handling
- Support for GET, POST, PATCH, and DELETE methods
- Handles 204 No Content responses
- Type-safe request/response handling

## Service Modules

### 1. Users Service (`users.service.js`)

Manages user profile data.

```javascript
import { usersService } from '@/services';

// Get current user profile
const profile = await usersService.getProfile();

// Update profile
const updated = await usersService.updateProfile({
  display_name: 'John Doe',
  phone: '+628123456789'
});
```

**Available Methods:**
- `getProfile()` - Get current user profile
- `updateProfile(data)` - Update user profile

---

### 2. Groups Service (`groups.service.js`)

Manages arisan groups, members, rounds, and invite links.

#### Groups Management

```javascript
import { groupsService } from '@/services';

// List all groups
const groups = await groupsService.list();

// Get specific group
const group = await groupsService.getById('group-id');

// Create new group
const newGroup = await groupsService.create({
  name: 'Monthly Arisan',
  contribution_amount: 1000000,
  frequency: 'monthly',
  max_members: 10
});

// Update group
const updated = await groupsService.update('group-id', {
  name: 'Updated Name'
});

// Delete group
await groupsService.delete('group-id');
```

#### Group Members Management

```javascript
import { groupMembersService } from '@/services';

// List members
const members = await groupMembersService.list('group-id');

// Add member
const member = await groupMembersService.add('group-id', {
  user_id: 'user-id'
});

// Remove member
await groupMembersService.remove('group-id', 'member-id');

// Assign giliran (turn order)
await groupMembersService.assignGiliran('group-id', 'member-id', {
  giliran_order: 3
});
```

#### Rounds Management

```javascript
import { roundsService } from '@/services';

// Get all rounds for a group
const rounds = await roundsService.list('group-id');

// Get current active round
const currentRound = await roundsService.getCurrent('group-id');

// Set recipient manually
await roundsService.setRecipient('round-id', {
  recipient_member_id: 'member-id'
});

// Perform random draw
const drawResult = await roundsService.draw('round-id');
```

#### Invite Links Management

```javascript
import { inviteLinksService } from '@/services';

// Create invite link
const invite = await inviteLinksService.create('group-id', {
  expires_at: '2026-12-31T23:59:59Z',
  max_uses: 10
});

// Validate invite code
const validation = await inviteLinksService.validate('ABC123');

// Join group using invite
const joinedGroup = await inviteLinksService.join('ABC123');
```

---

### 3. Payments Service (`payments.service.js`)

Manages arisan payment transactions.

```javascript
import { paymentsService } from '@/services';

// Get my payments
const myPayments = await paymentsService.getMine();

// Get payments for specific group
const groupPayments = await paymentsService.getForGroup('group-id');

// Get payments for specific round
const roundPayments = await paymentsService.getForRound('round-id');

// Create payment
const payment = await paymentsService.create({
  round_id: 'round-id',
  amount: 1000000,
  proof_url: 'https://storage.example.com/proof.jpg',
  notes: 'Payment for round 3'
});

// Confirm payment (admin/recipient)
await paymentsService.confirm('payment-id');

// Reject payment
await paymentsService.reject('payment-id', {
  reason: 'Invalid proof of payment'
});
```

---

### 4. Bills Service (`bills.service.js`)

Comprehensive bill splitting and settlement management.

#### Bills Management

```javascript
import { billsService } from '@/services';

// List all bills
const bills = await billsService.list();

// Get specific bill
const bill = await billsService.getById('bill-id');

// Create bill
const newBill = await billsService.create({
  title: 'Team Dinner',
  total_amount: 500000,
  description: 'Monthly team dinner at Restaurant X',
  split_method: 'equal'
});

// Update bill
await billsService.update('bill-id', {
  title: 'Updated Title'
});

// Delete bill
await billsService.delete('bill-id');

// Mark as settled
await billsService.markSettled('bill-id');
```

#### Bill Participants

```javascript
import { billParticipantsService } from '@/services';

// Add participant
await billParticipantsService.add('bill-id', {
  user_id: 'user-id',
  share_amount: 100000
});

// Remove participant
await billParticipantsService.remove('bill-id', 'participant-id');
```

#### Bill Settlements

```javascript
import { billSettlementsService } from '@/services';

// Get settlements for bill
const settlements = await billSettlementsService.list('bill-id');

// Get my settlements
const mySettlements = await billSettlementsService.getMine();

// Create settlement
const settlement = await billSettlementsService.create({
  bill_id: 'bill-id',
  from_user_id: 'user-id-1',
  to_user_id: 'user-id-2',
  amount: 50000,
  proof_url: 'https://storage.example.com/receipt.jpg'
});

// Confirm settlement
await billSettlementsService.confirm('settlement-id');

// Reject settlement
await billSettlementsService.reject('settlement-id', {
  reason: 'Amount incorrect'
});
```

#### Bill Comments

```javascript
import { billCommentsService } from '@/services';

// List comments
const comments = await billCommentsService.list('bill-id');

// Create comment
await billCommentsService.create('bill-id', {
  content: 'When is everyone available to settle?',
  mentions: ['user-id-1', 'user-id-2']
});

// Update comment
await billCommentsService.update('bill-id', 'comment-id', {
  content: 'Updated content'
});

// Delete comment
await billCommentsService.delete('bill-id', 'comment-id');
```

#### Recurring Bills

```javascript
import { recurringBillsService } from '@/services';

// List recurring bills
const recurringBills = await recurringBillsService.list();

// Get specific recurring bill
const recurringBill = await recurringBillsService.getById('recurring-bill-id');

// Create recurring bill
const newRecurring = await recurringBillsService.create({
  title: 'Monthly Utilities',
  amount: 200000,
  frequency: 'monthly',
  start_date: '2026-06-01',
  participants: ['user-id-1', 'user-id-2']
});

// Update recurring bill
await recurringBillsService.update('recurring-bill-id', {
  amount: 250000
});

// Delete recurring bill
await recurringBillsService.delete('recurring-bill-id');
```

#### Debt Simplification

```javascript
import { debtSimplificationService } from '@/services';

// Calculate optimized payment flows
const simplified = await debtSimplificationService.calculate('bill-id');

// Apply simplified structure
await debtSimplificationService.apply('bill-id');
```

---

### 5. Notifications Service (`notifications.service.js`)

Manages user notifications.

```javascript
import { notificationsService } from '@/services';

// Get all notifications
const notifications = await notificationsService.list();

// Get unread count
const { count } = await notificationsService.getUnreadCount();

// Mark notification as read
await notificationsService.markRead('notification-id');

// Mark all as read
await notificationsService.markAllRead();
```

---

### 6. Contacts Service (`contacts.service.js`)

Manages user contacts and frequent collaborators.

```javascript
import { contactsService } from '@/services';

// List all contacts
const contacts = await contactsService.list();

// List with options
const recentContacts = await contactsService.list({
  sort: 'recent',
  limit: 10
});

// Get recent contacts
const recents = await contactsService.getRecents();

// Create contact
await contactsService.create({
  contact_user_id: 'user-id',
  nickname: 'John'
});

// Touch (update last interaction)
await contactsService.touch({
  contact_user_id: 'user-id'
});

// Update contact
await contactsService.update('contact-id', {
  nickname: 'Johnny'
});

// Delete contact
await contactsService.delete('contact-id');
```

---

### 7. Storage Service (`storage.service.js`)

Manages file uploads and downloads for payment proofs, receipts, etc.

```javascript
import { storageService } from '@/services';

// Get upload URL
const { upload_url, file_key } = await storageService.getUploadUrl({
  file_name: 'receipt.jpg',
  file_type: 'image/jpeg',
  bucket: 'payment-proofs'
});

// Upload file using the presigned URL
await fetch(upload_url, {
  method: 'PUT',
  body: fileBlob,
  headers: {
    'Content-Type': 'image/jpeg'
  }
});

// Get read URL
const { read_url } = await storageService.getReadUrl({
  file_key: file_key,
  bucket: 'payment-proofs',
  expires_in: 3600 // 1 hour
});

// Delete file
await storageService.deleteObject({
  file_key: file_key,
  bucket: 'payment-proofs'
});
```

---

## Error Handling

All services throw errors that can be caught and handled:

```javascript
try {
  const profile = await usersService.getProfile();
} catch (error) {
  console.error('Failed to fetch profile:', error.message);
  // Handle error (show toast, redirect, etc.)
}
```

Common error scenarios:
- **401 Unauthorized**: User is not authenticated (redirect to login)
- **403 Forbidden**: User doesn't have permission for this action
- **404 Not Found**: Requested resource doesn't exist
- **422 Unprocessable Entity**: Validation error (check request data)
- **500 Internal Server Error**: Backend error (show error message)

---

## Usage with React Hooks

### Example: Custom Hook Pattern

```javascript
// hooks/useProfile.js
import { useState, useEffect } from 'react';
import { usersService } from '@/services';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await usersService.getProfile();
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  return { profile, loading, error };
}
```

### Example: With React Query

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsService } from '@/services';

// Query
function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: groupsService.list
  });
}

// Mutation
function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['groups']);
    }
  });
}
```

---

## TypeScript Support

While these services are written in JavaScript, they can be easily typed for TypeScript projects:

```typescript
// types/api.ts
export interface User {
  id: string;
  email: string;
  display_name: string;
  phone?: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  contribution_amount: number;
  frequency: 'weekly' | 'monthly';
  max_members: number;
  created_at: string;
}

// Usage
import { usersService } from '@/services';
import type { User } from '@/types/api';

const profile: User = await usersService.getProfile();
```

---

## Best Practices

1. **Always handle errors**: Wrap service calls in try-catch blocks
2. **Use loading states**: Show loading indicators during API calls
3. **Invalidate caches**: Refresh data after mutations
4. **Batch requests**: Use Promise.all() for parallel requests
5. **Debounce searches**: Prevent excessive API calls on user input
6. **Optimize re-renders**: Use React Query or similar caching solutions
7. **Type safety**: Add TypeScript types for better development experience

---

## Configuration

The API base URL is configured in `config.js`:

```javascript
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
};
```

Set the `VITE_API_URL` environment variable to change the API endpoint:

```bash
# .env
VITE_API_URL=https://api.arisandigital.com/api
```

---

## Testing

Example unit test for a service:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { usersService } from './users.service';
import { api } from '../lib/api';

vi.mock('../lib/api');

describe('usersService', () => {
  it('should fetch user profile', async () => {
    const mockProfile = { id: '1', email: 'test@example.com' };
    api.get.mockResolvedValue(mockProfile);

    const profile = await usersService.getProfile();

    expect(api.get).toHaveBeenCalledWith('/users/me');
    expect(profile).toEqual(mockProfile);
  });
});
```

---

## Migration from Old API

If you're migrating from the old API structure, here's a mapping guide:

```javascript
// Old
api.groups.list()
api.groups.get(id)
api.payments.mine()
api.users.me()

// New
groupsService.list()
groupsService.getById(id)
paymentsService.getMine()
usersService.getProfile()
```

---

## Support

For issues or questions about the API services:
1. Check the backend API documentation for endpoint details
2. Review error messages for debugging information
3. Ensure authentication tokens are valid
4. Verify environment variables are set correctly

---

**Last Updated**: May 17, 2026
**API Version**: v1
