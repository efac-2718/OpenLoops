import { splitBrainDump } from '../brain-dump';

describe('splitBrainDump', () => {
  test('keeps a single thought whole, without its closing full stop', () => {
    expect(splitBrainDump('Reply to the landlord about the leak.')).toEqual([
      'Reply to the landlord about the leak',
    ]);
  });

  test('splits dictated sentences into separate thoughts', () => {
    expect(
      splitBrainDump(
        'Reply to the landlord about the leak. Renew my passport before March. Is the gym membership still worth it? Call mum!',
      ),
    ).toEqual([
      'Reply to the landlord about the leak',
      'Renew my passport before March',
      'Is the gym membership still worth it?',
      'Call mum!',
    ]);
  });

  test('splits lines, and drops bullets and numbering', () => {
    expect(splitBrainDump('- Pay rent\n• Book dentist\n\n1. Email Sam\n2) Buy milk')).toEqual([
      'Pay rent',
      'Book dentist',
      'Email Sam',
      'Buy milk',
    ]);
  });

  test('does not split after abbreviations', () => {
    expect(splitBrainDump('Book Dr. Patel for Tuesday. Bring forms, e.g. Insurance card.')).toEqual([
      'Book Dr. Patel for Tuesday',
      'Bring forms, e.g. Insurance card',
    ]);
  });

  test('does not split before a lowercase word or inside a number', () => {
    expect(splitBrainDump('Pay the 3.50 fee at the p.o. office today')).toEqual([
      'Pay the 3.50 fee at the p.o. office today',
    ]);
  });

  test('splits before a digit or a quote', () => {
    expect(splitBrainDump('Call the bank. 3 forms to sign. “Ask about fees” too.')).toEqual([
      'Call the bank',
      '3 forms to sign',
      '“Ask about fees” too',
    ]);
  });

  test('keeps an ellipsis', () => {
    expect(splitBrainDump('Maybe learn the guitar...')).toEqual(['Maybe learn the guitar...']);
  });

  test.each(['', '   ', '\n\n', '- \n1. '])('finds nothing in %j', (text) => {
    expect(splitBrainDump(text)).toEqual([]);
  });
});
