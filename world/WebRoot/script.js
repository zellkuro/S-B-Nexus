// Swords and Spells Nexus: first test world ("vertical slice" spike).
//
// Tests, in the app:
//   S1  the page can save and load progress on our own server (backend/)
//   S2  a sword on your hand hits enemies, and only real swings count
//   S3  "whoever hits first owns it" enemies: shared, synced, no kill-stealing
//   S5  PC press-to-attack
// with a small town, two quest givers, a field of slimes and a HUD.
//
// Everything is built from this script, so the Unity scene only needs the SDK.
// Game rules come from rules.js (a copy of shared/rules.js), loaded first.

// ---------------------------------------------------------------------------
// Settings to change
// ---------------------------------------------------------------------------

const CONFIG = {
    // Your deployed backend (see backend/README.md). No trailing slash.
    backendUrl: "https://sbn-backend.YOUR-ACCOUNT.workers.dev",
    requestTimeoutMs: 8000
};

// ---------------------------------------------------------------------------
// Layout and tuning (plain data, no SDK calls)
// ---------------------------------------------------------------------------

const R = typeof SBN_RULES !== "undefined" ? SBN_RULES : require("../../shared/rules.js");

const LAYER = {
    GROUND: 0,
    UI: 5,       // clickable: NPCs
    ENEMY: 13,   // UserLayer9: the body bumps into it; teleport and grapple ignore it
    SWORD: 14    // UserLayer10: same, for the blade
};

const SPAWN = { x: 0, y: 0.1, z: -8, yaw: 0 };

// Axis-aligned boxes: min/max corners. Entering one can complete a "visit" quest step.
const PLACE_AREAS = {
    "brightwater": { min: { x: -15, y: -2, z: -15 }, max: { x: 15, y: 10, z: 15 } },
    "hunter-camp": { min: { x: -6, y: -2, z: 50 }, max: { x: 6, y: 10, z: 60 } }
};

const NPC_LAYOUT = [
    { id: "mara", position: { x: 4, y: 0, z: -3 }, yaw: 200, color: [0.55, 0.3, 0.7, 1] },
    { id: "bren", position: { x: -4, y: 0, z: -3 }, yaw: 160, color: [0.25, 0.4, 0.75, 1] },
    { id: "tavi", position: { x: 0, y: 0, z: 56 }, yaw: 180, color: [0.35, 0.55, 0.25, 1] }
];

// Network ids are fixed so every player's copy of an enemy is the same enemy.
const ENEMY_SPAWNS = [
    { id: "slime-1", type: "slime", home: { x: -6, y: 0, z: 22 } },
    { id: "slime-2", type: "slime", home: { x: 5, y: 0, z: 26 } },
    { id: "slime-3", type: "slime", home: { x: -3, y: 0, z: 33 } },
    { id: "slime-4", type: "slime", home: { x: 7, y: 0, z: 38 } },
    { id: "slime-5", type: "slime", home: { x: -8, y: 0, z: 42 } }
];

const ENEMY_RULES = {
    size: 0.9,               // slime diameter, metres
    attackRange: 1.4,        // metres from the player's feet (horizontal)
    leash: 18,               // past this far from home, the enemy gives up and goes home
    respawnSeconds: 15,
    ownerGoneGraceMs: 3000,  // owner left the room: anyone resets the enemy after this
    takeOverDelayMs: 10000   // a dead enemy whose owner didn't respawn it: anyone does, this late
};

// The sword sits on the right hand. The hand bone's axes aren't documented, so
// these may need turning in the headset (see world/README.md, "Not verified yet").
const SWORD = {
    length: 0.9,
    width: 0.06,
    attachPosition: { x: 0, y: 0, z: 0.5 },
    attachEuler: { x: 0, y: 0, z: 0 }
};

const TICK_MS = 100;
const SWING_WINDOW_MS = 150;     // hand speed is measured over this much recent movement
const MESSAGE_MS = 4000;

// ---------------------------------------------------------------------------
// Pure helpers (tested in tests/world.test.js)
// ---------------------------------------------------------------------------

