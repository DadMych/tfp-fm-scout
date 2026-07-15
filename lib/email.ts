export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() ?? "The Scouting Post <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    console.info(`[dev] Password reset link for ${input.to}: ${input.resetUrl}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Reset your Scouting Post password",
      text: [
        "You asked to reset your password for The Scouting Post.",
        "",
        input.resetUrl,
        "",
        "This link expires in one hour. If you did not request this, ignore this email.",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    throw new Error("Could not send password reset email.");
  }
}
