import { auth } from '@/lib/firebase';
import type { AppSettings, CountryPartner, Deposit, Package, TaskType, User, WithdrawalRequest } from '@/lib/types';
import type { ModelModality } from '@/ai/models';

async function authedJsonRequest(path: string, body: Record<string, unknown>) {
  if (!auth?.currentUser) {
    return { success: false, message: 'You must be logged in as admin.' };
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => ({ success: false, message: 'Invalid server response.' }));
  if (!response.ok && result.success !== false) {
    return { success: false, message: 'Request failed.' };
  }

  return result;
}

async function runAdminAction(action: string, payload: Record<string, unknown>) {
  return authedJsonRequest('/api/admin/actions', { action, payload });
}

export async function createAdminTask(data: {
  title: string;
  description: string;
  points: number;
  type: TaskType;
  options: string[];
  expertise?: string;
}) {
  return runAdminAction('createAdminTask', { data });
}

export async function bulkCreateAdminTasks(data: { count: number; expertise: string[]; taskTypes: TaskType[]; minPoints?: number; maxPoints?: number; model?: string }) {
  return runAdminAction('bulkCreateAdminTasks', data);
}

export async function deleteAdminTask(taskId: string) {
  return runAdminAction('deleteAdminTask', { taskId });
}

export async function updateAdminTaskStatus(taskId: string, status: 'Active' | 'Paused') {
  return runAdminAction('updateAdminTaskStatus', { taskId, status });
}

export async function deleteAllAdminTasks() {
  return runAdminAction('deleteAllAdminTasks', {});
}

export async function createAdminPackage(data: Omit<Package, 'id'>) {
  return runAdminAction('createAdminPackage', { data });
}

export async function updateAdminPackage(id: string, data: Omit<Package, 'id'>) {
  return runAdminAction('updateAdminPackage', { id, data });
}

export async function deleteAdminPackage(id: string) {
  return runAdminAction('deleteAdminPackage', { id });
}

export async function updateAdminUser(userId: string, data: Partial<Pick<User, 'packageId' | 'role' | 'earningsBalance' | 'depositBalance' | 'expertise' | 'referralEligible'>>) {
  return runAdminAction('updateAdminUser', { userId, data });
}

export async function adjustReferralBalance(userId: string, amount: number, reason: string) {
  return runAdminAction('adjustReferralBalance', { userId, amount, reason });
}

export async function deleteAdminUser(userId: string) {
  return runAdminAction('deleteAdminUser', { userId });
}

export async function clearAdminUserTransactions(userId: string) {
  return runAdminAction('clearAdminUserTransactions', { userId });
}

export async function updateWithdrawalRequestStatus(requestId: string, newStatus: WithdrawalRequest['status']) {
  return runAdminAction('updateWithdrawalRequestStatus', { requestId, newStatus });
}

export async function cancelWithdrawalRequest(requestId: string) {
  return runAdminAction('cancelWithdrawalRequest', { requestId });
}

export async function updateDepositStatus(depositId: string, newStatus: Deposit['status']) {
  return runAdminAction('updateDepositStatus', { depositId, newStatus });
}

export async function updateUserApprovalStatus(userId: string, status: 'approved' | 'rejected') {
  return runAdminAction('updateUserApprovalStatus', { userId, status });
}

export async function bulkUpdateUserApprovalStatus(ids: string[] | 'all', status: 'approved' | 'rejected') {
  return runAdminAction('bulkUpdateUserApprovalStatus', { ids, status });
}

export async function createCountryPartner(data: {
  userId: string;
  country: string;
  depositFeePercent: number;
  withdrawalFeePercent: number;
}) {
  return runAdminAction('createCountryPartner', { data });
}

export async function updateCountryPartner(partnerId: string, data: Partial<CountryPartner>) {
  return runAdminAction('updateCountryPartner', { partnerId, data });
}

export async function deleteCountryPartner(partnerId: string) {
  return runAdminAction('deleteCountryPartner', { partnerId });
}

export async function getPartnerAdminData() { return runAdminAction('getPartnerAdminData', {}); }
export async function reviewPartnerApplication(applicationId: string, decision: 'approved' | 'rejected', data: Record<string, unknown>) { return runAdminAction('reviewPartnerApplication', { applicationId, decision, data }); }
export async function updatePartnerProgramSettings(data: Record<string, unknown>) { return runAdminAction('updatePartnerProgramSettings', { data }); }
export async function reviewPartnerFunding(requestId: string, decision: 'approved' | 'rejected') { return runAdminAction('reviewPartnerFunding', { requestId, decision }); }
export async function adjustPartnerWallet(partnerId: string, amount: number, reason: string) { return runAdminAction('adjustPartnerWallet', { partnerId, amount, reason }); }
export async function resolvePartnerTransaction(transactionId: string, resolution: 'complete' | 'cancel', note: string) { return runAdminAction('resolvePartnerTransaction', { transactionId, resolution, note }); }

export async function generateAndSaveQualificationTest(expertise: string) {
  return runAdminAction('generateAndSaveQualificationTest', { expertise });
}

export async function toggleQualificationTestStatus(expertise: string, isEnabled: boolean) {
  return runAdminAction('toggleQualificationTestStatus', { expertise, isEnabled });
}

export async function deleteQualificationQuestion(expertise: string, questionIndex: number) {
  return runAdminAction('deleteQualificationQuestion', { expertise, questionIndex });
}

export async function recordExpense(data: { amount: number; category: string; note?: string }) {
  return runAdminAction('recordExpense', data);
}

export async function updateAppSettings(data: AppSettings) {
  if (!auth?.currentUser) {
    return { success: false, message: 'You must be logged in as admin.' };
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => ({ success: false, message: 'Invalid server response.' }));
  if (!response.ok && result.success !== false) {
    return { success: false, message: 'Failed to update settings.' };
  }

  return result;
}

export async function testAdminModel(modality: ModelModality, model: string) {
  return runAdminAction('testAdminModel', { modality, model });
}