const vec = {
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    length: (a) => Math.hypot(a.x, a.y, a.z),
    flatDistance: (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
};

function insideBox(p, box) {
    return p.x >= box.min.x && p.x <= box.max.x && p.y >= box.min.y && p.y <= box.max.y
        && p.z >= box.min.z && p.z <= box.max.z;
}

// Hand speed in m/s from recent samples [{ t, p }], oldest first.
// pose-update stops when the player keeps still, so old samples mean "not moving".
function swingSpeed(samples, now) {
    const recent = samples.filter((s) => now - s.t <= SWING_WINDOW_MS);
    if (recent.length < 2) return 0;
    const first = recent[0], last = recent[recent.length - 1];
    const dt = (last.t - first.t) / 1000;
    return dt > 0 ? vec.length(vec.sub(last.p, first.p)) / dt : 0;
}

// What clicking an NPC does, in order: hand in a finished quest, talk for a
// quest step, offer a new quest. Null when there's nothing to do.
function npcAction(profile, npcId) {
    for (const id of Object.keys(profile.quests.active)) {
        if (R.questReady(profile, id) && R.turnInNpc(id) === npcId) return { type: "turn-in", quest: id };
    }
    for (const [id, progress] of Object.entries(profile.quests.active)) {
        const step = R.QUESTS[id].steps[progress.step];
        if (step && step.talk === npcId) return { type: "talk", npc: npcId };
    }
    const offer = R.availableQuests(profile, npcId)[0];
    return offer ? { type: "accept", quest: offer } : null;
}

// Places that would move an active quest forward if the player is in them.
function wantedVisits(profile) {
    const places = new Set();
    for (const [id, progress] of Object.entries(profile.quests.active)) {
        const step = R.QUESTS[id].steps[progress.step];
        if (step && step.visit) places.add(step.visit);
    }
    return places;
}

// Who may hit this enemy: nobody owns it, I own it, or its owner left.
function mayHit(state, myUid, usersInRoom) {
    if (state.status === "dead") return false;
    return !state.owner || state.owner === myUid || !usersInRoom.has(state.owner);
}

// One AI step for an enemy chasing `target` (the player's feet).
// Returns { position, attack, giveUp }.
function chaseStep(position, home, target, speed, dt) {
    if (vec.flatDistance(target, home) > ENEMY_RULES.leash) return { position, attack: false, giveUp: true };
    const dx = target.x - position.x, dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= ENEMY_RULES.attackRange) return { position, attack: true, giveUp: false };
    const move = Math.min(speed * dt, distance - ENEMY_RULES.attackRange * 0.8);
    return {
        position: { x: position.x + dx / distance * move, y: home.y, z: position.z + dz / distance * move },
        attack: false,
        giveUp: false
    };
}

function freshEnemyState(type) {
    return { status: "idle", hp: R.ENEMIES[type].hp, owner: "", ownerName: "", respawnAt: 0 };
}

function hpBar(hp, max, width = 10) {
    const full = Math.max(0, Math.min(width, Math.round(hp / max * width)));
    return "<color=#40e070>" + "█".repeat(full) + "</color><color=#555555>" + "█".repeat(width - full) + "</color>";
}

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

