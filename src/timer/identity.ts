const EMAIL_DOMAIN = 'nook.app'
const TOKEN_MAX = 60

export function normalizeUsername(name: string) {
  return name.normalize('NFC').trim().toLowerCase()
}

export function displayUsername(name: string) {
  return name.normalize('NFC').trim()
}

function utf8Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  let hex = ''
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, '0')
  return hex
}

export function validateLogin(name: string, pin: string) {
  const display = displayUsername(name)
  const length = [...display].length
  if (length < 1 || length > 20 || /[\u0000-\u001f]/.test(display)) return '이름은 1~20자'
  if (!/^\d{4}$/.test(pin)) return '핀은 숫자 4자리'
  return null
}

export async function credentialsFor(name: string, pin: string) {
  const displayName = displayUsername(name)
  const normalized = normalizeUsername(displayName)
  const hex = utf8Hex(normalized)
  const token = hex.length <= TOKEN_MAX ? hex : (await sha256Hex(normalized)).slice(0, TOKEN_MAX)
  return {
    displayName,
    email: `u_${token}@${EMAIL_DOMAIN}`,
    password: `nook-${pin}-${token}`,
  }
}
