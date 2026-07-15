export async function generateTOTP(
  secret: Uint8Array,
  counter: number,
  digits: number
): Promise<string> {
  const counterBuf = new ArrayBuffer(8)
  const view = new DataView(counterBuf)
  view.setBigUint64(0, BigInt(counter), false)

  const key = await crypto.subtle.importKey('raw', secret.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const hmac = await crypto.subtle.sign('HMAC', key, counterBuf)
  const hash = new Uint8Array(hmac)

  const offset = hash[hash.length - 1] & 0xf
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)

  const otp = binary % Math.pow(10, digits)
  return otp.toString().padStart(digits, '0')
}
