import { createHash, randomBytes } from 'crypto';
import { Types } from 'mongoose';

/** Coerce a string | ObjectId into an ObjectId (Mongoose does not always auto-cast in nested query keys). */
export function toObjectId(value: string | Types.ObjectId): Types.ObjectId {
  return typeof value === 'string' ? new Types.ObjectId(value) : value;
}

/** URL-safe random opaque token (default 48 bytes -> 64 base64url chars). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** Deterministic SHA-256 hex digest — used to store QR / refresh tokens at rest. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Human-typable access-card code: fixed length (default 8), uppercase letters and
 * digits only, with visually ambiguous characters removed (0/O, 1/I/L). Random,
 * not sequential — so a printed code reveals nothing about how many exist.
 */
export function generateCardCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
