import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";

function rpID(host: string): string {
  return host.split(":")[0] || "localhost";
}

function bytesToB64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function utf8Bytes(value: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return copy;
}

function b64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const source = Buffer.from(value, "base64url");
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

export async function beginPasskeyRegistration(input: { userId: string; email: string; name: string; host: string }) {
  const existing = await db.passkeyCredential.findMany({ where: { userId: input.userId } });
  const options = await generateRegistrationOptions({
    rpName: "FinTwin",
    rpID: rpID(input.host),
    userName: input.email,
    userDisplayName: input.name,
    userID: utf8Bytes(input.userId),
    attestationType: "none",
    excludeCredentials: existing.map((row) => ({ id: row.credentialId })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  await db.webAuthnChallenge.create({
    data: {
      userId: input.userId,
      purpose: "REGISTER",
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  return options;
}

export async function finishPasskeyRegistration(input: {
  userId: string;
  host: string;
  origin: string;
  response: RegistrationResponseJSON;
  deviceLabel: string;
}) {
  const challenge = await db.webAuthnChallenge.findFirst({
    where: { userId: input.userId, purpose: "REGISTER", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return false;
  const verified = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: input.origin,
    expectedRPID: rpID(input.host),
  });
  if (!verified.verified) return false;
  await db.passkeyCredential.create({
    data: {
      userId: input.userId,
      credentialId: verified.registrationInfo.credential.id,
      publicKey: bytesToB64(verified.registrationInfo.credential.publicKey),
      counter: verified.registrationInfo.credential.counter,
      transports: verified.registrationInfo.credential.transports?.join(",") ?? null,
      deviceLabel: input.deviceLabel.slice(0, 80) || "Passkey",
    },
  });
  await db.webAuthnChallenge.delete({ where: { id: challenge.id } });
  return true;
}

export async function beginPasskeyAuthentication(input: { userId: string; host: string }) {
  const passkeys = await db.passkeyCredential.findMany({ where: { userId: input.userId } });
  const options = await generateAuthenticationOptions({
    rpID: rpID(input.host),
    allowCredentials: passkeys.map((row) => ({ id: row.credentialId })),
    userVerification: "preferred",
  });
  await db.webAuthnChallenge.create({
    data: {
      userId: input.userId,
      purpose: "AUTHENTICATE",
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  return options;
}

export async function verifyPasskeyAuthentication(input: {
  userId: string;
  host: string;
  origin: string;
  response: AuthenticationResponseJSON;
}): Promise<boolean> {
  const challenge = await db.webAuthnChallenge.findFirst({
    where: { userId: input.userId, purpose: "AUTHENTICATE", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  const credential = await db.passkeyCredential.findFirst({
    where: { userId: input.userId, credentialId: input.response.id },
  });
  if (!challenge || !credential) return false;
  const verified = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: input.origin,
    expectedRPID: rpID(input.host),
    credential: {
      id: credential.credentialId,
      publicKey: b64ToBytes(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports?.split(",").filter(Boolean),
    },
  });
  if (!verified.verified) return false;
  await db.passkeyCredential.update({
    where: { id: credential.id },
    data: { counter: verified.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  await db.webAuthnChallenge.delete({ where: { id: challenge.id } });
  return true;
}
