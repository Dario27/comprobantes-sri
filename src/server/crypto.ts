import crypto from 'node:crypto';
import { SriError } from './errors';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

export interface EncryptedSecret {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

let cachedKey: Buffer | null = null;

function loadMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.MASTER_KEY;
  if (!raw) {
    throw new SriError(
      'STORAGE_PERMISSION',
      'MASTER_KEY no definida en el entorno. Genera una con: npm run master:gen'
    );
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, 'base64');
  } catch {
    throw new SriError('STORAGE_PERMISSION', 'MASTER_KEY no es base64 válido');
  }
  if (buf.length !== KEY_LEN) {
    throw new SriError('STORAGE_PERMISSION', `MASTER_KEY debe decodificar a ${KEY_LEN} bytes (actual: ${buf.length})`);
  }
  cachedKey = buf;
  return buf;
}

export function assertMasterKey(): void {
  loadMasterKey();
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = loadMasterKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

export function decryptSecret(enc: EncryptedSecret): string {
  const key = loadMasterKey();
  if (enc.iv.length !== IV_LEN) throw new SriError('STORAGE_PERMISSION', 'IV inválido');
  if (enc.tag.length !== TAG_LEN) throw new SriError('STORAGE_PERMISSION', 'Auth tag inválido');
  const decipher = crypto.createDecipheriv(ALGO, key, enc.iv);
  decipher.setAuthTag(enc.tag);
  try {
    return Buffer.concat([decipher.update(enc.ciphertext), decipher.final()]).toString('utf8');
  } catch (err) {
    throw new SriError('STORAGE_PERMISSION', 'No se pudo descifrar la credencial (¿MASTER_KEY cambió?)', err);
  }
}
