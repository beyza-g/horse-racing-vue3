import { describe, expect, it } from 'vitest';
import { assertIntegerInRange, DomainError, invariant } from './errors';

describe('DomainError', () => {
  it('is an Error with a stable name and machine-readable code', () => {
    const error = new DomainError('INVALID_SEED', 'bad seed');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DomainError');
    expect(error.code).toBe('INVALID_SEED');
    expect(error.message).toBe('bad seed');
  });
});

describe('invariant', () => {
  it('passes silently when the condition holds', () => {
    expect(() => {
      invariant(true, 'INVALID_ARGUMENT', 'never');
    }).not.toThrow();
  });

  it('throws a DomainError with the given code when the condition fails', () => {
    expect(() => {
      invariant(0, 'INVALID_LINEUP', 'empty');
    }).toThrow(expect.objectContaining({ code: 'INVALID_LINEUP', message: 'empty' }));
  });
});

describe('assertIntegerInRange', () => {
  it.each([1, 50, 100])('accepts %s within [1, 100]', (value) => {
    expect(() => {
      assertIntegerInRange(value, 1, 100, 'INVALID_HORSE', 'Value');
    }).not.toThrow();
  });

  it.each([0, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY, -1])('rejects %s', (value) => {
    expect(() => {
      assertIntegerInRange(value, 1, 100, 'INVALID_HORSE', 'Value');
    }).toThrow(expect.objectContaining({ code: 'INVALID_HORSE' }));
  });
});
