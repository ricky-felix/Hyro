/**
 * Usage Examples for API Services
 *
 * This file contains practical examples of how to use the API services
 * in various scenarios within the Hyro application.
 */

import {
  usersService,
  groupsService,
  groupMembersService,
  roundsService,
  inviteLinksService,
  paymentsService,
  billsService,
  billParticipantsService,
  billSettlementsService,
  billCommentsService,
  notificationsService,
  contactsService,
  storageService,
} from './index';

// ============================================================================
// Example 1: User Authentication Flow
// ============================================================================

export async function loadUserProfile() {
  try {
    const profile = await usersService.getProfile();
    console.log('User profile loaded:', profile);
    return profile;
  } catch (error) {
    console.error('Failed to load profile:', error);
    throw error;
  }
}

export async function updateUserProfile(updates) {
  try {
    const updated = await usersService.updateProfile(updates);
    console.log('Profile updated successfully:', updated);
    return updated;
  } catch (error) {
    console.error('Failed to update profile:', error);
    throw error;
  }
}

// ============================================================================
// Example 2: Creating and Managing an Arisan Group
// ============================================================================

export async function createNewArisanGroup(groupData) {
  try {
    // Step 1: Create the group
    const group = await groupsService.create({
      name: groupData.name,
      contribution_amount: groupData.amount,
      frequency: groupData.frequency,
      max_members: groupData.maxMembers,
      description: groupData.description,
    });

    console.log('Group created:', group);

    // Step 2: Create an invite link
    const invite = await inviteLinksService.create(group.id, {
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      max_uses: group.max_members,
    });

    console.log('Invite link created:', invite);

    return { group, invite };
  } catch (error) {
    console.error('Failed to create group:', error);
    throw error;
  }
}

export async function joinGroupViaInvite(inviteCode) {
  try {
    // Step 1: Validate the invite
    const validation = await inviteLinksService.validate(inviteCode);
    console.log('Invite valid:', validation);

    // Step 2: Join the group
    const result = await inviteLinksService.join(inviteCode);
    console.log('Successfully joined group:', result);

    return result;
  } catch (error) {
    console.error('Failed to join group:', error);
    throw error;
  }
}

// ============================================================================
// Example 3: Managing Arisan Round and Payments
// ============================================================================

export async function getCurrentRoundStatus(groupId) {
  try {
    // Get current round
    const round = await roundsService.getCurrent(groupId);

    // Get payments for this round
    const payments = await paymentsService.getForRound(round.id);

    // Get group members
    const members = await groupMembersService.list(groupId);

    return {
      round,
      payments,
      members,
      totalPaid: payments.filter(p => p.status === 'confirmed').length,
      totalMembers: members.length,
    };
  } catch (error) {
    console.error('Failed to get round status:', error);
    throw error;
  }
}

export async function submitPaymentForRound(roundId, paymentData) {
  try {
    // Step 1: Upload payment proof
    const { upload_url, file_key } = await storageService.getUploadUrl({
      file_name: paymentData.proofFile.name,
      file_type: paymentData.proofFile.type,
      bucket: 'payment-proofs',
    });

    // Upload file
    await fetch(upload_url, {
      method: 'PUT',
      body: paymentData.proofFile,
      headers: {
        'Content-Type': paymentData.proofFile.type,
      },
    });

    // Step 2: Get read URL for the uploaded file
    const { read_url } = await storageService.getReadUrl({
      file_key: file_key,
      bucket: 'payment-proofs',
    });

    // Step 3: Create payment record
    const payment = await paymentsService.create({
      round_id: roundId,
      amount: paymentData.amount,
      proof_url: read_url,
      notes: paymentData.notes,
    });

    console.log('Payment submitted:', payment);
    return payment;
  } catch (error) {
    console.error('Failed to submit payment:', error);
    throw error;
  }
}

// ============================================================================
// Example 4: Bill Splitting Workflow
// ============================================================================

export async function createSharedBill(billData) {
  try {
    // Step 1: Create the bill
    const bill = await billsService.create({
      title: billData.title,
      total_amount: billData.totalAmount,
      description: billData.description,
      split_method: billData.splitMethod || 'equal',
    });

    console.log('Bill created:', bill);

    // Step 2: Add participants
    const participantPromises = billData.participants.map(participant =>
      billParticipantsService.add(bill.id, {
        user_id: participant.userId,
        share_amount: participant.shareAmount,
      })
    );

    await Promise.all(participantPromises);
    console.log('Participants added');

    // Step 3: Touch contacts to update recent interactions
    await Promise.all(
      billData.participants.map(p =>
        contactsService.touch({ contact_user_id: p.userId })
      )
    );

    return bill;
  } catch (error) {
    console.error('Failed to create bill:', error);
    throw error;
  }
}