function startWorld() {
    const scene = BS.Scene.GetInstance();
    const V3 = (p) => new BS.Vector3(p.x, p.y, p.z);
    const color = (c) => new BS.Vector4(c[0], c[1], c[2], c[3]);

    const settings = new BS.SceneSettings();
    settings.EnableSpiderMan = false;
    settings.EnableForceGrab = false;
    settings.EnableGuests = false;   // progress is saved per signed-in account
    settings.SpawnPoint = new BS.Vector4(SPAWN.x, SPAWN.y, SPAWN.z, SPAWN.yaw);
    scene.SetSettings(settings);

    const me = { uid: "", name: "", profile: null, online: false, hp: 0, lastHurt: 0, lastHit: 0 };
    const enemies = {};
    const swords = {};
    const handSamples = [];
    let pose = null;

    // --- Backend ------------------------------------------------------------

    let queue = Promise.resolve();

    function request(method, path, body) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs) : null;
        return fetch(CONFIG.backendUrl + path, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller ? controller.signal : undefined
        }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            return { status: response.status, data };
        }).finally(() => { if (timer) clearTimeout(timer); });
    }

    async function loadProfile() {
        try {
            const { status, data } = await request("GET", "/players/" + encodeURIComponent(me.uid)
                + "?name=" + encodeURIComponent(me.name));
            if (status !== 200 || !data.profile) throw new Error("status " + status);
            setProfile(data.profile, true);
            say("Welcome, " + me.name + ". Progress is saved.");
        } catch (e) {
            console.warn("backend unreachable", e);
            setProfile(R.newProfile(me.uid, me.name, Date.now()), false);
            say("<color=#ff8040>Can't reach the server: playing offline, nothing is saved.</color>");
        }
        me.hp = R.maxHp(me.profile.level);
        updateHud();
    }

    function setProfile(profile, online) {
        const levelBefore = me.profile ? me.profile.level : profile.level;
        me.profile = profile;
        me.online = online;
        if (profile.level > levelBefore) {
            me.hp = R.maxHp(profile.level);
            say("<color=#ffd040><b>Level up!</b> You are level " + profile.level + ".</color>");
        }
        refreshNpcMarkers();
        updateHud();
    }

    // Events are sent one at a time, in order. The server's answer replaces the
    // profile; if the server can't be reached, the same rules run here instead.
    function sendEvent(event) {
        const run = async () => {
            if (me.online) {
                try {
                    const { status, data } = await request("POST", "/players/" + encodeURIComponent(me.uid) + "/events",
                        { event, name: me.name });
                    if (data.profile) setProfile(data.profile, true);
                    if (status === 200) return data;
                    if (status === 409) { say(data.error.message); return null; }
                    throw new Error("status " + status);
                } catch (e) {
                    console.warn("event not saved", event, e);
                    me.online = false;
                    say("<color=#ff8040>Lost the server: playing offline, nothing is saved.</color>");
                }
            }
            try {
                const result = R.applyEvent(me.profile, event, Date.now(), Math.random());
                setProfile(result.profile, false);
                return result;
            } catch (e) {
                say(e.message);
                return null;
            }
        };
        const next = queue.then(run);
        queue = next.catch(() => null);
        return next;
    }

    // --- Building -------------------------------------------------------------

    async function shape(name, { position, euler, layer = LAYER.GROUND, geometry, collider, rgba, parent }) {
        const config = { name, layer, localPosition: V3(position) };
        if (euler) config.localEulerAngles = V3(euler);
        if (parent) config.parent = parent;
        const obj = new BS.GameObject(config);
        await obj.AddComponent(geometry);
        await obj.AddComponent(new BS.Material({ color: color(rgba) }));
        if (collider) await obj.AddComponent(collider);
        return obj;
    }

    async function label(name, position, text, fontSize, size, parent) {
        const config = { name, localPosition: V3(position) };
        if (parent) config.parent = parent;
        const obj = new BS.GameObject(config);
        const component = await obj.AddComponent(new BS.Text({
            text,
            fontSize,
            richText: true,
            rectTransformSizeDelta: new BS.Vector2(size[0], size[1])
        }));
        return { obj, text: component };
    }

    async function buildGround() {
        await shape("Town Square", {
            position: { x: 0, y: -0.25, z: 0 },
            geometry: new BS.Box({ width: 30, height: 0.5, depth: 30 }),
            collider: new BS.BoxCollider({ size: new BS.Vector3(30, 0.5, 30) }),
            rgba: [0.62, 0.55, 0.42, 1]
        });
        await shape("Field", {
            position: { x: 0, y: -0.26, z: 37.5 },
            geometry: new BS.Box({ width: 40, height: 0.5, depth: 45 }),
            collider: new BS.BoxCollider({ size: new BS.Vector3(40, 0.5, 45) }),
            rgba: [0.3, 0.5, 0.25, 1]
        });
        await label("Town Sign", { x: 0, y: 2.4, z: -4 },
            "<b>BRIGHTWATER</b>\n<size=60%>Swords and Spells Nexus: test world\nClick a villager to talk. Slimes are in the field.\nPC: F to attack</size>", 1, [7, 2]);
        const sun = new BS.GameObject({ name: "Sun", localEulerAngles: new BS.Vector3(45, -30, 0) });
        await sun.AddComponent(new BS.Light({ type: BS.LightType.Directional, intensity: 1.1 }));
    }

    // --- NPCs -------------------------------------------------------------------

    const npcs = {};

    async function buildNpc(layout) {
        const info = R.NPCS[layout.id];
        const root = new BS.GameObject({
            name: "NPC " + layout.id,
            layer: LAYER.UI, // clickable
            localPosition: V3(layout.position),
            localEulerAngles: new BS.Vector3(0, layout.yaw, 0)
        });
        await root.AddComponent(new BS.BoxCollider({ center: new BS.Vector3(0, 0.9, 0), size: new BS.Vector3(0.7, 1.8, 0.7) }));
        await shape("Body", {
            parent: root, position: { x: 0, y: 0.7, z: 0 },
            geometry: new BS.Cylinder({ radiusTop: 0.22, radiusBottom: 0.3, height: 1.4, radialSegments: 12 }),
            rgba: layout.color
        });
        await shape("Head", {
            parent: root, position: { x: 0, y: 1.6, z: 0 },
            geometry: new BS.Sphere({ radius: 0.18, widthSegments: 12, heightSegments: 8 }),
            rgba: [0.95, 0.8, 0.65, 1]
        });
        // Labels aren't children, so the NPC's turn doesn't turn them: text reads
        // from its -Z side, which faces the spawn point and the path from town.
        const at = (dy) => ({ x: layout.position.x, y: layout.position.y + dy, z: layout.position.z });
        await label("Name", at(2.2), "<b>" + info.name + "</b>", 0.5, [2, 0.4]);
        const marker = await label("Marker", at(2.55), "", 0.9, [1, 0.5]);
        const speech = await label("Speech", at(2.95), "", 0.4, [3, 0.8]);
        root.On("click", () => talkTo(layout.id));
        npcs[layout.id] = { layout, marker, speech };
    }

    // "!" over NPCs with a quest to give, "?" when one is ready to hand in.
    function refreshNpcMarkers() {
        if (!me.profile) return;
        for (const [id, npc] of Object.entries(npcs)) {
            const action = npcAction(me.profile, id);
            const mark = !action ? "" : action.type === "turn-in" ? "<color=#ffd040>?</color>"
                : action.type === "accept" ? "<color=#ffd040>!</color>" : "<color=#a0c8ff>…</color>";
            if (npc.marker.text.text !== mark) npc.marker.text.text = mark;
        }
    }

    async function talkTo(npcId) {
        if (!me.profile) return;
        const npc = npcs[npcId];
        const action = npcAction(me.profile, npcId);
        if (!action) {
            npc.speech.text.text = "Safe travels.";
            return;
        }
        const result = await sendEvent(action);
        if (!result) return;
        if (action.type === "accept") {
            const quest = R.QUESTS[action.quest];
            npc.speech.text.text = "<b>" + quest.name + "</b>\n" + quest.text;
            say("Quest accepted: " + quest.name);
        } else if (action.type === "turn-in") {
            npc.speech.text.text = "Well done!";
            say("Quest complete: " + R.QUESTS[action.quest].name + "  +" + result.xp + " XP, +" + result.gold + " gold");
        } else {
            npc.speech.text.text = "Ah, " + me.name + ". Good to meet you.";
            for (const id of result.questsChanged || []) say(R.questStatus(me.profile, id));
        }
    }

    // --- Enemies ----------------------------------------------------------------

    async function buildEnemy(spawn) {
        const def = R.ENEMIES[spawn.type];
        const start = { ...spawn.home, y: spawn.home.y + ENEMY_RULES.size / 2 };
        const obj = new BS.GameObject({ name: "Enemy " + spawn.id, layer: LAYER.ENEMY, localPosition: V3(start) });
        await obj.SetNetworkId("enemy-" + spawn.id);
        await obj.AddComponent(new BS.Sphere({ radius: ENEMY_RULES.size / 2, widthSegments: 16, heightSegments: 10 }));
        await obj.AddComponent(new BS.Material({ color: new BS.Vector4(0.35, 0.85, 0.4, 1) }));
        await obj.AddComponent(new BS.SphereCollider({ radius: ENEMY_RULES.size / 2 }));
        await obj.AddComponent(new BS.Rigidbody({ isKinematic: true, useGravity: false }));
        const sync = await obj.AddComponent(new BS.SyncedObject({ takeOwnershipOnCollision: false, takeOwnershipOnGrab: false }));
        // A child, so it follows the enemy on every page with nothing extra sent.
        const tag = await label("Enemy Label", { x: 0, y: 0.8, z: 0 }, "", 0.35, [2, 0.5], obj);
        enemies[spawn.id] = {
            spawn, def, obj, sync, tag,
            position: start,
            state: freshEnemyState(spawn.type),
            visible: true, lastAttack: 0, ownerMissingSince: 0, resetting: false
        };
        showEnemy(enemies[spawn.id]);
    }

    function enemyKey(id) { return "enemy-" + id; }

    function writeEnemy(enemy, state) {
        enemy.state = state;
        showEnemy(enemy);
        scene.SetPublicSpaceProps({ [enemyKey(enemy.spawn.id)]: JSON.stringify(state) });
    }

    function showEnemy(enemy) {
        const s = enemy.state;
        const visible = s.status !== "dead";
        if (visible !== enemy.visible) {
            enemy.visible = visible;
            enemy.obj.SetActive(visible);
        }
        const owner = s.owner ? (s.owner === me.uid ? " <color=#a0c8ff>(yours)</color>" : " <color=#aaaaaa>(" + s.ownerName + ")</color>") : "";
        const text = "<b>" + enemy.def.name + "</b> Lv " + enemy.def.level + owner + "\n" + hpBar(s.hp, enemy.def.hp);
        if (enemy.tag.text.text !== text) enemy.tag.text.text = text;
    }

    scene.On("space-state-changed", (e) => {
        for (const change of e.detail.changes) {
            const id = String(change.property || "").replace(/^enemy-/, "");
            const enemy = enemies[id];
            if (!enemy || !change.newValue) continue;
            try { enemy.state = JSON.parse(change.newValue); } catch (err) { continue; }
            showEnemy(enemy);
        }
    });

    function usersInRoom() {
        return new Set(Object.keys(scene.users || {}));
    }

    async function hitEnemy(enemy, damage) {
        if (!me.profile || damage <= 0) return;
        const s = enemy.state;
        if (!mayHit(s, me.uid, usersInRoom())) {
            if (s.status !== "dead") say(s.ownerName + " is fighting that one.");
            return;
        }
        const claiming = s.owner !== me.uid;
        if (claiming) await enemy.sync.TakeOwnership();
        const hp = s.hp - damage;
        buzz(0.6, 0.08);
        if (hp > 0) {
            writeEnemy(enemy, { ...s, status: "fighting", hp, owner: me.uid, ownerName: me.name });
            return;
        }
        writeEnemy(enemy, { ...s, status: "dead", hp: 0, owner: me.uid, ownerName: me.name,
            respawnAt: Date.now() + ENEMY_RULES.respawnSeconds * 1000 });
        const result = await sendEvent({ type: "kill", enemy: enemy.spawn.type });
        if (result) {
            say("Defeated " + enemy.def.name + "  +" + result.xp + " XP, +" + result.gold + " gold");
            for (const id of result.questsChanged || []) say(R.questStatus(me.profile, id));
        }
    }

    async function resetEnemy(enemy) {
        if (enemy.resetting) return; // the tick can ask again while this one is waiting
        enemy.resetting = true;
        try {
            await enemy.sync.TakeOwnership();
            enemy.position = { ...enemy.spawn.home, y: enemy.spawn.home.y + ENEMY_RULES.size / 2 };
            await enemy.obj.SetPosition(V3(enemy.position));
            writeEnemy(enemy, freshEnemyState(enemy.spawn.type));
        } finally {
            enemy.resetting = false;
        }
    }

    // Runs on every page; each page only drives the enemies it owns.
    function enemyTick(dt, now) {
        const feet = pose ? { x: pose.head.position.x, y: pose.head.position.y - 1.6, z: pose.head.position.z } : null;
        const room = usersInRoom();
        for (const enemy of Object.values(enemies)) {
            const s = enemy.state;
            if (s.owner === me.uid) {
                if (s.status === "fighting" && feet) {
                    const step = chaseStep(enemy.position, enemy.spawn.home, feet, enemy.def.speed, dt);
                    if (step.giveUp) { resetEnemy(enemy); say(enemy.def.name + " lost interest."); continue; }
                    if (step.position !== enemy.position) {
                        enemy.position = { ...step.position, y: enemy.spawn.home.y + ENEMY_RULES.size / 2 };
                        enemy.obj.SetPosition(V3(enemy.position));
                    }
                    if (step.attack && now - enemy.lastAttack >= enemy.def.attackEvery * 1000) {
                        enemy.lastAttack = now;
                        hurt(enemy.def.damage, enemy.def.name);
                    }
                } else if (s.status === "dead" && Date.now() >= s.respawnAt) {
                    resetEnemy(enemy);
                }
            } else if (s.owner && !room.has(s.owner)) {
                // Owner left: after a short grace, anyone puts the enemy back.
                enemy.ownerMissingSince = enemy.ownerMissingSince || now;
                if (now - enemy.ownerMissingSince > ENEMY_RULES.ownerGoneGraceMs) {
                    enemy.ownerMissingSince = 0;
                    resetEnemy(enemy);
                }
            } else {
                enemy.ownerMissingSince = 0;
                if (s.status === "dead" && Date.now() >= s.respawnAt + ENEMY_RULES.takeOverDelayMs) resetEnemy(enemy);
            }
        }
    }

    // --- Sword ------------------------------------------------------------------

    // Every page makes a sword for every player, with the same network id, so a
    // player's attached sword shows on their avatar for everyone. Only the local
    // player's own sword detects hits.
    async function buildSword(user) {
        if (swords[user.uid]) return;
        const isMe = user.uid === me.uid;
        const obj = new BS.GameObject({ name: "Sword " + user.uid, layer: LAYER.SWORD });
        swords[user.uid] = obj;
        await obj.SetNetworkId("sword-" + user.uid);
        await obj.AddComponent(new BS.Box({ width: SWORD.width, height: SWORD.width / 3, depth: SWORD.length }));
        await obj.AddComponent(new BS.Material({ color: new BS.Vector4(0.82, 0.85, 0.9, 1) }));
        if (!isMe) return;
        await obj.AddComponent(new BS.BoxCollider({
            isTrigger: true,
            size: new BS.Vector3(SWORD.width * 2, SWORD.width * 2, SWORD.length)
        }));
        await obj.AddComponent(new BS.Rigidbody({ isKinematic: true, useGravity: false }));
        await obj.AddComponent(new BS.ColliderEvents());
        const rotation = new BS.Quaternion(0, 0, 0, 1);
        rotation.SetFromEuler(SWORD.attachEuler);
        const attached = await obj.AddComponent(new BS.AttachedObject({
            uid: "me",
            avatarAttachmentPoint: BS.AvatarBoneName.RIGHTARM_HAND,
            attachmentPosition: V3(SWORD.attachPosition),
            attachmentRotation: rotation,
            autoSync: true
        }));
        await attached.Attach("me");
        obj.On("trigger-enter", (event) => onSwordTouch(event.detail));
    }

    function onSwordTouch(detail) {
        const name = typeof detail.name === "string" ? detail.name : "";
        if (!name.startsWith("Enemy ")) return;
        const enemy = enemies[name.slice(6)];
        if (!enemy || !me.profile) return;
        const now = performance.now();
        if (now - me.lastHit < R.COMBAT.swingCooldown * 1000) return;
        const speed = swingSpeed(handSamples, now);
        const damage = R.swingDamage(me.profile.level, speed);
        if (damage === 0) {
            say("<size=80%>Swing harder! (" + speed.toFixed(1) + " m/s)</size>");
            return;
        }
        me.lastHit = now;
        hitEnemy(enemy, damage);
    }

    // PC: F hits the nearest enemy in reach.
    function pcAttack() {
        if (!pose || !me.profile) return;
        const now = performance.now();
        if (now - me.lastHit < R.COMBAT.pcAttackCooldown * 1000) return;
        const head = pose.head.position;
        let best = null;
        for (const enemy of Object.values(enemies)) {
            if (enemy.state.status === "dead") continue;
            const d = vec.flatDistance(head, enemy.position);
            if (d <= R.COMBAT.pcAttackRange && (!best || d < best.d)) best = { enemy, d };
        }
        if (!best) { say("<size=80%>Nothing in reach.</size>"); return; }
        me.lastHit = now;
        hitEnemy(best.enemy, R.swingDamage(me.profile.level, R.COMBAT.pcSwingSpeed));
    }

    // --- Player health ------------------------------------------------------------

    function hurt(damage, source) {
        if (!me.profile || me.hp <= 0) return;
        me.hp = Math.max(0, me.hp - damage);
        me.lastHurt = performance.now();
        buzz(0.9, 0.15);
        if (me.hp === 0) die(source);
        updateHud();
    }

    async function die(source) {
        say("<color=#ff6060>You were defeated by " + source + ".</color>");
        for (const enemy of Object.values(enemies)) {
            if (enemy.state.owner === me.uid && enemy.state.status === "fighting") resetEnemy(enemy);
        }
        await scene.TeleportTo(new BS.Vector3(SPAWN.x, SPAWN.y, SPAWN.z), SPAWN.yaw, true);
        me.hp = R.maxHp(me.profile.level);
        const result = await sendEvent({ type: "death" });
        if (result && result.goldLost > 0) say("You lost " + result.goldLost + " gold.");
        updateHud();
    }

    function regen(now, dt) {
        if (!me.profile || me.hp <= 0) return;
        const max = R.maxHp(me.profile.level);
        if (me.hp < max && now - me.lastHurt > R.COMBAT.regenDelay * 1000) {
            me.hp = Math.min(max, me.hp + max * R.COMBAT.regenPerSecond * dt);
            updateHud();
        }
    }

    function buzz(strength, seconds) {
        if (scene.SendHapticImpulse) scene.SendHapticImpulse(strength, seconds, BS.HandSide.RIGHT);
    }

    // --- Quest places ---------------------------------------------------------------

    const visitsSent = new Set();

    function checkPlaces() {
        if (!pose || !me.profile) return;
        const wanted = wantedVisits(me.profile);
        for (const place of wanted) {
            const area = PLACE_AREAS[place];
            if (!area || visitsSent.has(place) || !insideBox(pose.head.position, area)) continue;
            visitsSent.add(place);
            sendEvent({ type: "visit", place }).then((result) => {
                visitsSent.delete(place);
                if (result) {
                    say("Found: " + R.PLACES[place].name);
                    for (const id of result.questsChanged || []) say(R.questStatus(me.profile, id));
                }
            });
        }
    }

    // --- HUD ------------------------------------------------------------------------

    const hud = { text: null, messages: [], last: "" };

    async function buildHud() {
        const obj = new BS.GameObject({ name: "HUD" });
        hud.text = await obj.AddComponent(new BS.Text({
            text: "",
            fontSize: 0.3,
            richText: true,
            rectTransformSizeDelta: new BS.Vector2(1.6, 0.8)
        }));
        const attached = await obj.AddComponent(new BS.AttachedObject({
            uid: "me",
            avatarAttachmentPoint: BS.AvatarBoneName.HEAD,
            attachmentPosition: new BS.Vector3(0, -0.45, 1.2),
            autoSync: false // only you see your HUD
        }));
        await attached.Attach("me");
    }

    function say(text) {
        hud.messages.push({ text, at: performance.now() });
        if (hud.messages.length > 3) hud.messages.shift();
        updateHud();
    }

    function updateHud() {
        if (!hud.text) return;
        const now = performance.now();
        hud.messages = hud.messages.filter((m) => now - m.at < MESSAGE_MS);
        const lines = [];
        const p = me.profile;
        if (p) {
            const max = R.maxHp(p.level);
            const next = R.xpToNext(p.level);
            lines.push("<b>Lv " + p.level + "</b>   XP " + (next ? p.xp + "/" + next : "max") + "   Gold " + p.gold
                + (me.online ? "" : "   <color=#ff8040>OFFLINE</color>"));
            lines.push("HP " + hpBar(me.hp, max, 12) + " " + Math.ceil(me.hp) + "/" + max);
            for (const id of Object.keys(p.quests.active).slice(0, 3)) lines.push("<size=80%>" + R.questStatus(p, id) + "</size>");
        } else {
            lines.push("Loading…");
        }
        for (const m of hud.messages) lines.push("<size=85%>" + m.text + "</size>");
        const text = lines.join("\n");
        if (text !== hud.last) {
            hud.text.text = text;
            hud.last = text;
        }
    }

    // --- Input and loop -------------------------------------------------------------

    scene.On("pose-update", (e) => {
        pose = e.detail;
        if (pose.rightHand) {
            const p = pose.rightHand.position;
            handSamples.push({ t: performance.now(), p: { x: p.x, y: p.y, z: p.z } });
            if (handSamples.length > 12) handSamples.shift();
        }
    });

    scene.On("key-press", (e) => {
        if (e.detail.key === BS.KeyCode.F) pcAttack();
    });

    scene.On("user-joined", (e) => {
        const user = e.detail;
        if (user.isLocal) {
            me.uid = user.uid;
            me.name = user.name || "Adventurer";
            loadProfile();
        }
        if (worldReady) buildSword(user);
        else waitingUsers.push(user);
    });

    scene.On("user-left", (e) => {
        const sword = swords[e.detail.uid];
        if (sword && e.detail.uid !== me.uid) {
            sword.Destroy();
            delete swords[e.detail.uid];
        }
    });

    let worldReady = false;
    const waitingUsers = [];

    let lastTick = performance.now();
    function tick() {
        const now = performance.now();
        const dt = Math.min((now - lastTick) / 1000, 0.5);
        lastTick = now;
        try {
            enemyTick(dt, now);
            regen(now, dt);
            checkPlaces();
            updateHud();
        } catch (e) {
            console.warn("tick failed", e);
        }
    }

    scene.On("unity-loaded", async () => {
        await buildGround();
        for (const npc of NPC_LAYOUT) await buildNpc(npc);
        for (const spawn of ENEMY_SPAWNS) await buildEnemy(spawn);
        // Enemy state written before we arrived.
        const saved = (scene.spaceState && scene.spaceState.public) || {};
        for (const [key, value] of Object.entries(saved)) {
            const enemy = enemies[key.replace(/^enemy-/, "")];
            if (enemy && value) { try { enemy.state = JSON.parse(value); showEnemy(enemy); } catch (e) { /* ignore */ } }
        }
        await buildHud();
        worldReady = true;
        for (const user of waitingUsers.splice(0)) await buildSword(user);
        refreshNpcMarkers();
        setInterval(tick, TICK_MS);
    });
}

if (typeof window !== "undefined") {
    window.addEventListener("bs-loaded", startWorld);
}

if (typeof module !== "undefined") {
    module.exports = {
        CONFIG, LAYER, SPAWN, PLACE_AREAS, NPC_LAYOUT, ENEMY_SPAWNS, ENEMY_RULES, SWORD,
        insideBox, swingSpeed, npcAction, wantedVisits, mayHit, chaseStep, freshEnemyState, hpBar
    };
}
