// npm test (in backend/)
import test from "node:test";
import assert from "node:assert";
import { handle } from "../src/index.js";
import { MemoryStore } from "../src/store.js";

const ENV = { ALLOWED_ORIGINS: "https://*.worldspace.host" };
const ORIGIN = "https://my-world.worldspace.host";

function call(store, method, path, body, { now = 1_800_000_000_000, origin = ORIGIN } = {}) {
    const request = new Request("https://api.example" + path, {
        method,
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return handle(request, ENV, store, now, () => 0.5);
}

async function send(store, uid, event, opts) {
    const response = await call(store, "POST", "/players/" + encodeURIComponent(uid) + "/events", { event, name: "Zell" }, opts);
    return { status: response.status, body: await response.json() };
}

test("a new player is created on first visit and saved", async () => {
    const store = new MemoryStore();
    const response = await call(store, "GET", "/players/sq%3A123?name=Zell");
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    const { profile } = await response.json();
    assert.strictEqual(profile.uid, "sq:123");
    assert.strictEqual(profile.name, "Zell");
    assert.strictEqual(profile.level, 1);
    assert.strictEqual(profile.recentKills, undefined, "internal fields stay private");
    assert.ok((await store.get("sq:123")).profile);
});

test("events change and save the profile", async () => {
    const store = new MemoryStore();
    let r = await send(store, "p1", { type: "accept", quest: "q01" });
    assert.strictEqual(r.status, 200);
    r = await send(store, "p1", { type: "talk", npc: "bren" });
    assert.deepStrictEqual(r.body.questsChanged, ["q01"]);
    r = await send(store, "p1", { type: "turn-in", quest: "q01" });
    assert.strictEqual(r.body.xp, 50);
    assert.strictEqual(r.body.profile.gold, 5);

    r = await send(store, "p1", { type: "kill", enemy: "slime" });
    assert.strictEqual(r.body.gold, 2); // roll 0.5 on [1, 3]
    const saved = (await store.get("p1")).profile;
    assert.strictEqual(saved.gold, 7);
    assert.strictEqual(saved.stats.kills, 1);

    r = await send(store, "p1", { type: "death" });
    assert.strictEqual(r.body.goldLost, 0);
    assert.strictEqual(r.body.profile.stats.deaths, 1);
});

test("events the rules refuse answer 409 with the current profile", async () => {
    const store = new MemoryStore();
    const r = await send(store, "p1", { type: "turn-in", quest: "q01" });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.error.code, "quest-not-ready");
    assert.strictEqual(r.body.profile.level, 1);
});

test("two saves at the same moment don't lose either one", async () => {
    const store = new MemoryStore();
    await call(store, "GET", "/players/p1");
    // Both requests read version 1; the second put fails and retries on fresh data.
    const results = await Promise.all([
        send(store, "p1", { type: "kill", enemy: "slime" }),
        send(store, "p1", { type: "kill", enemy: "slime" })
    ]);
    assert.deepStrictEqual(results.map((r) => r.status), [200, 200]);
    assert.strictEqual((await store.get("p1")).profile.stats.kills, 2);
});

test("bad requests are refused", async () => {
    const store = new MemoryStore();
    assert.strictEqual((await call(store, "GET", "/players/bad%20id")).status, 400);
    assert.strictEqual((await call(store, "GET", "/nope")).status, 404);
    assert.strictEqual((await call(store, "POST", "/players/p1/events", { nope: 1 })).status, 400);
    const big = await call(store, "POST", "/players/p1/events", { event: { type: "death" }, pad: "x".repeat(5000) });
    assert.strictEqual(big.status, 413);
    const health = await call(store, "GET", "/health");
    assert.deepStrictEqual(await health.json(), { ok: true });
});

test("CORS: only allowed origins get the header; preflight works", async () => {
    const store = new MemoryStore();
    const other = await call(store, "GET", "/health", undefined, { origin: "https://evil.example" });
    assert.strictEqual(other.headers.get("Access-Control-Allow-Origin"), null);
    const lookalike = await call(store, "GET", "/health", undefined, { origin: "https://worldspace.host.evil.example" });
    assert.strictEqual(lookalike.headers.get("Access-Control-Allow-Origin"), null);
    const preflight = await call(store, "OPTIONS", "/players/p1/events");
    assert.strictEqual(preflight.status, 204);
    assert.strictEqual(preflight.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});
