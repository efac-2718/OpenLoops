import { CLOSE_TIME_OPTIONS, formatCloseTime, parseCloseTime, sameCloseTime } from '../reminder';

describe('parseCloseTime', () => {
  test('reads a stored HH:MM time', () => {
    expect(parseCloseTime('21:30')).toEqual({ hour: 21, minute: 30 });
    expect(parseCloseTime('08:05')).toEqual({ hour: 8, minute: 5 });
  });

  test.each([undefined, null, '', 'off', '9:30', '24:00', '21:60', '21:30:00'])(
    'treats %j as no reminder',
    (value) => {
      expect(parseCloseTime(value)).toBeNull();
    },
  );
});

test('every offered time round-trips through storage', () => {
  for (const time of CLOSE_TIME_OPTIONS) {
    expect(parseCloseTime(formatCloseTime(time))).toEqual(time);
  }
});

test('sameCloseTime compares hour and minute, and never matches no reminder', () => {
  expect(sameCloseTime({ hour: 21, minute: 30 }, { hour: 21, minute: 30 })).toBe(true);
  expect(sameCloseTime({ hour: 21, minute: 30 }, { hour: 22, minute: 30 })).toBe(false);
  expect(sameCloseTime(null, null)).toBe(false);
});
