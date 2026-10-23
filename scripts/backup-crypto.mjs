#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("FTBACK01", "ascii");

async function encrypt(input, output, secret, keyId) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const keyName = Buffer.from(keyId, "utf8");
  if (keyName.length < 1 || keyName.length > 255) throw new Error("BACKUP_KEY_ID_INVALID");
  const key = crypto.scryptSync(secret, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const header = Buffer.concat([MAGIC, salt, iv, Buffer.from([keyName.length]), keyName]);
  cipher.setAAD(header);
  fs.writeFileSync(output, header, { mode: 0o600 });
  await pipeline(fs.createReadStream(input), cipher, fs.createWriteStream(output, { flags: "a", mode: 0o600 }));
  fs.appendFileSync(output, cipher.getAuthTag());
}

async function decrypt(input, output, secret, expectedKeyId) {
  const handle = fs.openSync(input, "r");
  const prefix = Buffer.alloc(37);
  fs.readSync(handle, prefix, 0, prefix.length, 0);
  if (!prefix.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("BACKUP_FORMAT_INVALID");
  const salt = prefix.subarray(8, 24);
  const iv = prefix.subarray(24, 36);
  const keyIdLength = prefix[36];
  const header = Buffer.alloc(37 + keyIdLength);
  fs.readSync(handle, header, 0, header.length, 0);
  fs.closeSync(handle);
  const keyId = header.subarray(37).toString("utf8");
  if (expectedKeyId && keyId !== expectedKeyId) throw new Error(`BACKUP_KEY_ID_MISMATCH:${keyId}`);
  const size = fs.statSync(input).size;
  if (size <= header.length + 16) throw new Error("BACKUP_FORMAT_TRUNCATED");
  const tag = Buffer.alloc(16);
  const tagHandle = fs.openSync(input, "r");
  fs.readSync(tagHandle, tag, 0, tag.length, size - 16);
  fs.closeSync(tagHandle);
  const key = crypto.scryptSync(secret, salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  await pipeline(
    fs.createReadStream(input, { start: header.length, end: size - 17 }),
    decipher,
    fs.createWriteStream(output, { mode: 0o600 }),
  );
}

const [operation, input, output] = process.argv.slice(2);
const secret = process.env.FINTWIN_BACKUP_ENCRYPTION_SECRET;
const keyId = process.env.FINTWIN_BACKUP_ENCRYPTION_KEY_ID;
if (!operation || !input || !output || !secret || secret.length < 32 || !keyId) {
  console.error("Uso: backup-crypto.mjs <encrypt|decrypt> <entrada> <saída>; configura secret e key id.");
  process.exit(2);
}

try {
  if (operation === "encrypt") await encrypt(input, output, secret, keyId);
  else if (operation === "decrypt") await decrypt(input, output, secret, keyId);
  else throw new Error("BACKUP_OPERATION_INVALID");
} catch (error) {
  if (fs.existsSync(output)) fs.unlinkSync(output);
  console.error(error);
  process.exit(1);
}

