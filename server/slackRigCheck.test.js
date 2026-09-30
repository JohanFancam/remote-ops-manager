import { normalizeRigCheckDelivery, slackOpenHref } from './slackRigCheckUtils.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(normalizeRigCheckDelivery('post') === 'post', 'post mode');
assert(normalizeRigCheckDelivery('BOTH') === 'both', 'both mode');
assert(normalizeRigCheckDelivery('nope') === 'copy_open', 'fallback mode');

assert(slackOpenHref({ openUrl: 'https://app.slack.com/client/T1/C1' }) === 'https://app.slack.com/client/T1/C1', 'custom url wins');
assert(
  slackOpenHref({ teamId: 'T123', channelId: 'C456' }) === 'slack://channel?team=T123&id=C456',
  'workspace deep link'
);
assert(
  slackOpenHref({ channelId: 'C456' }) === 'https://slack.com/app_redirect?channel=C456',
  'channel redirect'
);
assert(slackOpenHref({}) === 'slack://open', 'open slack app');

console.log('slackRigCheck tests passed');
