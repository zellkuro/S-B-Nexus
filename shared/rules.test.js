// node --test shared/
const test = require("node:test");
const assert = require("node:assert");
const R = require("./rules.js");

const NOW = 1_800_000_000_000;

function play(profile, events, start = NOW) {
    let t = start;
    for (const event of events) {
        profile = R.applyEvent(profile, event, t, 0).profile;
        t += 10_000; // 10 s apart: well under the kill rate limit
    }
    return profile;
}

test("level curve: XP carries over and stops at the cap", () => {
    const p = R.newProfile("u1", "A", NOW);
    const r = R.applyEvent(p, { type: "accept", quest: "q01" }, NOW);
    assert.strictEqual(r.profile.level, 1);

    const lvl = JSON.parse(JSON.stringify(p));
    lvl.xp = 90;
    lvl.quests.active.q01 = { step: 1, count: 0 };
    const done = R.applyEvent(lvl, { type: "turn-in", quest: "q01" }, NOW); // +50 xp
    assert.strictEqual(done.profile.level, 2);
    assert.strictEqual(done.profile.xp, 40);
    assert.strictEqual(done.levelsGained, 1);

    const capped = R.newProfile("u2", "", NOW);
    capped.level = 9;
    capped.xp = 2290;
    capped.quests.active.q10 = { step: 2, count: 0 };
    const top = R.applyEvent(capped, { type: "turn-in", quest: "q10" }, NOW);
    assert.strictEqual(top.profile.level, R.LEVEL_CAP);
    assert.strictEqual(top.profile.xp, 0);
});

test("swing damage needs a real swing and scales with speed", () => {
    assert.strictEqual(R.swingDamage(1, 0.5), 0);
    assert.strictEqual(R.swingDamage(1, 1.5), 6);   // 8 * 0.75
    assert.strictEqual(R.swingDamage(1, 3), 8);
    assert.strictEqual(R.swingDamage(1, 10), 12);   // capped at 150%
    assert.strictEqual(R.swingDamage(5, 3), 16);
    assert.strictEqual(R.swingDamage(1, NaN), 0);
});

test("first quest chain: talk, kill, visit", () => {
    let p = R.newProfile("u1", "A", NOW);
    assert.deepStrictEqual(R.availableQuests(p, "mara"), ["q01"]);
    assert.deepStrictEqual(R.availableQuests(p, "bren"), []); // q02 needs q01

    p = play(p, [{ type: "accept", quest: "q01" }, { type: "talk", npc: "bren" }]);
    assert.ok(R.questReady(p, "q01"));
    assert.match(R.questStatus(p, "q01"), /return to Captain Bren/);
    p = play(p, [{ type: "turn-in", quest: "q01" }, { type: "accept", quest: "q02" }]);
    assert.deepStrictEqual(p.quests.done, ["q01"]);

    p = play(p, [{ type: "kill", enemy: "slime" }, { type: "kill", enemy: "wolf" }]);
    assert.strictEqual(R.questStatus(p, "q02"), "Slime Trouble: 1/5 Slime");
    p = play(p, Array(4).fill({ type: "kill", enemy: "slime" }));
    assert.ok(R.questReady(p, "q02"));
    p = play(p, [{ type: "turn-in", quest: "q02" }]);
    assert.ok(p.level >= 2, "level " + p.level);

    p = play(p, [{ type: "accept", quest: "q03" }, { type: "talk", npc: "tavi" }]);
    assert.strictEqual(p.quests.active.q03.step, 0, "talking before visiting doesn't count");
    p = play(p, [{ type: "visit", place: "hunter-camp" }, { type: "talk", npc: "tavi" }]);
    assert.ok(R.questReady(p, "q03"));
});

test("quests can't be skipped, repeated or handed in early", () => {
    const p = R.newProfile("u1", "A", NOW);
    const code = (profile, event) => {
        try { R.applyEvent(profile, event, NOW); return "ok"; } catch (e) { return e.code; }
    };
    assert.strictEqual(code(p, { type: "accept", quest: "q02" }), "quest-locked");
    assert.strictEqual(code(p, { type: "accept", quest: "nope" }), "unknown-quest");
    assert.strictEqual(code(p, { type: "turn-in", quest: "q01" }), "quest-not-ready");
    const accepted = play(p, [{ type: "accept", quest: "q01" }]);
    assert.strictEqual(code(accepted, { type: "accept", quest: "q01" }), "quest-active");
    assert.strictEqual(code(accepted, { type: "turn-in", quest: "q01" }), "quest-not-ready");
    const done = play(accepted, [{ type: "talk", npc: "bren" }, { type: "turn-in", quest: "q01" }]);
    assert.strictEqual(code(done, { type: "accept", quest: "q01" }), "quest-done");
    const high = R.newProfile("u2", "", NOW);
    high.quests.done = ["q01", "q02", "q03", "q04", "q05", "q06", "q07", "q08", "q09"];
    assert.strictEqual(code(high, { type: "accept", quest: "q10" }), "level-too-low");
    assert.strictEqual(code(p, { type: "kill", enemy: "dragon" }), "unknown-enemy");
    assert.strictEqual(code(p, { type: "fly" }), "bad-event");
});

test("kill rate limit refuses farming faster than the game allows", () => {
    let p = R.newProfile("u1", "A", NOW);
    for (let i = 0; i < R.LIMITS.maxKillsPerWindow; i++) {
        p = R.applyEvent(p, { type: "kill", enemy: "slime" }, NOW + i * 1000).profile;
    }
    assert.throws(() => R.applyEvent(p, { type: "kill", enemy: "slime" }, NOW + 20_000), { code: "too-fast" });
    // A minute after the first kill, room opens up again.
    assert.doesNotThrow(() => R.applyEvent(p, { type: "kill", enemy: "slime" }, NOW + 60_001));
});

test("death costs 10% of gold, rounded down", () => {
    const p = R.newProfile("u1", "A", NOW);
    p.gold = 57;
    const r = R.applyEvent(p, { type: "death" }, NOW);
    assert.strictEqual(r.goldLost, 5);
    assert.strictEqual(r.profile.gold, 52);
    assert.strictEqual(r.profile.stats.deaths, 1);
    assert.strictEqual(p.gold, 57, "the original profile isn't changed");
});

test("kill XP drops for enemies far below your level", () => {
    assert.strictEqual(R.killXp(1, "slime"), 12);
    assert.strictEqual(R.killXp(3, "slime"), 12);
    assert.strictEqual(R.killXp(4, "slime"), 8);
    assert.strictEqual(R.killXp(10, "slime"), 1);
    assert.strictEqual(R.killGold("slime", 0), 1);
    assert.strictEqual(R.killGold("slime", 0.999), 3);
});

test("data is consistent: every quest points at things that exist", () => {
    for (const [id, q] of Object.entries(R.QUESTS)) {
        assert.ok(R.NPCS[q.giver], id + " giver");
        assert.ok(R.NPCS[R.turnInNpc(id)], id + " turn-in");
        for (const r of q.requires) assert.ok(R.QUESTS[r], id + " requires " + r);
        for (const s of q.steps) {
            if (s.kill) assert.ok(R.ENEMIES[s.kill] && s.count > 0, id + " kill step");
            else if (s.talk) assert.ok(R.NPCS[s.talk], id + " talk step");
            else assert.ok(R.PLACES[s.visit], id + " visit step");
        }
    }
    assert.strictEqual(R.XP_TO_NEXT.length, R.LEVEL_CAP - 1);
});
