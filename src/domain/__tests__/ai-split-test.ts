import { MAX_SPLIT_LOOPS, readSplit, validateSplitRequest } from '../ai-split';

test('the server check takes text up to 4000 characters', () => {
  expect(validateSplitRequest({ text: 'Call mum' })).toEqual({ ok: true, value: { text: 'Call mum' } });
  expect(validateSplitRequest({ text: 'x'.repeat(4001) })).toEqual({ ok: false, error: 'invalid' });
  expect(validateSplitRequest({ text: '   ' })).toEqual({ ok: false, error: 'invalid' });
  expect(validateSplitRequest(null)).toEqual({ ok: false, error: 'invalid' });
});

test('turns each loop into a title, with the words it came from as notes', () => {
  expect(
    readSplit({
      loops: [
        { title: ' Fix the bike ', words: ' and I really need to fix the bike before the weekend ' },
        { title: 'Call mum', words: 'Call mum.' },
        { title: 'Money worries', words: '' },
      ],
    }),
  ).toEqual([
    { title: 'Fix the bike', notes: 'and I really need to fix the bike before the weekend' },
    // Words that only repeat the title aren't worth keeping as notes.
    { title: 'Call mum', notes: null },
    { title: 'Money worries', notes: null },
  ]);
});

test('skips loops without a title', () => {
  expect(readSplit({ loops: [{ title: ' ', words: 'um' }, { title: 'Call mum', words: 'Call mum' }] })).toEqual([
    { title: 'Call mum', notes: null },
  ]);
});

test(`keeps at most ${MAX_SPLIT_LOOPS} loops`, () => {
  const loops = Array.from({ length: 30 }, (_, index) => ({ title: `Loop ${index}`, words: '' }));
  expect(readSplit({ loops })).toHaveLength(MAX_SPLIT_LOOPS);
});

test.each([null, {}, { loops: 'no' }, { loops: [] }, { loops: [{ title: '' }] }])('reads %j as nothing', (answer) => {
  expect(readSplit(answer)).toBeNull();
});
