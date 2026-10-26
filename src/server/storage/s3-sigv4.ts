import { createHash, createHmac } from "node:crypto";

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

export function signS3Request(input: {
  method: "GET" | "PUT" | "DELETE";
  url: URL;
  body?: Uint8Array;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(input.body ?? "");
  const canonicalUri = input.url.pathname
    .split("/")
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
  const headers = {
    host: input.url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name as keyof typeof headers]}\n`).join("");
  const canonicalRequest = [
    input.method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaderNames.join(";"),
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`,
  };
}
