"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { findPrivateAmountRanges, isPrivateAmount } from "@/lib/ui/privacy-sensitive";

const STORAGE_KEY = "fintwin-privacy-hidden";
const CHANGE_EVENT = "fintwin-privacy";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(CHANGE_EVENT, onStoreChange);
}

function hiddenSnapshot() {
  return document.documentElement.classList.contains("privacy-hidden");
}

function notifyPrivacyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function readHidden() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function applyHidden(hidden: boolean) {
  document.documentElement.classList.toggle("privacy-hidden", hidden);
}

function isChrome(element: Element) {
  if (element.closest("[data-privacy-ignore], [data-privacy-sensitive], script, style")) return true;
  if (element.closest("header.app-header")) return true;
  const shell = element.closest(".app-shell");
  const sidebar = shell?.querySelector(":scope > aside");
  if (sidebar?.contains(element)) return true;
  const menu = element.closest("nav");
  return menu?.getAttribute("aria-label") === "Principal";
}

function isChartAmount(text: string) {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 16) return false;
  return /^[+\-−]?\d[\d\s.,]*$/.test(trimmed);
}

function isPrivateInput(input: HTMLInputElement) {
  if (isPrivateAmount(input.value)) return true;
  const hint = `${input.name} ${input.id} ${input.getAttribute("aria-label") ?? ""} ${input.inputMode}`.toLowerCase();
  if (!/amount|montante|valor|preco|preço|saldo|decimal/.test(hint)) return false;
  return /^[+-]?\d[\d\s.,]*$/.test(input.value.trim());
}

function maskPrivateAmounts(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    texts.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of texts) {
    const parent = node.parentElement;
    const text = node.textContent ?? "";
    if (!parent || !text.includes("€")) continue;
    if (isChrome(parent)) continue;

    if (parent.childNodes.length === 1 && parent.children.length === 0 && isPrivateAmount(text)) {
      parent.dataset.privacySensitive = "";
      continue;
    }

    const ranges = findPrivateAmountRanges(text);
    if (ranges.length === 0) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) fragment.append(text.slice(cursor, range.start));
      const wrap = document.createElement("span");
      wrap.dataset.privacySensitive = "";
      wrap.dataset.privacyWrap = "";
      wrap.textContent = text.slice(range.start, range.end);
      fragment.append(wrap);
      cursor = range.end;
    }
    if (cursor < text.length) fragment.append(text.slice(cursor));
    parent.replaceChild(fragment, node);
  }

  for (const input of root.querySelectorAll<HTMLInputElement>("input")) {
    if (isChrome(input)) continue;
    if (isPrivateInput(input)) input.dataset.privacySensitive = "";
  }

  for (const node of root.querySelectorAll<SVGElement>("svg text, svg tspan")) {
    if (node.dataset.privacyOriginal != null) continue;
    const text = node.textContent ?? "";
    if (!isChartAmount(text) && !isPrivateAmount(text)) continue;
    node.dataset.privacyOriginal = text;
    node.textContent = "••••";
  }
}

function clearPrivateAmounts(root: ParentNode) {
  for (const node of root.querySelectorAll<SVGElement>("[data-privacy-original]")) {
    node.textContent = node.dataset.privacyOriginal ?? "";
    delete node.dataset.privacyOriginal;
  }
  for (const wrap of root.querySelectorAll<HTMLElement>("[data-privacy-wrap]")) {
    const text = wrap.firstChild;
    if (text && wrap.parentNode) wrap.parentNode.replaceChild(text, wrap);
  }
  for (const element of root.querySelectorAll<HTMLElement>("[data-privacy-sensitive]")) {
    delete element.dataset.privacySensitive;
  }
}

export function PrivacyLock() {
  const hidden = useSyncExternalStore(subscribe, hiddenSnapshot, () => false);

  useLayoutEffect(() => {
    applyHidden(readHidden());
    notifyPrivacyChange();

    const sync = () => {
      if (document.documentElement.classList.contains("privacy-hidden")) maskPrivateAmounts(document.body);
      else clearPrivateAmounts(document.body);
    };

    sync();
    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  function toggle() {
    const privacyWindow = window as Window & { fintwinTogglePrivacy?: () => void };
    if (typeof privacyWindow.fintwinTogglePrivacy === "function") {
      privacyWindow.fintwinTogglePrivacy();
      return;
    }
    const next = !document.documentElement.classList.contains("privacy-hidden");
    try {
      sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* sessão privada sem storage: o cadeado vale até recarregar */
    }
    applyHidden(next);
    if (next) maskPrivateAmounts(document.body);
    else clearPrivateAmounts(document.body);
    notifyPrivacyChange();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      data-privacy-toggle=""
      data-privacy-ignore=""
      aria-label={hidden ? "Mostrar montantes" : "Ocultar montantes"}
      title={hidden ? "Mostrar montantes" : "Ocultar montantes"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
    >
      <LockIcon closed={hidden} />
      <span data-privacy-label="" className="hidden sm:inline">{hidden ? "Oculto" : "Modo seguro"}</span>
    </button>
  );
}

function LockIcon({ closed }: { closed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path
        d={closed ? "M5 7V5a3 3 0 0 1 6 0v2" : "M5 7V5a3 3 0 0 1 6 0"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
