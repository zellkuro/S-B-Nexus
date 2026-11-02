// Swords and Spells Nexus: game rules and data.
//
// One file, used in two places:
//   - the world page (world/WebRoot), for instant feedback on screen, and
//   - the backend (backend/src), which applies the same rules and is the
//     only place progress is saved. When the two disagree, the backend wins.
//
// Plain data and pure functions only: no SDK calls, no network, no clock
// (callers pass `now` in milliseconds).

(function (root, factory) {
    const rules = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = rules;
    else root.SBN_RULES = rules;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {

    // ---------------------------------------------------------------------
    // Levels
    // ---------------------------------------------------------------------

    const LEVEL_CAP = 10;

    // XP needed to go from level N to N+1 (index 0 = level 1 -> 2).
    const XP_TO_NEXT = [100, 200, 350, 550, 800, 1100, 1450, 1850, 2300];

    function xpToNext(level) {
        return level >= LEVEL_CAP ? 0 : XP_TO_NEXT[level - 1];
    }

    function maxHp(level) {
        return 80 + 20 * (level - 1);
    }

    // ---------------------------------------------------------------------
    // Combat
    // ---------------------------------------------------------------------

    const COMBAT = {
        minSwingSpeed: 1.5,     // m/s of the sword hand; slower contact is a touch, not a hit
        fullSwingSpeed: 3,      // m/s for 100% damage
        maxSwingScale: 1.5,     // a very fast swing does at most 150%
        minSwingScale: 0.75,    // a swing just over the minimum does 75%
        swingCooldown: 0.45,    // s between hits from one player
        pcAttackRange: 2.5,     // m, PC press-to-attack reach
        pcAttackCooldown: 0.9,  // s, slower than VR because it needs no effort
        pcSwingSpeed: 2.5,      // m/s a PC attack counts as
        regenDelay: 6,          // s out of combat before health comes back
        regenPerSecond: 0.05,   // share of max HP per second while regenerating
        deathGoldLoss: 0.1      // share of gold lost on death
    };

    function swordBaseDamage(level) {
        return 8 + 2 * (level - 1);
    }

    // Damage for one hit. Returns 0 when the swing was too slow to count.
    function swingDamage(level, swingSpeed) {
        if (!(swingSpeed >= COMBAT.minSwingSpeed)) return 0;
        const scale = Math.min(COMBAT.maxSwingScale,
            Math.max(COMBAT.minSwingScale, swingSpeed / COMBAT.fullSwingSpeed));
        return Math.round(swordBaseDamage(level) * scale);
    }

    function deathGoldLoss(gold) {
        return Math.floor(gold * COMBAT.deathGoldLoss);
    }

    // ---------------------------------------------------------------------
    // World: places, NPCs, enemies
    // ---------------------------------------------------------------------

    const PLACES = {
        "brightwater": { name: "Brightwater (starter town)" },
        "hunter-camp": { name: "Hunter's Camp" },
        "forest-edge": { name: "Whisperwood Edge" },
        "graveyard": { name: "The Old Graveyard" },
        "goblin-camp": { name: "Goblin Camp" }
    };

    const NPCS = {
        "mara": { name: "Elder Mara", place: "brightwater" },
        "bren": { name: "Captain Bren", place: "brightwater" },
        "tavi": { name: "Tavi the Hunter", place: "hunter-camp" },
        "ryn": { name: "Scout Ryn", place: "forest-edge" }
    };

    // attackEvery in seconds; gold is [min, max] per kill.
    const ENEMIES = {
        "slime": { name: "Slime", level: 1, hp: 30, damage: 4, attackEvery: 1.6, xp: 12, gold: [1, 3], speed: 1.2 },
        "wolf": { name: "Forest Wolf", level: 3, hp: 70, damage: 9, attackEvery: 1.4, xp: 30, gold: [2, 5], speed: 3.0 },
        "goblin": { name: "Goblin Scout", level: 5, hp: 120, damage: 14, attackEvery: 1.5, xp: 55, gold: [4, 9], speed: 2.4 },
        "skeleton": { name: "Skeleton", level: 7, hp: 180, damage: 20, attackEvery: 1.7, xp: 80, gold: [6, 12], speed: 1.8 },
        "goblin-chief": { name: "Goblin Chief", level: 9, hp: 600, damage: 35, attackEvery: 2.0, xp: 400, gold: [80, 120], speed: 2.2 }
    };

    // Less XP for enemies far below your level, so players move on to new areas.
    function killXp(playerLevel, enemyId) {
        const enemy = ENEMIES[enemyId];
        const gap = playerLevel - enemy.level;
        const scale = gap <= 2 ? 1 : Math.max(0.1, 1 - 0.3 * (gap - 2));
        return Math.max(1, Math.round(enemy.xp * scale));
    }

    // `roll` is a number in [0, 1) so the caller decides where randomness comes from.
    function killGold(enemyId, roll) {
        const [min, max] = ENEMIES[enemyId].gold;
        return min + Math.floor(roll * (max - min + 1));
    }

    // ---------------------------------------------------------------------
    // Quests
    // ---------------------------------------------------------------------
    // Steps run in order. Step types:
    //   { talk: npcId }               talk to an NPC
    //   { visit: placeId }            reach a place
    //   { kill: enemyId, count: n }   kill n of an enemy while on this step
    // When every step is done, the quest is handed in to `turnIn` (default: the giver).

    const QUESTS = {
        "q01": {
            name: "Welcome to Brightwater", giver: "mara", minLevel: 1, requires: [],
            text: "Captain Bren keeps the town safe. Go and introduce yourself.",
            steps: [{ talk: "bren" }], turnIn: "bren", reward: { xp: 50, gold: 5 }
        },
        "q02": {
            name: "Slime Trouble", giver: "bren", minLevel: 1, requires: ["q01"],
            text: "Slimes are oozing onto the road. Clear out five of them.",
            steps: [{ kill: "slime", count: 5 }], reward: { xp: 100, gold: 10 }
        },
        "q03": {
            name: "The Hunter's Camp", giver: "bren", minLevel: 2, requires: ["q02"],
            text: "Tavi the Hunter has been asking for help. Find her camp.",
            steps: [{ visit: "hunter-camp" }, { talk: "tavi" }], turnIn: "tavi", reward: { xp: 80, gold: 5 }
        },
        "q04": {
            name: "Thin the Pack", giver: "tavi", minLevel: 2, requires: ["q03"],
            text: "The wolves are getting bold. Hunt six of them.",
            steps: [{ kill: "wolf", count: 6 }], reward: { xp: 220, gold: 20 }
        },
        "q05": {
            name: "Scout's Warning", giver: "tavi", minLevel: 3, requires: ["q04"],
            text: "Scout Ryn sent word from the edge of Whisperwood. Go and hear it.",
            steps: [{ visit: "forest-edge" }, { talk: "ryn" }], turnIn: "ryn", reward: { xp: 150, gold: 10 }
        },
        "q06": {
            name: "Goblin Scouts", giver: "ryn", minLevel: 4, requires: ["q05"],
            text: "Goblin scouts are mapping the woods. Stop six of them.",
            steps: [{ kill: "goblin", count: 6 }], reward: { xp: 400, gold: 35 }
        },
        "q07": {
            name: "The Old Graveyard", giver: "ryn", minLevel: 5, requires: ["q06"],
            text: "Lights were seen in the old graveyard. Take a look.",
            steps: [{ visit: "graveyard" }], reward: { xp: 250, gold: 15 }
        },
        "q08": {
            name: "Restless Bones", giver: "ryn", minLevel: 6, requires: ["q07"],
            text: "The dead are walking. Put eight skeletons back to rest.",
            steps: [{ kill: "skeleton", count: 8 }], reward: { xp: 650, gold: 50 }
        },
        "q09": {
            name: "Report to the Elder", giver: "ryn", minLevel: 6, requires: ["q08"],
            text: "Elder Mara needs to hear about the goblins and the graveyard.",
            steps: [{ talk: "mara" }], turnIn: "mara", reward: { xp: 300, gold: 20 }
        },
        "q10": {
            name: "The Goblin Chief", giver: "mara", minLevel: 8, requires: ["q09"],
            text: "The goblins answer to a chief in their camp. End this.",
            steps: [{ visit: "goblin-camp" }, { kill: "goblin-chief", count: 1 }], turnIn: "mara",
            reward: { xp: 1200, gold: 150 }
        }
    };

    const MAX_ACTIVE_QUESTS = 10;

    function turnInNpc(questId) {
        const quest = QUESTS[questId];
        return quest.turnIn || quest.giver;
    }

    function questReady(profile, questId) {
        const progress = profile.quests.active[questId];
        return !!progress && progress.step >= QUESTS[questId].steps.length;
    }

    // Quests this NPC can give the player right now.
    function availableQuests(profile, npcId) {
        return Object.keys(QUESTS).filter((id) => {
            const quest = QUESTS[id];
            return quest.giver === npcId
                && !profile.quests.done.includes(id)
                && !profile.quests.active[id]
                && profile.level >= quest.minLevel
                && quest.requires.every((r) => profile.quests.done.includes(r));
        });
    }

    // A short line for the HUD: "Slime Trouble: 2/5 Slime".
    function questStatus(profile, questId) {
        const quest = QUESTS[questId];
        const progress = profile.quests.active[questId];
        if (!progress) return quest.name;
        if (progress.step >= quest.steps.length) return quest.name + ": return to " + NPCS[turnInNpc(questId)].name;
        const step = quest.steps[progress.step];
        if (step.kill) return quest.name + ": " + progress.count + "/" + step.count + " " + ENEMIES[step.kill].name;
        if (step.talk) return quest.name + ": talk to " + NPCS[step.talk].name;
        return quest.name + ": go to " + PLACES[step.visit].name;
    }

    // ---------------------------------------------------------------------
    // Profiles and events
    // ---------------------------------------------------------------------

    const LIMITS = {
        killWindowMs: 60 * 1000,
        maxKillsPerWindow: 12   // more than this in a minute is refused (a slime takes ~3 hits)
    };

    class RuleError extends Error {
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    }

    function newProfile(uid, name, now) {
        return {
            uid,
            name: name || "",
            level: 1,
            xp: 0,
            gold: 0,
            quests: { active: {}, done: [] },
            stats: { kills: 0, deaths: 0 },
            recentKills: [],
            createdAt: now,
            updatedAt: now
        };
    }

    function addXp(profile, amount) {
        let levels = 0;
        if (profile.level >= LEVEL_CAP) return 0;
        profile.xp += amount;
        while (profile.level < LEVEL_CAP && profile.xp >= xpToNext(profile.level)) {
            profile.xp -= xpToNext(profile.level);
            profile.level += 1;
            levels += 1;
        }
        if (profile.level >= LEVEL_CAP) profile.xp = 0;
        return levels;
    }

    // Moves every active quest whose current step matches `test` forward.
    // Returns the ids of quests that changed.
    function advanceSteps(profile, test) {
        const changed = [];
        for (const [id, progress] of Object.entries(profile.quests.active)) {
            const step = QUESTS[id].steps[progress.step];
            if (!step || !test(step, progress)) continue;
            if (step.kill) {
                progress.count += 1;
                if (progress.count >= step.count) { progress.step += 1; progress.count = 0; }
            } else {
                progress.step += 1;
                progress.count = 0;
            }
            changed.push(id);
        }
        return changed;
    }

    function check(condition, code, message) {
        if (!condition) throw new RuleError(code, message);
    }

    // Applies one event to a copy of the profile.
    // Returns { profile, xp, gold, goldLost, levelsGained, questsChanged }.
    // Throws RuleError for events the rules don't allow.
    //
    // Events:
    //   { type: "kill", enemy }                 (roll: [0,1) for gold, chosen by the caller)
    //   { type: "talk", npc }
    //   { type: "visit", place }
    //   { type: "accept", quest }
    //   { type: "turn-in", quest }
    //   { type: "abandon", quest }
    //   { type: "death" }
    function applyEvent(original, event, now, roll) {
        const profile = JSON.parse(JSON.stringify(original));
        const result = { profile, xp: 0, gold: 0, goldLost: 0, levelsGained: 0, questsChanged: [] };
        check(event && typeof event.type === "string", "bad-event", "Event needs a type");

        switch (event.type) {
            case "kill": {
                const enemy = ENEMIES[event.enemy];
                check(enemy, "unknown-enemy", "No such enemy: " + event.enemy);
                profile.recentKills = profile.recentKills.filter((t) => now - t < LIMITS.killWindowMs);
                check(profile.recentKills.length < LIMITS.maxKillsPerWindow, "too-fast",
                    "Too many kills in the last minute");
                profile.recentKills.push(now);
                profile.stats.kills += 1;
                result.xp = killXp(profile.level, event.enemy);
                result.gold = killGold(event.enemy, typeof roll === "number" ? roll : 0);
                result.questsChanged = advanceSteps(profile, (step) => step.kill === event.enemy);
                break;
            }
            case "talk": {
                check(NPCS[event.npc], "unknown-npc", "No such NPC: " + event.npc);
                result.questsChanged = advanceSteps(profile, (step) => step.talk === event.npc);
                break;
            }
            case "visit": {
                check(PLACES[event.place], "unknown-place", "No such place: " + event.place);
                result.questsChanged = advanceSteps(profile, (step) => step.visit === event.place);
                break;
            }
            case "accept": {
                const quest = QUESTS[event.quest];
                check(quest, "unknown-quest", "No such quest: " + event.quest);
                check(!profile.quests.done.includes(event.quest), "quest-done", "Quest already done");
                check(!profile.quests.active[event.quest], "quest-active", "Quest already accepted");
                check(profile.level >= quest.minLevel, "level-too-low", "Needs level " + quest.minLevel);
                check(quest.requires.every((r) => profile.quests.done.includes(r)), "quest-locked",
                    "Finish the earlier quests first");
                check(Object.keys(profile.quests.active).length < MAX_ACTIVE_QUESTS, "too-many-quests",
                    "Quest log is full");
                profile.quests.active[event.quest] = { step: 0, count: 0 };
                result.questsChanged = [event.quest];
                break;
            }
            case "turn-in": {
                const quest = QUESTS[event.quest];
                check(quest, "unknown-quest", "No such quest: " + event.quest);
                check(questReady(profile, event.quest), "quest-not-ready", "Quest isn't finished");
                delete profile.quests.active[event.quest];
                profile.quests.done.push(event.quest);
                result.xp = quest.reward.xp;
                result.gold = quest.reward.gold;
                result.questsChanged = [event.quest];
                break;
            }
            case "abandon": {
                check(profile.quests.active[event.quest], "quest-not-active", "Quest isn't active");
                delete profile.quests.active[event.quest];
                result.questsChanged = [event.quest];
                break;
            }
            case "death": {
                result.goldLost = deathGoldLoss(profile.gold);
                profile.gold -= result.goldLost;
                profile.stats.deaths += 1;
                break;
            }
            default:
                throw new RuleError("bad-event", "Unknown event type: " + event.type);
        }

        profile.gold += result.gold;
        result.levelsGained = addXp(profile, result.xp);
        profile.updatedAt = now;
        return result;
    }

    return {
        LEVEL_CAP, XP_TO_NEXT, COMBAT, LIMITS, PLACES, NPCS, ENEMIES, QUESTS, MAX_ACTIVE_QUESTS,
        RuleError, xpToNext, maxHp, swordBaseDamage, swingDamage, deathGoldLoss, killXp, killGold,
        turnInNpc, questReady, availableQuests, questStatus, newProfile, applyEvent
    };
}));
