// Runs world/WebRoot/script.js against a fake SDK, with its fetch calls going
// to the real backend code (backend/src) and an in-memory database. Catches
// typos, wrong SDK calls and broken game flow before trying it in the app.
//
//   node --test world/tests/
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { handle } from "../../backend/src/index.js";
import { MemoryStore } from "../../backend/src/store.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const R = require("../../shared/rules.js");
const W = require("../WebRoot/script.js");

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

test("swing speed comes from recent hand movement only", () => {
    const samples = [
        { t: 0, p: { x: 0, y: 1, z: 0 } },
        { t: 900, p: { x: 0, y: 1, z: 0 } },
        { t: 1000, p: { x: 0.3, y: 1, z: 0 } }
    ];
    assert.ok(Math.abs(W.swingSpeed(samples, 1000) - 3) < 1e-9);  // 0.3 m in 0.1 s
    assert.strictEqual(W.swingSpeed(samples, 1500), 0);           // hand stopped reporting
    assert.strictEqual(W.swingSpeed([], 0), 0);
});

test("NPC clicks: hand in first, then quest steps, then new quests", () => {
    let p = R.newProfile("u", "A", 0);
    assert.deepStrictEqual(W.npcAction(p, "mara"), { type: "accept", quest: "q01" });
    assert.strictEqual(W.npcAction(p, "bren"), null);
    p = R.applyEvent(p, { type: "accept", quest: "q01" }, 0).profile;
    assert.deepStrictEqual(W.npcAction(p, "bren"), { type: "talk", npc: "bren" });
    p = R.applyEvent(p, { type: "talk", npc: "bren" }, 0).profile;
    assert.deepStrictEqual(W.npcAction(p, "bren"), { type: "turn-in", quest: "q01" });
});

test("enemy ownership: first hitter owns it until they leave", () => {
    const idle = W.freshEnemyState("slime");
    const room = new Set(["a", "b"]);
    assert.ok(W.mayHit(idle, "a", room));
    const owned = { ...idle, status: "fighting", owner: "a" };
    assert.ok(W.mayHit(owned, "a", room));
    assert.ok(!W.mayHit(owned, "b", room));
    assert.ok(W.mayHit(owned, "b", new Set(["b"])), "owner left");
    assert.ok(!W.mayHit({ ...owned, status: "dead" }, "a", room));
});

test("chasing: moves toward the player, attacks in range, gives up past the leash", () => {
    const home = { x: 0, y: 0, z: 0 };
    const step = W.chaseStep(home, home, { x: 5, y: 0, z: 0 }, 2, 0.5);
    assert.deepStrictEqual(step.position, { x: 1, y: 0, z: 0 });
    assert.ok(W.chaseStep({ x: 4, y: 0, z: 0 }, home, { x: 5, y: 0, z: 0 }, 2, 0.5).attack);
    assert.ok(W.chaseStep(home, home, { x: 30, y: 0, z: 0 }, 2, 0.5).giveUp);
});

test("layout: every NPC, place and enemy exists in the rules", () => {
    for (const npc of W.NPC_LAYOUT) assert.ok(R.NPCS[npc.id], npc.id);
    for (const place of Object.keys(W.PLACE_AREAS)) assert.ok(R.PLACES[place], place);
    for (const spawn of W.ENEMY_SPAWNS) assert.ok(R.ENEMIES[spawn.type], spawn.type);
    assert.ok(W.insideBox({ x: W.SPAWN.x, y: 1, z: W.SPAWN.z }, W.PLACE_AREAS.brightwater));
});

// ---------------------------------------------------------------------------
// Fake SDK
// ---------------------------------------------------------------------------

