/** Machine-readable reasons for rejecting invalid domain input or state. */
export type DomainErrorCode =
  | 'INVALID_ARGUMENT'
  | 'INVALID_SEED'
  | 'INVALID_HORSE'
  | 'INVALID_ROSTER'
  | 'INVALID_ROUND'
  | 'INVALID_LINEUP'
  | 'INVALID_TICK_COUNT'
  | 'INVALID_PACE'
  | 'SIMULATION_LIMIT';

/**
 * The single error type thrown by the domain layer. Callers can branch on
 * `code` instead of parsing messages. The domain never returns `NaN` or a
 * partially valid entity: it throws.
 */
export class DomainError extends Error {
  override readonly name = 'DomainError';
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Throws a {@link DomainError} with `code` unless `condition` holds. */
export function invariant(
  condition: unknown,
  code: DomainErrorCode,
  message: string,
): asserts condition {
  if (!condition) throw new DomainError(code, message);
}

/** Asserts that `value` is an integer within `[min, max]`. */
export function assertIntegerInRange(
  value: number,
  min: number,
  max: number,
  code: DomainErrorCode,
  label: string,
): void {
  invariant(
    Number.isInteger(value) && value >= min && value <= max,
    code,
    `${label} must be an integer in [${min}, ${max}], received ${String(value)}.`,
  );
}
