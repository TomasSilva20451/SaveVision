import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailDeliveryProvider, OutboundEmail } from "@/server/providers/contracts";

function smtpFromAddress(): string {
  const from = process.env.SMTP_FROM?.trim();
  if (from) return from;
  const app = process.env.APP_NAME?.trim() || "FinTwin";
  return `${app} <noreply@localhost>`;
}

function createTransport() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const secure =
    process.env.SMTP_SECURE === "1" ||
    process.env.SMTP_SECURE === "true" ||
    port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: pass ?? "" } : undefined,
  });
}

export function createSmtpEmailProvider(): EmailDeliveryProvider {
  let transport: Transporter | null | undefined;

  function getTransport() {
    if (transport === undefined) {
      transport = createTransport();
    }
    return transport;
  }

  return {
    name: "smtp",
    isConfigured() {
      return Boolean(process.env.SMTP_HOST?.trim());
    },
    async send(message: OutboundEmail) {
      const tx = getTransport();
      if (!tx) {
        throw new Error("SMTP não configurado.");
      }
      await tx.sendMail({
        from: smtpFromAddress(),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}

export const smtpEmailProvider = createSmtpEmailProvider();