function fakeWorld({ backendUp = true } = {}) {
    const log = [];
    const handlers = {};
    const objects = {};
    let clock = 1000;

    class Vec {
        constructor(x = 0, y = 0, z = 0, w = 0) { Object.assign(this, { x, y, z, w }); }
        SetFromEuler(e) { this.euler = e; return this; }
    }
    const component = (type) => class {
        constructor(cfg) { Object.assign(this, cfg); this.type = type; }
        async Attach(uid) { log.push(["attach", type, uid]); }
        async TakeOwnership() { log.push(["own", this.owner]); }
    };
    class GameObject {
        constructor(cfg) {
            if (!cfg || !cfg.name) throw new Error("GameObject needs a name");
            this.cfg = cfg;
            this.name = cfg.name;
            this.handlers = {};
            this.active = true;
            objects[cfg.name] = this;
        }
        async AddComponent(c) { c.owner = this.name; if (c.type === "Text") this.textComponent = c; return c; }
        async SetNetworkId(id) { this.networkId = id; }
        async SetPosition(p) { this.position = p; }
        async SetTransform(t) { this.transform = t; }
        SetActive(v) { this.active = v; }
        Destroy() { this.destroyed = true; }
        On(name, fn) { this.handlers[name] = fn; }
    }

    const scene = {
        users: {},
        localUser: null,
        spaceState: { public: {}, protected: {} },
        On: (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); },
        SetSettings: async (s) => log.push(["settings", { ...s }]),
        SetPublicSpaceProps: (props) => {
            const changes = Object.entries(props).map(([property, newValue]) => {
                const oldValue = scene.spaceState.public[property];
                scene.spaceState.public[property] = newValue;
                return { property, newValue, oldValue };
            });
            log.push(["state", props]);
            emit("space-state-changed", { changes }); // your own writes come back to you
        },
        TeleportTo: async () => log.push(["teleport"]),
        SendHapticImpulse: async () => {}
    };
    function emit(name, detail) {
        for (const fn of handlers[name] || []) fn({ detail });
    }

    const BS = new Proxy({
        Scene: { GetInstance: () => scene },
        Vector2: Vec, Vector3: Vec, Vector4: Vec, Quaternion: Vec,
        SceneSettings: class {},
        GameObject,
        LightType: { Directional: 1 },
        AvatarBoneName: { HEAD: 0, RIGHTARM_HAND: 12 },
        HandSide: { LEFT: 0, RIGHT: 1 },
        KeyCode: { F: 102 }
    }, {
        get(target, key) {
            if (key in target) return target[key];
            const known = ["Box", "Sphere", "Cylinder", "Material", "BoxCollider", "SphereCollider",
                "Rigidbody", "SyncedObject", "Light", "Text", "AttachedObject", "ColliderEvents"];
            if (known.includes(key)) return (target[key] = component(key));
            throw new Error("script used BS." + String(key) + ", which the test doesn't know");
        }
    });

    const store = new MemoryStore();
    const requests = [];
    async function fakeFetch(url, options) {
        requests.push([options.method, url]);
        if (!backendUp) throw new TypeError("Failed to fetch");
        const request = new Request(url, {
            method: options.method,
            headers: { ...(options.headers || {}), Origin: "https://test.worldspace.host" },
            body: options.body
        });
        return handle(request, { ALLOWED_ORIGINS: "*" }, store, Date.now(), () => 0);
    }

    const intervals = [];
    const listeners = {};
    const context = {
        BS, SBN_RULES: R, console, Math, JSON, Number, Object, Promise, Set, String, Date, Array, Error,
        encodeURIComponent, AbortController, setTimeout, clearTimeout,
        fetch: fakeFetch,
        performance: { now: () => clock },
        setInterval: (fn) => intervals.push(fn),
        window: { addEventListener: (name, fn) => (listeners[name] = fn) }
    };
    vm.runInNewContext(fs.readFileSync(path.join(here, "../WebRoot/script.js"), "utf8"), context);

    const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

    return {
        log, objects, scene, store, requests, emit, settle,
        hud: () => objects.HUD.textComponent.text,
        advance(ms) { clock += ms; },
        async start() {
            listeners["bs-loaded"]();
            for (const fn of handlers["unity-loaded"]) await fn();
        },
        async join(user) {
            scene.users[user.uid] = user;
            if (user.isLocal) scene.localUser = user;
            emit("user-joined", user);
            await settle();
        },
        async click(name) { objects[name].handlers.click(); await settle(); },
        // Moves the right hand `speed` m/s for 100 ms, then touches the enemy with the sword.
        async swing(enemyId, speed, head = { x: 0, y: 1.6, z: 20 }) {
            clock += 2100; // past the 2 s swing cooldown
            const hand = (x) => ({ head: { position: head, rotation: {} }, rightHand: { position: { x, y: 1.2, z: head.z } } });
            emit("pose-update", hand(0));
            clock += 100;
            emit("pose-update", hand(speed * 0.1));
            objects["Sword sq:1"].handlers["trigger-enter"]({ detail: { name: "Enemy " + enemyId } });
            await settle();
        },
        async tick(times = 1, ms = 100) {
            for (let i = 0; i < times; i++) { clock += ms; intervals[0](); await settle(); }
        },
        enemy: (id) => JSON.parse(scene.spaceState.public["enemy-" + id] || "null")
    };
}

const ZELL = { uid: "sq:1", id: "s1", name: "Zell", isLocal: true };

// ---------------------------------------------------------------------------
// Whole-world flow
// ---------------------------------------------------------------------------

