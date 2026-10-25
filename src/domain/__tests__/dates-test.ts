import { addDays, dayKey, parseDayKey, revisitOptions, scheduleOptions, startOfDay } from '../dates';

const labelled = (options: { label: string; date: Date }[]) =>
  options.map(({ label, date }) => [label, date.toDateString()]);

describe('startOfDay / addDays', () => {
  test('drops the time of day', () => {
    expect(startOfDay(new Date(2026, 9, 28, 23, 59))).toEqual(new Date(2026, 9, 28));
  });

  test('rolls over month ends at local midnight', () => {
    expect(addDays(new Date(2026, 9, 31, 18), 1)).toEqual(new Date(2026, 10, 1));
  });
});

describe('dayKey', () => {
  test('is the local calendar day, zero-padded', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 9, 28, 0, 0))).toBe('2026-10-28');
  });
});

describe('scheduleOptions', () => {
  test('on a weekday offers today, tomorrow, the weekend, and next Monday', () => {
    const wednesday = new Date(2026, 9, 28, 21, 30);
    expect(labelled(scheduleOptions(wednesday))).toEqual([
      ['Today', 'Wed Oct 28 2026'],
      ['Tomorrow', 'Thu Oct 29 2026'],
      ['This weekend', 'Sat Oct 31 2026'],
      ['Next week', 'Mon Nov 02 2026'],
    ]);
  });

  test('on a weekend leaves out "This weekend"', () => {
    const saturday = new Date(2026, 9, 31, 10);
    expect(labelled(scheduleOptions(saturday))).toEqual([
      ['Today', 'Sat Oct 31 2026'],
      ['Tomorrow', 'Sun Nov 01 2026'],
      ['Next week', 'Mon Nov 02 2026'],
    ]);
  });

  test('on a Monday "Next week" is the following Monday', () => {
    const monday = new Date(2026, 9, 26, 9);
    expect(scheduleOptions(monday).at(-1)?.date).toEqual(new Date(2026, 10, 2));
  });

  test('on a Friday leaves out "This weekend", which would repeat "Tomorrow"', () => {
    const friday = new Date(2026, 9, 30, 18);
    expect(labelled(scheduleOptions(friday))).toEqual([
      ['Today', 'Fri Oct 30 2026'],
      ['Tomorrow', 'Sat Oct 31 2026'],
      ['Next week', 'Mon Nov 02 2026'],
    ]);
  });

  test('on a Sunday "Next week" is not tomorrow', () => {
    const sunday = new Date(2026, 9, 25, 21);
    expect(labelled(scheduleOptions(sunday))).toEqual([
      ['Today', 'Sun Oct 25 2026'],
      ['Tomorrow', 'Mon Oct 26 2026'],
      ['Next week', 'Mon Nov 02 2026'],
    ]);
  });

  test.each([24, 25, 26, 27, 28, 29, 30])('never offers the same day twice (Oct %i)', (day) => {
    const days = scheduleOptions(new Date(2026, 9, day, 12)).map(({ date }) => date.getTime());
    expect(new Set(days).size).toBe(days.length);
  });
});

describe('revisitOptions', () => {
  test('offers days from tomorrow out to a month', () => {
    expect(labelled(revisitOptions(new Date(2026, 9, 28, 21, 30)))).toEqual([
      ['Tomorrow', 'Thu Oct 29 2026'],
      ['In 3 days', 'Sat Oct 31 2026'],
      ['In a week', 'Wed Nov 04 2026'],
      ['In a month', 'Fri Nov 27 2026'],
    ]);
  });
});

describe('parseDayKey', () => {
  test('reads a day key back as local midnight', () => {
    expect(parseDayKey('2026-10-28')).toEqual(new Date(2026, 9, 28));
    expect(dayKey(parseDayKey('2026-01-05')!)).toBe('2026-01-05');
  });

  test.each(['2026-02-30', '2026-13-01', '26-10-28', '2026-10-28T10:00', 'tomorrow', ''])(
    'rejects %j',
    (key) => {
      expect(parseDayKey(key)).toBeNull();
    },
  );
});
