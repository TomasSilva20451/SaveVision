import { describe, expect, it } from "vitest";
import { signS3Request } from "@/server/storage/s3-sigv4";

describe("assinatura S3", () => {
  it("produz uma autorização AWS4 estável para o mesmo instante", () => {
    const headers = signS3Request({
      method: "PUT",
      url: new URL("https://s3.eu-west-1.amazonaws.com/fintwin-staging-docs/staging/ws/abc"),
      body: new Uint8Array([1, 2, 3]),
      accessKeyId: "AKID",
      secretAccessKey: "secret",
      region: "eu-west-1",
      now: new Date("2026-10-24T12:00:00.000Z"),
    });
    expect(headers.Authorization).toContain("Credential=AKID/20261024/eu-west-1/s3/aws4_request");
    expect(headers["x-amz-date"]).toBe("20261024T120000Z");
  });
});
