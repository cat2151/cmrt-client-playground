import { dawClientErrorMessage, type DawClientError } from "../daw/daw-client.ts";

export interface StartupOverlayState {
  title: string;
  message: string;
  detail: string | null;
}

export const STARTUP_CONNECTING_OVERLAY: StartupOverlayState = {
  title: "cmrt接続確認中...",
  message: "しばらくお待ちください",
  detail: null,
};

export function getStartupErrorOverlay(error: DawClientError): StartupOverlayState {
  if (error.kind === "transport") {
    return {
      title: "cmrt接続待機中",
      message: "cmrtを起動してください",
      detail: null,
    };
  }

  return {
    title: "cmrt応答エラー",
    message: "このアプリとcmrtそれぞれのバージョンを確認してください",
    detail: dawClientErrorMessage(error),
  };
}
