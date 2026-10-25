import { timeAgo } from '../time-ago';

const now = new Date(2026, 9, 28, 21, 30);

test.each([
  [new Date(2026, 9, 28, 21, 29, 30), 'just now'],
  [new Date(2026, 9, 28, 21, 5), '25 min ago'],
  [new Date(2026, 9, 28, 9, 0), '12 h ago'],
  [new Date(2026, 9, 27, 23, 0), 'yesterday'],
  [new Date(2026, 9, 25, 8, 0), '3 days ago'],
])('%s is "%s"', (date, expected) => {
  expect(timeAgo(date, now)).toBe(expected);
});
