import { vi } from 'vitest';

Object.defineProperty(window, 'indexedDB', {
  value: {
    open: vi.fn(),
    deleteDatabase: vi.fn(),
    databases: vi.fn().mockResolvedValue([]),
  },
});

Object.defineProperty(window, 'IDBKeyRange', {
  value: {
    bound: vi.fn((lower, upper) => ({ lower, upper })),
    lowerBound: vi.fn((lower) => ({ lower })),
    upperBound: vi.fn((upper) => ({ upper })),
    only: vi.fn((value) => ({ value })),
  },
});
