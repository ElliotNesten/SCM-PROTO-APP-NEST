const postmarkApiUrl = "https://api.postmarkapp.com/email";

type SendPostmarkEmailInput = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  replyTo?: string;
};

function getPostmarkServerToken() {
  return process.env.POSTMARK_SERVER_TOKEN?.trim() ?? "";
}

function getPostmarkFromEmail() {
  return process.env.POSTMARK_FROM_EMAIL?.trim() ?? "";
}

function getPostmarkFromName() {
  return process.env.POSTMARK_FROM_NAME?.trim() || "SCM";
}

function getPostmarkReplyToEmail() {
  return process.env.POSTMARK_REPLY_TO_EMAIL?.trim() || "";
}

function getPostmarkMessageStream() {
  return process.env.POSTMARK_MESSAGE_STREAM?.trim() || "outbound";
}

function getPostmarkMaxRetries() {
  const configuredRetries = Number(process.env.SCM_POSTMARK_MAX_RETRIES ?? "3");
  return Number.isFinite(configuredRetries)
    ? Math.min(5, Math.max(1, Math.round(configuredRetries)))
    : 3;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getPostmarkConfigurationStatus() {
  return {
    configured: Boolean(getPostmarkServerToken() && getPostmarkFromEmail()),
    hasServerToken: Boolean(getPostmarkServerToken()),
    hasFromEmail: Boolean(getPostmarkFromEmail()),
    replyToEmail: getPostmarkReplyToEmail(),
    messageStream: getPostmarkMessageStream(),
  };
}

export async function sendPostmarkEmail(input: SendPostmarkEmailInput) {
  const configuration = getPostmarkConfigurationStatus();

  if (!configuration.configured) {
    return {
      ok: false,
      error:
        "Postmark is not configured. Add POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL before sending email.",
      attemptCount: 0,
    };
  }

  const from = `${getPostmarkFromName()} <${getPostmarkFromEmail()}>`;
  const replyTo = input.replyTo || getPostmarkReplyToEmail() || undefined;
  const maxRetries = getPostmarkMaxRetries();
  let lastError = "Unknown Postmark error.";

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(postmarkApiUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": getPostmarkServerToken(),
        },
        body: JSON.stringify({
          From: from,
          To: input.to,
          Subject: input.subject,
          HtmlBody: input.htmlBody,
          TextBody: input.textBody,
          MessageStream: getPostmarkMessageStream(),
          ReplyTo: replyTo,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ErrorCode?: number;
            Message?: string;
            MessageID?: string;
            SubmittedAt?: string;
            To?: string;
          }
        | null;

      if (response.ok) {
        return {
          ok: true,
          messageId: payload?.MessageID ?? null,
          submittedAt: payload?.SubmittedAt ?? null,
          attemptCount: attempt,
        };
      }

      lastError = payload?.Message?.trim() || `Postmark returned HTTP ${response.status}.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Network error while sending email.";
    }

    if (attempt < maxRetries) {
      await wait(attempt * 400);
    }
  }

  return {
    ok: false,
    error: lastError,
    attemptCount: maxRetries,
  };
}
