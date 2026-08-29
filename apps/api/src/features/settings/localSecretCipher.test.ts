import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadOrCreateLocalSecretCipher } from "./localSecretCipher.js";

test("creates and reuses a local encryption key", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "trophy-backlog-secret-cipher-"),
  );

  const keyPath = join(directory, "credentials.key");
  const secret = "n".repeat(64);

  try {
    const firstCipher = loadOrCreateLocalSecretCipher(keyPath);

    const encrypted = firstCipher.encrypt(secret);

    assert.notEqual(encrypted.ciphertext, secret);
    assert.equal(JSON.stringify(encrypted).includes(secret), false);

    const secondCipher = loadOrCreateLocalSecretCipher(keyPath);

    assert.equal(secondCipher.decrypt(encrypted), secret);
    assert.equal((await readFile(keyPath)).length, 32);
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});
