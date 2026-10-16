export const appConfig = {
  name: process.env.APP_NAME ?? "FinTwin",
  locale: "pt-PT",
  currency: "EUR",
  timeZone: "Europe/Lisbon",
} as const;
