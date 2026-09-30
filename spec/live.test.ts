import { expect, inject, it } from "vitest";

// The garden is live: what one person does reaches everyone else with the page
// open within about a second, with no reload. Each test plays strangers with
// their own cookies, one of them listening on the garden's event stream the
// way the page does, and times how long the news takes to arrive.
const baseUrl = inject("baseUrl");
const url = (path: string): URL => new URL(path, baseUrl);
const SECOND = 1000;

type Flower = { id: number; species: string; x: number; y: number; mine: boolean };
type Event = { event: string; data: Record<string, unknown> };

async function stranger(): Promise<string> {
  const cookie = (await fetch(url("/api/garden"))).headers.get("set-cookie");
  expect(cookie, "a first visit is handed an identity").toBeTruthy();
  return cookie!.split(";")[0];
}

// listens on the event stream as a visitor would, keeping every event it hears
async function listen(cookie: string) {
  const stop = new AbortController();
  const res = await fetch(url("/api/events"), { headers: { cookie, accept: "text/event-stream" }, signal: stop.signal });
  expect(res.status, "the garden has an event stream").toBe(200);
  expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
  const heard: Event[] = [];
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  void (async () => {
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buf += value.replace(/\r\n/g, "\n");
        for (let end = buf.indexOf("\n\n"); end >= 0; end = buf.indexOf("\n\n")) {
          const block = buf.slice(0, end);
          buf = buf.slice(end + 2);
          let event = "message";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (data) heard.push({ event, data: JSON.parse(data) as Record<string, unknown> });
        }
      }
    } catch {
      // stopped listening
    }
  })();

  // resolves with the first event that matches, or fails once the time is up
  const hear = (match: (e: Event) => boolean, within: number): Promise<Event> =>
    new Promise((resolve, reject) => {
      const give = setTimeout(() => {
        clearInterval(look);
        reject(new Error(`nothing matching arrived within ${within} ms; heard: ${heard.map((e) => e.event).join(", ") || "nothing"}`));
      }, within);
      const look = setInterval(() => {
        const e = heard.find(match);
        if (e) {
          clearTimeout(give);
          clearInterval(look);
          resolve(e);
        }
      }, 10);
    });
  return { hear, heard, close: () => stop.abort() };
}

it("shows a flower someone sows to everyone else within a second", async () => {
  const watcher = await listen(await stranger());
  try {
    const planter = await stranger();
    const sown = await fetch(url("/api/flowers"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie: planter },
      body: JSON.stringify({ species: "cosmos", x: 420, y: 710 }),
    });
    expect(sown.status).toBe(201);
    const { flower } = (await sown.json()) as { flower: Flower };

    const news = await watcher.hear((e) => e.event === "sown" && (e.data.flower as Flower)?.id === flower.id, SECOND);
    expect(news.data.flower).toMatchObject({ species: "cosmos", x: 420, y: 710, mine: false });
    expect(JSON.stringify(news.data), "the news never says who planted it").not.toContain(planter.split("=")[1]);
  } finally {
    watcher.close();
  }
});

it("tells the planter's own open pages that the flower is theirs", async () => {
  const me = await stranger();
  const myOtherTab = await listen(me);
  try {
    const { flower } = (await (
      await fetch(url("/api/flowers"), {
        method: "POST",
        headers: { "content-type": "application/json", cookie: me },
        body: JSON.stringify({ species: "tulip", x: 880, y: 700 }),
      })
    ).json()) as { flower: Flower };
    const news = await myOtherTab.hear((e) => e.event === "sown" && (e.data.flower as Flower)?.id === flower.id, SECOND);
    expect(news.data.flower).toMatchObject({ mine: true });
  } finally {
    myOtherTab.close();
  }
});

it("lets everyone know within a second when someone arrives", async () => {
  const watcher = await listen(await stranger());
  try {
    // the watcher's own arrival comes first; what matters is hearing the next person
    const before = await watcher.hear((e) => e.event === "presence", SECOND);
    const arrival = await listen(await stranger());
    try {
      const news = await watcher.hear(
        (e) => e.event === "presence" && (e.data.here as number) > (before.data.here as number),
        SECOND,
      );
      expect(news.data).toHaveProperty("people");
      expect(news.data).toHaveProperty("care");
    } finally {
      arrival.close();
    }
  } finally {
    watcher.close();
  }
});