export async function settleBillDebt(billId, settlementData) {
  try {
    // Step 1: Upload payment proof if provided
    let proofUrl = null;
    if (settlementData.proofFile) {
      const { upload_url, file_key } = await storageService.getUploadUrl({
        file_name: settlementData.proofFile.name,
        file_type: settlementData.proofFile.type,
        bucket: 'receipts',
      });

      await fetch(upload_url, {
        method: 'PUT',
        body: settlementData.proofFile,
        headers: {
          'Content-Type': settlementData.proofFile.type,
        },
      });

      const { read_url } = await storageService.getReadUrl({
        file_key: file_key,
        bucket: 'receipts',
      });

      proofUrl = read_url;
    }

    // Step 2: Create settlement
    const settlement = await billSettlementsService.create({
      bill_id: billId,
      from_user_id: settlementData.fromUserId,
      to_user_id: settlementData.toUserId,
      amount: settlementData.amount,
      proof_url: proofUrl,
      notes: settlementData.notes,
    });

    console.log('Settlement created:', settlement);
    return settlement;
  } catch (error) {
    console.error('Failed to create settlement:', error);
    throw error;
  }
}

// ============================================================================
// Example 5: Real-time Notifications
// ============================================================================

export async function loadNotifications() {
  try {
    const [notifications, unreadCount] = await Promise.all([
      notificationsService.list(),
      notificationsService.getUnreadCount(),
    ]);

    return {
      notifications,
      unreadCount: unreadCount.count,
    };
  } catch (error) {
    console.error('Failed to load notifications:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId) {
  try {
    await notificationsService.markRead(notificationId);
    console.log('Notification marked as read');
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

// ============================================================================
// Example 6: Dashboard Data Loading (Parallel Requests)
// ============================================================================

export async function loadDashboardData() {
  try {
    // Load multiple data sources in parallel for optimal performance
    const [profile, groups, myPayments, mySettlements, notifications, contacts] =
      await Promise.all([
        usersService.getProfile(),
        groupsService.list(),
        paymentsService.getMine(),
        billSettlementsService.getMine(),
        notificationsService.list(),
        contactsService.getRecents(),
      ]);

    return {
      profile,
      groups,
      myPayments,
      mySettlements,
      notifications,
      contacts,
    };
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    throw error;
  }
}

// ============================================================================
// Example 7: Group Activity Feed
// ============================================================================

export async function loadGroupActivity(groupId) {
  try {
    const [group, members, rounds, payments] = await Promise.all([
      groupsService.getById(groupId),
      groupMembersService.list(groupId),
      roundsService.list(groupId),
      paymentsService.getForGroup(groupId),
    ]);

    // Combine and sort activities
    const activities = [
      ...payments.map(p => ({ type: 'payment', ...p })),
      ...rounds.map(r => ({ type: 'round', ...r })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      group,
      members,
      rounds,
      payments,
      activities,
    };
  } catch (error) {
    console.error('Failed to load group activity:', error);
    throw error;
  }
}

// ============================================================================
// Example 8: Error Handling with User Feedback
// ============================================================================

export async function safeApiCall(apiFunction, errorMessage) {
  try {
    return await apiFunction();
  } catch (error) {
    // Log error for debugging
    console.error(errorMessage, error);

    // Handle different error types
    if (error.message.includes('401') || error.message.includes('Not authenticated')) {
      // Redirect to login
      window.location.href = '/login';
      return null;
    }

    if (error.message.includes('403')) {
      // Show permission error
      alert('You do not have permission to perform this action');
      return null;
    }

    if (error.message.includes('404')) {
      // Resource not found
      alert('The requested resource was not found');
      return null;
    }

    // Generic error
    alert(errorMessage + ': ' + error.message);
    return null;
  }
}

// Usage
export async function safeLoadProfile() {
  return safeApiCall(
    () => usersService.getProfile(),
    'Failed to load user profile'
  );
}

// ============================================================================
// Example 9: Optimizing List Updates with Contacts
// ============================================================================

export async function getFrequentContacts() {
  try {
    // Get contacts sorted by interaction frequency
    const contacts = await contactsService.list({
      sort: 'frequency',
      limit: 20,
    });

    return contacts;
  } catch (error) {
    console.error('Failed to get frequent contacts:', error);
    throw error;
  }
}

// ============================================================================
// Example 10: Bill Comment Thread
// ============================================================================

export async function addCommentToBill(billId, commentText, mentionedUserIds = []) {
  try {
    const comment = await billCommentsService.create(billId, {
      content: commentText,
      mentions: mentionedUserIds,
    });

    console.log('Comment added:', comment);
    return comment;
  } catch (error) {
    console.error('Failed to add comment:', error);
    throw error;
  }
}

export async function loadBillWithComments(billId) {
  try {
    const [bill, participants, settlements, comments] = await Promise.all([
      billsService.getById(billId),
      billsService.getById(billId).then(b => b.participants), // Assuming participants are included
      billSettlementsService.list(billId),
      billCommentsService.list(billId),
    ]);

    return {
      bill,
      participants,
      settlements,
      comments,
    };
  } catch (error) {
    console.error('Failed to load bill details:', error);
    throw error;
  }
}
