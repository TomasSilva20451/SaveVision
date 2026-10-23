export function opsLog(level, msg, fields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    service: process.env.APP_NAME ?? "FinTwin",
    env: process.env.FINTWIN_ENV ?? "development",
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}
