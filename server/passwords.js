import { randomInt } from 'crypto';

// Omits characters that get misread when a password is typed from a list: 0/O, 1/l/I
export const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generatePassword(length = 12) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

export function formatPasswordList(issued) {
  if (!issued.length) return '';
  const width = Math.max(...issued.map((i) => i.email.length));
  return issued
    .map((item) => `${item.email.padEnd(width)}  ${item.password}${item.status ? `  (${item.status})` : ''}`)
    .join('\n');
}
