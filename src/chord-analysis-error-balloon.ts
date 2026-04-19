import {
  CHORD_ANALYSIS_ERROR_BALLOON_MS,
  CHORD_ANALYSIS_ERROR_BALLOON_VIEWPORT_MARGIN_PX,
} from "./app-constants.ts";

export function createChordAnalysisErrorBalloon(balloonEl: HTMLSpanElement): {
  show(message: string): void;
  hide(): void;
} {
  let timer: number | null = null;

  function keepInsideViewport(): void {
    balloonEl.style.setProperty("--error-balloon-viewport-offset-y", "0px");
    const rect = balloonEl.getBoundingClientRect();
    const offsetY = Math.max(
      0,
      CHORD_ANALYSIS_ERROR_BALLOON_VIEWPORT_MARGIN_PX - rect.top
    );
    balloonEl.style.setProperty("--error-balloon-viewport-offset-y", `${offsetY}px`);
  }

  function hide(): void {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }

    balloonEl.hidden = true;
    balloonEl.textContent = "";
    balloonEl.style.removeProperty("--error-balloon-viewport-offset-y");
  }

  return {
    hide,
    show(message: string): void {
      if (timer !== null) {
        window.clearTimeout(timer);
      }

      balloonEl.textContent = `chord分析エラー: ${message}`;
      balloonEl.hidden = false;
      keepInsideViewport();
      window.requestAnimationFrame(() => {
        if (!balloonEl.hidden) {
          keepInsideViewport();
        }
      });
      timer = window.setTimeout(() => {
        timer = null;
        balloonEl.hidden = true;
        balloonEl.textContent = "";
        balloonEl.style.removeProperty("--error-balloon-viewport-offset-y");
      }, CHORD_ANALYSIS_ERROR_BALLOON_MS);
    },
  };
}
