export type AccessInput = { paidMode: boolean; admin: boolean; trialEndsAt?: string | null; subscriptionEndsAt?: string | null };

export function showAdminNavigation(signedIn: boolean, isAdmin: boolean) {
  return signedIn && isAdmin;
}

export function hasSubscriptionAccess(input: AccessInput, now = Date.now()) {
  if (!input.paidMode || input.admin) return true;
  return [input.trialEndsAt, input.subscriptionEndsAt].some(value => Boolean(value) && Date.parse(value ?? "") > now);
}

export function validSubscriptionSettings(trialDays: number, monthly: number | null, yearly: number | null, paid: boolean) {
  return [1, 2].includes(trialDays) && [monthly, yearly].every(value => value === null || (Number.isFinite(value) && value > 0)) && (!paid || (monthly !== null && yearly !== null));
}