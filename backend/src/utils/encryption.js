const crypto = require('crypto');
const { encryptionKey } = require('../config/environment');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('ENCRYPTION_KEY no configurada o inválida. Debe ser un hex string de 64 caracteres.');
  }
  return Buffer.from(encryptionKey, 'hex');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * @returns {{ encrypted: string, iv: string, authTag: string }}
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * @returns {string} plaintext
 */
function decrypt(encrypted, iv, authTag) {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let plaintext = decipher.update(encrypted, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

module.exports = { encrypt, decrypt };
