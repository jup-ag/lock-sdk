export async function p<T, E = Error>(
  fn: Promise<T>
): Promise<[T, null] | [null, E]> {
  try {
    return [await fn, null];
  } catch (error: any) {
    return [null, error ?? new Error("[p-flat] unknown nullish error")];
  }
}
