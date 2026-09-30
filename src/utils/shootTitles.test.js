import { shortenTitle } from './shootTitles.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(shortenTitle('Boston Celtics vs New York Knicks') === 'Celtics vs Knicks', 'normal vs shortens');
assert(
  shortenTitle('Boston Celtics vs New York Knicks (Manual)') === 'Boston Celtics vs New York Knicks (Manual)',
  'manual suffix keeps full title'
);
assert(
  shortenTitle('Kansas City Current vs (Manual)') === 'Kansas City Current vs (Manual)',
  'does not collapse opponent to (Manual)'
);
assert(shortenTitle('Manual — Lady Gaga') === 'Manual — Lady Gaga', 'manual concert keeps full title');
assert(shortenTitle('NWSL photo manual') === 'NWSL photo manual', 'manual word keeps full title');
assert(shortenTitle('Charlotte FC vs Pride') === 'Charlotte FC vs Pride', 'exempt home team');

console.log('shootTitles.test.js: ok');
