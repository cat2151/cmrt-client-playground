const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, "0");
}

export function formatLogTimestamp(date: Date = new Date()): string {
  const jstDate = new Date(date.getTime() + JST_OFFSET_MS);
  return `${jstDate.getUTCFullYear()}-${pad(jstDate.getUTCMonth() + 1)}-${pad(
    jstDate.getUTCDate()
  )}T${pad(jstDate.getUTCHours())}:${pad(jstDate.getUTCMinutes())}:${pad(
    jstDate.getUTCSeconds()
  )}.${pad(jstDate.getUTCMilliseconds(), 3)}+09:00`;
}
