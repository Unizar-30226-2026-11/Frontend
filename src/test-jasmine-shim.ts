import { expect, vi } from 'vitest';

type SpyFn = ReturnType<typeof vi.fn> & {
  and: {
    returnValue(value: unknown): SpyFn;
    resolveTo(value: unknown): SpyFn;
    rejectWith(value: unknown): SpyFn;
    callFake(implementation: (...args: unknown[]) => unknown): SpyFn;
    stub(): SpyFn;
  };
  calls: {
    count(): number;
    reset(): void;
    mostRecent(): { args: unknown[] } | undefined;
  };
};

function attachJasmineAnd(spy: ReturnType<typeof vi.fn>): SpyFn {
  const typedSpy = spy as SpyFn;
  typedSpy.and = {
    returnValue(value: unknown): SpyFn {
      typedSpy.mockReturnValue(value);
      return typedSpy;
    },
    resolveTo(value: unknown): SpyFn {
      typedSpy.mockResolvedValue(value);
      return typedSpy;
    },
    rejectWith(value: unknown): SpyFn {
      typedSpy.mockRejectedValue(value);
      return typedSpy;
    },
    callFake(implementation: (...args: unknown[]) => unknown): SpyFn {
      typedSpy.mockImplementation(implementation);
      return typedSpy;
    },
    stub(): SpyFn {
      typedSpy.mockImplementation(() => undefined);
      return typedSpy;
    },
  };
  typedSpy.calls = {
    count(): number {
      return typedSpy.mock.calls.length;
    },
    reset(): void {
      typedSpy.mockClear();
    },
    mostRecent(): { args: unknown[] } | undefined {
      const lastCall = typedSpy.mock.calls.at(-1);
      return lastCall ? { args: lastCall } : undefined;
    },
  };

  return typedSpy;
}

const jasmineCompat = {
  createSpy(name?: string): SpyFn {
    return attachJasmineAnd(vi.fn().mockName(name ?? 'jasmineSpy'));
  },
  createSpyObj<T>(baseName: string, methodNames: string[]): jasmine.SpyObj<T> {
    const spyObject: Record<string, unknown> = {};
    for (const methodName of methodNames) {
      spyObject[methodName] = attachJasmineAnd(
        vi.fn().mockName(`${baseName}.${methodName}`)
      );
    }

    return spyObject as jasmine.SpyObj<T>;
  },
  objectContaining<T extends object>(value: T): T {
    return expect.objectContaining(value) as T;
  },
  any<T>(constructor: new (...args: never[]) => T): T {
    return expect.any(constructor) as T;
  },
};

Object.assign(globalThis, {
  jasmine: jasmineCompat,
});

expect.extend({
  toBeTrue(received: unknown) {
    const pass = received === true;
    return {
      pass,
      message: () =>
        `expected ${String(received)} ${pass ? 'not ' : ''}to be true`,
    };
  },
  toBeFalse(received: unknown) {
    const pass = received === false;
    return {
      pass,
      message: () =>
        `expected ${String(received)} ${pass ? 'not ' : ''}to be false`,
    };
  },
  toHaveBeenCalledOnceWith(received: { mock?: { calls?: unknown[][] } }, ...expectedArgs: unknown[]) {
    const calls = received?.mock?.calls ?? [];
    const pass =
      calls.length === 1 &&
      this.equals(calls[0], expectedArgs);

    return {
      pass,
      message: () =>
        `expected spy ${pass ? 'not ' : ''}to have been called exactly once with ${this.utils.printExpected(expectedArgs)}, received ${this.utils.printReceived(calls)}`,
    };
  },
});
