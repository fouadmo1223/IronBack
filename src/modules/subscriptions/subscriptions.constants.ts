import { SubscriptionStatus } from '../../common/enums';

/** Statuses that block a member from starting another subscription. */
export const BLOCKING_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.PENDING_PAYMENT,
  SubscriptionStatus.PAYMENT_UNDER_REVIEW,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.EXPIRING_SOON,
  SubscriptionStatus.FROZEN,
];

/** Explicit (persisted) statuses — the rest are derived from dates. */
export const PERSISTED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.PENDING_PAYMENT,
  SubscriptionStatus.PAYMENT_UNDER_REVIEW,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.FROZEN,
  SubscriptionStatus.CANCELLED,
];

export const DAY_MS = 86_400_000;
