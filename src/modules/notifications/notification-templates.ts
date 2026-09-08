import { NotificationType } from '../../common/enums';

export interface BilingualText {
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
}

type Vars = Record<string, string | number>;

function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

const TEMPLATES: Record<NotificationType, BilingualText> = {
  [NotificationType.SUBSCRIPTION_CREATED]: {
    titleAr: 'تم إنشاء اشتراك',
    titleEn: 'Subscription created',
    messageAr: 'تم إنشاء اشتراك في باقة {plan}. أكمل الدفع لتفعيله.',
    messageEn: 'A subscription to {plan} was created. Complete payment to activate it.',
  },
  [NotificationType.SUBSCRIPTION_ACTIVATED]: {
    titleAr: 'تم تفعيل اشتراكك',
    titleEn: 'Subscription activated',
    messageAr: 'اشتراكك في {plan} أصبح نشطًا حتى {endDate}.',
    messageEn: 'Your {plan} membership is now active until {endDate}.',
  },
  [NotificationType.SUBSCRIPTION_EXPIRING]: {
    titleAr: 'اشتراكك قارب على الانتهاء',
    titleEn: 'Membership expiring soon',
    messageAr: 'ينتهي اشتراكك خلال {days} يومًا ({endDate}). جدّد الآن.',
    messageEn: 'Your membership ends in {days} day(s) on {endDate}. Renew now.',
  },
  [NotificationType.SUBSCRIPTION_EXPIRED]: {
    titleAr: 'انتهى اشتراكك',
    titleEn: 'Membership expired',
    messageAr: 'انتهى اشتراكك في {endDate}. جدّد للاستمرار في الدخول.',
    messageEn: 'Your membership expired on {endDate}. Renew to keep training.',
  },
  [NotificationType.SUBSCRIPTION_FROZEN]: {
    titleAr: 'تم تجميد اشتراكك',
    titleEn: 'Membership frozen',
    messageAr: 'تم تجميد اشتراكك لمدة {days} يومًا. تاريخ الانتهاء الجديد {endDate}.',
    messageEn: 'Your membership is frozen for {days} day(s). New end date: {endDate}.',
  },
  [NotificationType.PAYMENT_SUBMITTED]: {
    titleAr: 'تم استلام إثبات الدفع',
    titleEn: 'Payment received',
    messageAr: 'استلمنا إثبات الدفع بمبلغ {amount}. سيتم مراجعته قريبًا.',
    messageEn: 'We received your payment proof of {amount}. It is now under review.',
  },
  [NotificationType.PAYMENT_APPROVED]: {
    titleAr: 'تمت الموافقة على الدفع',
    titleEn: 'Payment approved',
    messageAr: 'تمت الموافقة على دفعتك بمبلغ {amount}. إيصال رقم {receipt}.',
    messageEn: 'Your payment of {amount} was approved. Receipt {receipt}.',
  },
  [NotificationType.PAYMENT_REJECTED]: {
    titleAr: 'تم رفض الدفع',
    titleEn: 'Payment rejected',
    messageAr: 'تم رفض إثبات الدفع. السبب: {reason}. يمكنك إرسال إثبات جديد.',
    messageEn: 'Your payment proof was rejected. Reason: {reason}. You can submit a new one.',
  },
  [NotificationType.PAYMENT_REFUNDED]: {
    titleAr: 'تم تسجيل استرداد',
    titleEn: 'Refund recorded',
    messageAr: 'تم تسجيل استرداد بمبلغ {amount} بتاريخ {date}.',
    messageEn: 'A refund of {amount} was recorded on {date}.',
  },
  [NotificationType.QR_ISSUED]: {
    titleAr: 'بطاقة الدخول جاهزة',
    titleEn: 'Access QR ready',
    messageAr: 'تم إصدار بطاقة QR للدخول لاشتراكك في {plan}، صالحة حتى {endDate}.',
    messageEn: 'An access QR was issued for your {plan} membership, valid until {endDate}.',
  },
  [NotificationType.ANNOUNCEMENT]: {
    titleAr: '{title}',
    titleEn: '{title}',
    messageAr: '{body}',
    messageEn: '{body}',
  },
  [NotificationType.PROMOTION]: {
    titleAr: '{title}',
    titleEn: '{title}',
    messageAr: '{body}',
    messageEn: '{body}',
  },
  [NotificationType.SYSTEM]: {
    titleAr: '{title}',
    titleEn: '{title}',
    messageAr: '{body}',
    messageEn: '{body}',
  },
};

export function renderNotification(type: NotificationType, vars: Vars = {}): BilingualText {
  const tpl = TEMPLATES[type];
  return {
    titleAr: fill(tpl.titleAr, vars),
    titleEn: fill(tpl.titleEn, vars),
    messageAr: fill(tpl.messageAr, vars),
    messageEn: fill(tpl.messageEn, vars),
  };
}
