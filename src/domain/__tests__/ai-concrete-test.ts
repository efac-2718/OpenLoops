import { buildConcreteRequest, readConcrete, validateConcreteRequest } from '../ai-concrete';

test('builds a request from the loop and the next action so far', () => {
  expect(buildConcreteRequest({ title: 'Taxes', notes: null }, '  sort out taxes ')).toEqual({
    title: 'Taxes',
    notes: null,
    nextAction: 'sort out taxes',
  });
});

test('what it builds passes the server check', () => {
  const built = buildConcreteRequest({ title: 'Taxes', notes: 'Due in May' }, '');
  expect(validateConcreteRequest(JSON.parse(JSON.stringify(built)))).toEqual({ ok: true, value: built });
});

test.each([
  ['not an object', 'Taxes'],
  ['no title', { title: ' ', notes: null, nextAction: '' }],
  ['notes that are not text', { title: 'Taxes', notes: 3, nextAction: '' }],
  ['no next action field', { title: 'Taxes', notes: null }],
  ['a huge next action', { title: 'Taxes', notes: null, nextAction: 'x'.repeat(1001) }],
])('the server check rejects %s', (_, body) => {
  expect(validateConcreteRequest(body)).toEqual({ ok: false, error: 'invalid' });
});

test('reads the next action and reason, trimmed', () => {
  expect(readConcrete({ next_action: ' Find the tax form ', reason: ' It starts it. ' })).toEqual({
    nextAction: 'Find the tax form',
    reason: 'It starts it.',
  });
  expect(readConcrete({ next_action: 'Find the tax form' })).toEqual({ nextAction: 'Find the tax form', reason: '' });
});

test.each([null, 'text', {}, { next_action: '  ' }, { next_action: 3 }])('reads %j as nothing', (answer) => {
  expect(readConcrete(answer)).toBeNull();
});
