const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  success: boolean;
  "error-codes"?: Array<string>;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

export async function verifyTurnstileToken({
  secretKey,
  token,
}: {
  secretKey: string;
  token: string;
}): Promise<TurnstileResult> {
  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: secretKey,
      response: token,
    }),
  });

  const result: TurnstileResult = await res.json();

  // if (!result.success) {
  //   console.error("[Turnstile] Verification failed:", {
  //     errorCodes: result["error-codes"],
  //     action: result.action,
  //   });
  // }

  return result;
}
