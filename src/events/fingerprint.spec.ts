import { fingerprint } from './fingerprint';

describe('fingerprint', () => {
  it('ignores object key order recursively', () => {
    expect(fingerprint({ b: { y: 2, x: 1 }, a: [1, 2] })).toBe(
      fingerprint({ a: [1, 2], b: { x: 1, y: 2 } }),
    );
  });
  it('preserves array order and value types', () => {
    expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
    expect(fingerprint({ x: 1 })).not.toBe(fingerprint({ x: '1' }));
  });
});
