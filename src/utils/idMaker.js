export function makeId(prefix = 'id') {
  const randomPart = Math.random().toString(36).slice(2, 9);
  const timePart = Date.now().toString(36).slice(-4);
  return `${prefix}_${randomPart}${timePart}`;
}

export function makeInviteCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}
