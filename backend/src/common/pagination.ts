import type { Model } from 'mongoose';

export const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface PageQuery {
  page?: string;
  pageSize?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Page number and size from query strings, clamped to sane bounds. */
export function pageParams(query: PageQuery) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.pageSize)) || DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}

/** Case-insensitive "contains" regex from user input (special chars escaped). */
export function searchRegex(q?: string) {
  const text = q?.trim();
  return text ? new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
}

/** Runs `filter` on `model` and returns one page plus the total count. */
export async function paginate<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  query: PageQuery,
  sort: Record<string, 1 | -1> = { createdAt: -1, _id: -1 },
): Promise<Page<T>> {
  const { page, pageSize } = pageParams(query);
  const [items, total] = await Promise.all([
    model.find(filter).sort(sort).skip((page - 1) * pageSize).limit(pageSize).exec(),
    model.countDocuments(filter).exec(),
  ]);
  return { items: items as unknown as T[], total, page, pageSize };
}

/** { STATUS: count } for a status field, ignoring the status filter itself. */
export async function countBy<T>(model: Model<T>, filter: Record<string, unknown>, field: string) {
  const rows = await model.aggregate<{ _id: string; count: number }>([
    { $match: filter },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}