test("world: quest, sword fight, kill credit and saving all work together", async () => {
    const w = fakeWorld();
    await w.start();
    assert.ok(w.log.some(([k, s]) => k === "settings" && s.EnableGuests === false));
    await w.join(ZELL);

    assert.match(w.hud(), /Lv 1/);
    assert.doesNotMatch(w.hud(), /OFFLINE/);
    assert.ok(w.log.some(([k, type]) => k === "attach" && type === "AttachedObject"), "sword and HUD attached");
    assert.strictEqual(w.objects["Sword sq:1"].networkId, "sword-sq:1");

    // Quest chain start, by clicking NPCs.
    await w.click("NPC mara");  // accept q01
    await w.click("NPC bren");  // talk
    await w.click("NPC bren");  // hand in q01
    await w.click("NPC bren");  // accept q02
    let saved = (await w.store.get("sq:1")).profile;
    assert.deepStrictEqual(saved.quests.done, ["q01"]);
    assert.ok(saved.quests.active.q02);

    // A slow touch does nothing.
    await w.swing("slime-1", 0.5);
    assert.strictEqual(w.enemy("slime-1"), null);
    assert.match(w.hud(), /Swing harder/);

    // Real swings: the first claims the slime, the rest kill it.
    await w.swing("slime-1", 3);
    assert.strictEqual(w.enemy("slime-1").owner, "sq:1");
    assert.strictEqual(w.enemy("slime-1").status, "fighting");
    assert.strictEqual(w.enemy("slime-1").hp, 30 - 8);
    for (let i = 0; i < 3; i++) await w.swing("slime-1", 3);
    assert.strictEqual(w.enemy("slime-1").status, "dead");
    assert.strictEqual(w.objects["Enemy slime-1"].active, false);
    saved = (await w.store.get("sq:1")).profile;
    assert.strictEqual(saved.stats.kills, 1);
    assert.strictEqual(saved.quests.active.q02.count, 1);
    assert.match(w.hud(), /Slime Trouble: 1\/5 Slime/);

    // It comes back after the respawn time.
    w.advance(16_000);
    const realNow = Date.now;
    Date.now = () => realNow() + 16_000;
    try { await w.tick(); } finally { Date.now = realNow; }
    assert.strictEqual(w.enemy("slime-1").status, "idle");
    assert.strictEqual(w.objects["Enemy slime-1"].active, true);
});

test("world: someone else's enemy can't be hit until they leave", async () => {
    const w = fakeWorld();
    await w.start();
    await w.join(ZELL);
    await w.join({ uid: "sq:2", id: "s2", name: "Kai", isLocal: false });
    assert.ok(w.objects["Sword sq:2"], "other players get a sword copy");

    w.scene.SetPublicSpaceProps({ "enemy-slime-2": JSON.stringify({ status: "fighting", hp: 20, owner: "sq:2", ownerName: "Kai", respawnAt: 0 }) });
    await w.swing("slime-2", 3);
    assert.strictEqual(w.enemy("slime-2").hp, 20);
    assert.match(w.hud(), /Kai is fighting that one/);

    delete w.scene.users["sq:2"];
    w.emit("user-left", { uid: "sq:2" });
    assert.ok(w.objects["Sword sq:2"].destroyed);
    await w.tick(40); // past the grace period, the slime is reset
    assert.deepStrictEqual(w.enemy("slime-2"), W.freshEnemyState("slime"));
});

test("world: an enemy you own fights back; dying sends you home and costs gold", async () => {
    const w = fakeWorld();
    await w.start();
    await w.join(ZELL);
    const before = (await w.store.get("sq:1")).profile;
    before.gold = 50;
    await w.store.put("sq:1", before, (await w.store.get("sq:1")).version);

    await w.swing("slime-3", 3); // claim it; it now chases us
    const head = { x: -3, y: 1.6, z: 33 };
    w.emit("pose-update", { head: { position: head, rotation: {} } });
    await w.tick(400, 100); // 40 s next to a slime: 80 HP at 4 damage every 1.6 s
    assert.ok(w.log.some(([k]) => k === "teleport"), "sent back to town");
    const saved = (await w.store.get("sq:1")).profile;
    assert.strictEqual(saved.stats.deaths, 1);
    assert.strictEqual(saved.gold, 45);
    assert.strictEqual(w.enemy("slime-3").owner, "", "the slime lets go when you die");
});

test("world: plays offline when the server can't be reached", async () => {
    const w = fakeWorld({ backendUp: false });
    await w.start();
    await w.join(ZELL);
    assert.match(w.hud(), /OFFLINE/);
    await w.click("NPC mara");
    assert.match(w.hud(), /Welcome to Brightwater: talk to Captain Bren/);
});
