import type { StartupOverlayState } from "./startup-overlay.ts";

interface StartupOverlayElements {
  appShellEl: HTMLDivElement;
  startupOverlayEl: HTMLDivElement;
  startupOverlayTitleEl: HTMLHeadingElement;
  startupOverlayMessageEl: HTMLParagraphElement;
  startupOverlayDetailEl: HTMLPreElement;
}

export function createStartupOverlayController(elements: StartupOverlayElements): {
  show(state: StartupOverlayState): void;
  hide(): void;
} {
  function setState(state: StartupOverlayState): void {
    elements.startupOverlayTitleEl.textContent = state.title;
    elements.startupOverlayMessageEl.textContent = state.message;
    elements.startupOverlayDetailEl.textContent = state.detail ?? "";
    elements.startupOverlayDetailEl.hidden = state.detail === null;
  }

  return {
    show(state: StartupOverlayState): void {
      setState(state);
      elements.startupOverlayEl.hidden = false;
      elements.appShellEl.setAttribute("inert", "");
      elements.appShellEl.setAttribute("aria-busy", "true");
    },
    hide(): void {
      elements.startupOverlayEl.hidden = true;
      elements.appShellEl.removeAttribute("inert");
      elements.appShellEl.removeAttribute("aria-busy");
    },
  };
}
