export function ok<T>(data: T) {
  return { success: true as const, data };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return { success: true as const, data, meta: { total, page, limit } };
}