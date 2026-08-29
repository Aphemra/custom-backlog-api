import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const KEY_LENGTH_BYTES = 32;
const INITIALIZATION_VECTOR_LENGTH_BYTES = 12;
const AUTHENTICATION_TAG_LENGTH_BYTES = 16;

export interface EncryptedLocalSecret {
  readonly ciphertext: string;
  readonly initializationVector: string;
  readonly authenticationTag: string;
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

function readKey(keyPath: string): Buffer {
  const key = readFileSync(keyPath);

  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      "The local credential encryption key is invalid. Re-enter the PlayStation credentials after repairing the runtime key.",
    );
  }

  return key;
}

export class LocalSecretCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `Local encryption keys must contain ${KEY_LENGTH_BYTES} bytes.`,
      );
    }
  }

  encrypt(secret: string): EncryptedLocalSecret {
    const initializationVector = randomBytes(
      INITIALIZATION_VECTOR_LENGTH_BYTES,
    );

    const cipher = createCipheriv(
      "aes-256-gcm",
      this.key,
      initializationVector,
    );

    const ciphertext = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);

    const authenticationTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString("base64"),
      initializationVector: initializationVector.toString("base64"),
      authenticationTag: authenticationTag.toString("base64"),
    };
  }

  decrypt(encryptedSecret: EncryptedLocalSecret): string {
    try {
      const initializationVector = Buffer.from(
        encryptedSecret.initializationVector,
        "base64",
      );

      const authenticationTag = Buffer.from(
        encryptedSecret.authenticationTag,
        "base64",
      );

      if (
        initializationVector.length !== INITIALIZATION_VECTOR_LENGTH_BYTES ||
        authenticationTag.length !== AUTHENTICATION_TAG_LENGTH_BYTES
      ) {
        throw new Error("Invalid encrypted-secret envelope.");
      }

      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        initializationVector,
      );

      decipher.setAuthTag(authenticationTag);

      return Buffer.concat([
        decipher.update(Buffer.from(encryptedSecret.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error(
        "The stored local credential could not be decrypted. Re-enter the PlayStation credentials in Settings.",
      );
    }
  }
}

export function loadOrCreateLocalSecretCipher(
  keyPath: string,
): LocalSecretCipher {
  mkdirSync(dirname(keyPath), {
    recursive: true,
  });

  try {
    writeFileSync(keyPath, randomBytes(KEY_LENGTH_BYTES), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }

  return new LocalSecretCipher(readKey(keyPath));
}
