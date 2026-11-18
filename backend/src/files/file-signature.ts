import { createHmac, timingSafeEqual } from 'node:crypto';

/*
 * Order print files and corporate logos (stored with ownerId 'system') are
 * customers' private files. Their ids are only ever handed out signed, as
 * "<id>.<signature>", and GET /api/files/:ref refuses them without a valid
 * signature, so an id can't be guessed or counted up to reach someone
 * else's file. Product and page images stay public under the plain id.
 */

export const PRIVATE_OWNER = 'system';

const secret = () => `files:${process.env.FILES_SECRET || process.env.JWT_SECRET || ''}`;

export const fileSignature = (id: string) => createHmac('sha256', secret()).update(id).digest('base64url').slice(0, 22);

/** "<id>.<signature>" for a private file id (undefined stays undefined). */
export function signFileId<T extends string | undefined | null>(id: T): T {
  return (id ? `${id}.${fileSignature(id)}` : id) as T;
}

/** Splits "<id>.<signature>" and says whether the signature is right. */
export function parseFileRef(ref: string) {
  const [id, sig = ''] = String(ref).split('.', 2);
  const expected = Buffer.from(fileSignature(id));
  const given = Buffer.from(sig);
  return { id, signed: given.length === expected.length && timingSafeEqual(given, expected) };
}
