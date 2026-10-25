export function loopCount(count: number): string {
  return `${count} ${count === 1 ? 'loop' : 'loops'}`;
}

/** "1 loop needs" / "3 loops need". */
export function loopsNeed(count: number): string {
  return `${loopCount(count)} ${count === 1 ? 'needs' : 'need'}`;
}
