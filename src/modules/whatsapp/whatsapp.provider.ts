/**
 * Provider abstraction so a Meta WhatsApp Business API implementation can drop
 * in later without touching callers. V1 only builds click-to-chat links.
 */
export interface WhatsAppSendResult {
  channel: 'WHATSAPP_MANUAL' | 'WHATSAPP_API';
  link?: string;
  delivered: boolean;
}

export interface WhatsAppProvider {
  prepare(phone: string, message: string): WhatsAppSendResult;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

export class ManualWhatsAppProvider implements WhatsAppProvider {
  prepare(phone: string, message: string): WhatsAppSendResult {
    const digits = normalizePhone(phone);
    return {
      channel: 'WHATSAPP_MANUAL',
      link: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      delivered: false,
    };
  }
}

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
