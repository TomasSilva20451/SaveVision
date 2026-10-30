import { absoluteAppUrl } from "@/lib/auth/public-base-url";

function appName(): string {
  return process.env.APP_NAME?.trim() || "FinTwin";
}

function layout(body: string): string {
  return `<!DOCTYPE html><html lang="pt"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">${body}<p style="margin-top:24px;font-size:12px;color:#64748b">Este email foi enviado automaticamente por ${appName()}.</p></body></html>`;
}

export function buildVerifyEmailMessage(input: {
  toEmail: string;
  token: string;
  /** true quando confirma um endereço novo (alteração de perfil). */
  isEmailChange: boolean;
}) {
  const link = absoluteAppUrl(`/verificar-email?token=${encodeURIComponent(input.token)}`);
  const name = appName();
  const subject = input.isEmailChange
    ? `${name}: confirma o teu novo email`
    : `${name}: verifica o teu email`;

  const intro = input.isEmailChange
    ? `Recebemos um pedido para associar ${input.toEmail} à tua conta.`
    : `Confirma que este endereço te pertence.`;

  const text = [
    intro,
    "",
    `Abre o link (válido 15 minutos):`,
    link,
    "",
    "Se não foste tu, ignora este email.",
  ].join("\n");

  const html = layout(
    `<p>${intro}</p><p><a href="${link}">Confirmar email</a></p><p style="font-size:12px;word-break:break-all">${link}</p>`,
  );

  return { subject, text, html };
}

export function buildAccountRecoveryMessage(input: { toEmail: string; token: string }) {
  const link = absoluteAppUrl(`/recuperar-conta?token=${encodeURIComponent(input.token)}`);
  const name = appName();
  const subject = `${name}: recuperação de conta`;
  const text = [
    "Pediste repor o acesso à tua conta.",
    "",
    `Abre o link (válido 15 minutos):`,
    link,
    "",
    "Se não foste tu, ignora este email.",
  ].join("\n");
  const html = layout(
    `<p>Pediste repor o acesso à conta <strong>${input.toEmail}</strong>.</p><p><a href="${link}">Recuperar conta</a></p><p style="font-size:12px;word-break:break-all">${link}</p>`,
  );
  return { subject, text, html };
}

export function buildFinancialAlertMessage(input: {
  toEmail: string;
  title: string;
  description: string;
  severity: string;
  actionPath: string | null;
}) {
  const name = appName();
  const alertsUrl = absoluteAppUrl("/alertas");
  const detailUrl = input.actionPath ? absoluteAppUrl(input.actionPath) : alertsUrl;
  const subject = `${name}: ${input.title}`;
  const text = [
    `Prioridade: ${input.severity}`,
    "",
    input.title,
    input.description,
    "",
    `Ver alertas: ${alertsUrl}`,
    input.actionPath ? `Abrir: ${detailUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = layout(
    `<p><strong>Prioridade:</strong> ${input.severity}</p><h2 style="font-size:18px">${input.title}</h2><p>${input.description}</p><p><a href="${detailUrl}">Ver na aplicação</a></p>`,
  );

  return { subject, text, html };
}
