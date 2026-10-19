// Sin caracteres ambiguos (0/O, 1/l/I) para dictarla por teléfono o WhatsApp.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const DEFAULT_LENGTH = 16;

export function generatePassword(
  length = DEFAULT_LENGTH,
  random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes),
): string {
  // Rechazo de muestras para evitar el sesgo del módulo.
  const limit = 256 - (256 % ALPHABET.length);
  let result = '';
  while (result.length < length) {
    for (const byte of random(new Uint8Array(length * 2))) {
      if (byte < limit) result += ALPHABET[byte % ALPHABET.length];
      if (result.length === length) break;
    }
  }
  return result;
}
