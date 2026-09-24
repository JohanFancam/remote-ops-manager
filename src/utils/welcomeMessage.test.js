import { buildWelcomeMessage, welcomeFirstName } from './welcomeMessage.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const msg = buildWelcomeMessage({
  full_name: 'Johan Brits',
  email: 'johan@fancam.com',
  password: 'TempPass9!',
}, 'https://remoteopsmanger.com');

assert(welcomeFirstName({ full_name: 'Johan Brits' }) === 'Johan', 'first name');
assert(msg.includes('Hi Johan,'), msg);
assert(msg.includes('Username: johan@fancam.com'), msg);
assert(msg.includes('Temporary password: TempPass9!'), msg);
assert(msg.includes('Sign-in: https://remoteopsmanger.com'), msg);
assert(msg.includes('choose your own password'), msg);
console.log('welcomeMessage ok');
