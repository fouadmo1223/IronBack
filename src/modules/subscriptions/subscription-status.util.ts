import { SubscriptionStatus } from '../../common/enums';
import { DAY_MS } from './subscriptions.constants';
import { SubscriptionDocument } from './schemas/subscription.schema';

export interface ResolvedSubscription {
  status: SubscriptionStatus;
  daysRemaining: number;
  isUsable: boolean;
}

/**
 * Single source of truth for a subscription's effective status.
 * Explicit states win; ACTIVE is refined into EXPIRING_SOON / EXPIRED by date.
 */
export function resolveSubscription(
  sub: Pick<SubscriptionDocument, 'status' | 'endDate'>,
  expiringSoonThresholdDays: number,
  now: Date = new Date(),
): ResolvedSubscription {
  if (
    sub.status === SubscriptionStatus.CANCELLED ||
    sub.status === SubscriptionStatus.FROZEN ||
    sub.status === SubscriptionStatus.PENDING_PAYMENT ||
    sub.status === SubscriptionStatus.PAYMENT_UNDER_REVIEW
  ) {
    return { status: sub.status, daysRemaining: 0, isUsable: false };
  }

  if (!sub.endDate) {
    return { status: SubscriptionStatus.PENDING_PAYMENT, daysRemaining: 0, isUsable: false };
  }

  const msLeft = sub.endDate.getTime() - now.getTime();

  if (msLeft <= 0) {
    return { status: SubscriptionStatus.EXPIRED, daysRemaining: 0, isUsable: false };
  }

  // Whole calendar days between today and the end date, so a 30-day sub that
  // started yesterday reads "29 days" (not "30"), and the final partial day
  // still reads "1" rather than "0" while it is genuinely usable.
  const dayStart = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const daysRemaining = Math.max(
    1,
    Math.round((dayStart(sub.endDate.getTime()) - dayStart(now.getTime())) / DAY_MS),
  );

  if (daysRemaining <= expiringSoonThresholdDays) {
    return { status: SubscriptionStatus.EXPIRING_SOON, daysRemaining, isUsable: true };
  }
  return { status: SubscriptionStatus.ACTIVE, daysRemaining, isUsable: true };
}
