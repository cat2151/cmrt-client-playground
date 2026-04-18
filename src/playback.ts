import { dawClientErrorMessage, type DawClientError } from "./daw-client.ts";

export interface PlaybackClient {
  postPlayStart(): Promise<void | DawClientError>;
  postPlayStop(): Promise<void | DawClientError>;
}

type PlaybackAction = "start" | "stop";
type PlaybackSource = "startup" | "manual";

export async function runPlaybackAction(options: {
  action: PlaybackAction;
  source: PlaybackSource;
  client: PlaybackClient;
  appendLog: (message: string) => void;
}): Promise<boolean> {
  const result =
    options.action === "start"
      ? await options.client.postPlayStart()
      : await options.client.postPlayStop();

  if (result !== undefined) {
    options.appendLog(
      `ERROR: ${getFailureMessage(options.action, options.source)}: ${dawClientErrorMessage(result)}`
    );
    return false;
  }

  options.appendLog(getSuccessMessage(options.action, options.source));
  return true;
}

function getSuccessMessage(action: PlaybackAction, source: PlaybackSource): string {
  if (source === "startup") {
    return "起動時に play を開始しました";
  }

  return action === "start" ? "play を開始しました" : "play を停止しました";
}

function getFailureMessage(action: PlaybackAction, source: PlaybackSource): string {
  if (source === "startup") {
    return "起動時の play 開始に失敗しました";
  }

  return action === "start" ? "play 開始に失敗しました" : "play 停止に失敗しました";
}
