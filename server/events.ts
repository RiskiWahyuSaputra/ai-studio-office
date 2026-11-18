import type { Response } from "express";
import type { Activity, ServerEvent } from "../src/shared/types.ts";

const clients = new Set<Response>();

export function subscribe(res: Response) {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  res.write(": terhubung\n\n");
  clients.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  res.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

export function broadcast(ev: ServerEvent) {
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(line);
}

export const activity = (a: Activity) => broadcast({ type: "aktivitas", activity: a });
