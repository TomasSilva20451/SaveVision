import type { TotpOtpVisualStatus } from "@/components/auth/totp-otp-input";
import { isMfaTotpInvalidMessage } from "@/lib/auth/totp-messages";

export function deriveTotpVisualStatus(
  pending: boolean,
  mfaError: string | null,
  digitCount: number,
): TotpOtpVisualStatus {
  if (pending) return "verifying";
  if (isMfaTotpInvalidMessage(mfaError)) return "error";
  if (!mfaError && digitCount === 6) return "success";
  return mfaError ? "error" : "idle";
}
