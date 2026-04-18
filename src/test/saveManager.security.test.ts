import { describe, it, expect, vi } from 'vitest';
import { loadGame, deleteSave } from '../cli/saveManager';

// loadGame / deleteSave both touch the filesystem; mock fs so nothing
// actually escapes the test process. We only care that path traversal
// inputs are rejected before any fs call happens.
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(() => []),
  },
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}));

describe('saveManager id sanitisation', () => {
  it('rejects ids containing path separators', () => {
    expect(() => loadGame('../../etc/passwd')).toThrow(/invalid save id/i);
    expect(() => deleteSave('../foo')).toThrow(/invalid save id/i);
  });

  it('rejects empty / dotted / mixed ids', () => {
    expect(() => loadGame('')).toThrow(/invalid save id/i);
    expect(() => loadGame('.')).toThrow(/invalid save id/i);
    expect(() => loadGame('..')).toThrow(/invalid save id/i);
    expect(() => loadGame('save_../oops')).toThrow(/invalid save id/i);
    expect(() => loadGame('save_123abc')).toThrow(/invalid save id/i);
  });

  it('accepts valid id shape save_<digits>', () => {
    expect(() => loadGame('save_1700000000000')).not.toThrow();
    expect(() => deleteSave('save_1700000000000')).not.toThrow();
  });
});
