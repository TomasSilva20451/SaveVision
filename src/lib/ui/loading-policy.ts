/** Política de feedback de carregamento (UI). */

/** Só mostrar skeleton quando a espera ultrapassa este limiar (evita flash). */
export const SKELETON_DELAY_MS = 300;

/** Spinner inline: esperas curtas e duração desconhecida, tipicamente até ~3s. */
export const SPINNER_TYPICAL_MAX_MS = 3_000;

/**
 * - `RouteSegmentLoading`: navegação / refresh de rota (`loading.tsx`). Contorno pulsante + skeleton da forma da página (após atraso).
 * - Skeleton (com atraso): blocos com forma conhecida (KPIs, tabelas, gráficos, artigos) dentro da página.
 * - `InlineSpinner`: acções pontuais (submit, stream, painel); nunca ecrã completo.
 */
