import { isNoiseFragment, isTooShortForDecline } from '../src/aichat/fragments';

test('noise fragments from the 2026-11-10 phone session', () => {
  for (const t of ['The.', 'But.', 'Boy.', 'Alma Alma.', 'é...', 'então', 'Um.', 'hmm', '']) expect(isNoiseFragment(t)).toBe(true);
});
test('short real requests are not noise', () => {
  for (const t of ['Really fast.', 'stop', 'sim', 'yes', 'fecha tudo', 'volume up', 'bom dia', 'abre o vidro', 'vinte e dois', '22', 'Can you open the windows?'])
    expect(isNoiseFragment(t)).toBe(false);
});
test('a declined request of two words or fewer is treated as unclear', () => {
  expect(isTooShortForDecline('Alma Alma.')).toBe(true);
  expect(isTooShortForDecline('abre o capô')).toBe(false);
  expect(isTooShortForDecline('open the hood')).toBe(false);
});

import { isBareDone } from '../src/aichat/fragments';
test('a bare Done is recognized, a real confirmation is not', () => {
  for (const t of ['Done.', 'done', 'Pronto.', 'Feito!', 'Ok, feito.', 'All set.']) expect(isBareDone(t)).toBe(true);
  for (const t of ['I set the fan to level 4.', 'Done: fan speed 4.', 'Pronto, abri o vidro.']) expect(isBareDone(t)).toBe(false);
});
