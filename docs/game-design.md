# Swords and Spells Nexus: Game Design Document (Draft v0.1)

> Status: **planning, first spike built**. A small fantasy MMO-style RPG for
> Altspace: solo PVE in a shared world, with levels, quests and sword combat.
> Checked against the Altspace Creator SDK docs (https://altvr.app/docs/).
>
> Markers:
> - **[DECIDE]**: still needs an answer from the designer.
> - **[SPIKE]**: the docs suggest it works, but it needs a quick prototype to
>   confirm before we build on it.

## 1. Concept

Players arrive in **Brightwater**, a small starter town, pick up quests from
villagers, and head out into **Whisperwood** to fight monsters with a sword.
Killing monsters and finishing quests earns XP and gold. XP raises your level
(cap 10), which makes you tougher and hit harder. Progress is saved on our own
server, so your character is waiting for you on every visit, in any instance.

It's **solo play in a multiplayer world**: you see and talk to everyone else,
but you fight your own battles. Parties come later.

**Design pillars**
1. **The swing is the skill.** In VR you really swing the sword. A real swing
   hits; a lazy poke doesn't.
2. **Always making progress.** Every session ends with more XP, gold or quest
   progress than it started with, and it's never lost.
3. **Shared world, your own fights.** Other players are company, not
   competition. Nobody can steal your kill.
4. **Fits a headset.** Light enough to run on Quest, readable without menus.

## 2. Decisions so far

| Topic | Decision |
|---|---|
| Name | **Swords and Spells Nexus** (repo: S-B-Nexus) |
| Theme | Fantasy |
| Focus | PVE, MMO-style: levels, quests, gold |
| Group play | **Solo** for now, in a shared multiplayer world. Parties later |
| Combat | Physical sword swings in VR; **one swing counts every 2 s** (tune later). PC keeps press-to-attack (F) |
| Spells, gold shop | **Later** |
| Who can fight an enemy | **Whoever hits it first owns it.** Everyone sees the fight; only the owner can hit it or get credit |
| Death | Back to the starter town, **lose 10% of your gold** (rounded down). XP, level and quests are kept |
| Code | All game logic in **JavaScript** (the world page and the backend). Unity assets for art only |
| Backend | **Cloudflare Workers + D1** (JavaScript, free tier), deployed from GitHub |
| First scope | 1 town, 1 zone, 5 enemy types, 10 quests, level cap 10 |
| Guests | Turned away: progress needs a signed-in account (section 9.4) |

## 3. What the platform gives us

These facts from the SDK docs shape the whole design:

| Fact | Docs page | What it means here |
|---|---|---|
| A published world carries **no C# code**, only the scene and its assets | Troubleshooting | Asset Store models, animations and textures work. Asset Store *scripts* (RPG kits, AI packs) don't. Game logic is JavaScript |
| Visual Scripting runs, but only **allow-listed nodes** | Visual Scripting | A fallback for things JavaScript can't reach (Animator, NavMesh); see S4 |
| The app includes **AI Navigation (NavMesh)**, Splines, Cinemachine 3, Terrain | Troubleshooting | NavMesh can be baked into the scene; driving agents is S4 |
| "No built-in way to save a player's own progress between visits"; the page can call **your own server** | Saving Data, Browser | We need the backend. User state is wiped when a player leaves; space state lasts 24 h |
| `user.uid` is **the same on every visit and in every space** | Multiplayer | The key for a player's save |
| Nothing proves to *our* server which player is calling | (not documented) | See 9.4: the rules limit what a faked call can do |
| Collision and trigger events reach the page; `pose-update` gives head and hand positions up to 30×/s | Physics, Scene Events | Swing detection |
| Synced objects share **position only** (rotation isn't synced in the app); owner moves kinematic ones | Multiplayer | Enemies are synced objects moved by their owner's page |
| One-shots ≤ 4 KB; space state strings can't contain `¶ § \| ‽ ¤` | Multiplayer, Scene API | Enemy state is small JSON in space state |
| Keyboard has `key-press` **and** `key-release` | Scene Events | PC controls are workable |

## 4. Architecture

```
  Altspace instance (up to ~16 players)              Our backend (Cloudflare)
 ┌──────────────────────────────────────┐          ┌───────────────────────────┐
 │ each player's page (JavaScript)      │  HTTPS   │ Worker (JavaScript)       │
 │  - builds/drives the world           │ ───────► │  - GET  /players/:uid     │
 │  - sword hits, enemy AI it owns      │ ◄─────── │  - POST /players/:uid/    │
 │  - HUD, NPC clicks, quest triggers   │          │         events            │
 │  - rules.js (shared)                 │          │  - rules.js (shared)      │
 └──────────────┬───────────────────────┘          │  D1 database: players     │
                │ synced objects, space state      └───────────────────────────┘
                ▼
     other players' pages see the same enemies, swords and fights
```

- **`shared/rules.js`** holds every number and rule: XP curve, damage, enemy
  stats, quests, death penalty. The page uses it for instant feedback; the
  server uses the same file to decide what's saved. **The server's answer
  always wins.**
- The page sends **events**, not numbers: "I killed a slime", "I talked to
  Bren", "I died". The server works out the XP and gold. A client can't say
  "give me 5,000 XP".
- **Instances:** each Altspace instance holds a limited number of players. The
  backend makes them feel like one world: your character follows you into any
  instance.

## 5. Player and progression

### 5.1 Levels
| Level | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 |
|---|---|---|---|---|---|---|---|---|---|
| XP needed | 100 | 200 | 350 | 550 | 800 | 1,100 | 1,450 | 1,850 | 2,300 |

About 8,700 XP to reach 10. The 10 quests give 3,400; the rest comes from
fighting. **[SPIKE]** Tune after playtests so level 10 takes roughly 3–4 hours.

- **Health:** 80 + 20 per level (80 at level 1, 260 at level 10).
- **Sword damage:** 8 + 2 per level, scaled by swing speed (6.1).
- **Health regen:** after 6 s without being hit, 5% of max health per second.
- **Kill XP falls off** for enemies more than 2 levels below you (down to
  10%), so players move on to new areas.

### 5.2 Gold
Dropped by every kill and given by quests. Nothing to spend it on yet:
**[DECIDE]** a shop (better swords, potions) is the obvious next use.

### 5.3 Death
At 0 health: you're sent back to Brightwater, health refills, and you lose
**10% of your gold** (rounded down). The enemy that beat you resets to full
health and goes home. XP, level and quests are never lost.

## 6. Combat

### 6.1 VR: real swings, with limits
- The sword is attached to your right hand. Its blade is a trigger collider;
  touching an enemy is a **hit only if your hand is moving at 1.5 m/s or
  more**. Slower contact shows "Swing harder!".
- **Damage scales with speed:** 75% at 1.5 m/s, 100% at 3 m/s, capped at 150%.
  So a big swing beats a flick, but flailing as fast as possible doesn't pay.
- **Cooldown:** only **one swing counts every 2 s**, so waggling doesn't
  multiply damage. **[SPIKE]** Tune in playtests.
- Hand speed comes from `pose-update` (right hand position, last 150 ms).
- **[DECIDE]** Other limits you mentioned: stamina, a minimum swing *arc*,
  blocking. Stamina is the easiest to add next.

### 6.2 PC: press to attack
Desktop has no hand tracking. **F** hits the nearest enemy within 2.5 m at a
fixed "medium swing" (2.5 m/s, 83% damage) with the same 2 s cooldown, so
VR players who swing well do more damage. **Decided:** PC players stay.

### 6.3 Who fights an enemy
- An idle enemy belongs to nobody. **The first player to hit it owns it**: their
  name shows on its health bar, its synced object moves to them, and only they
  can hit it or get credit for the kill.
- Other players see the whole fight (position via the synced object, health via
  space state) but their hits are refused ("Kai is fighting that one").
- **It ends** when the enemy dies, the owner dies, the owner leads it more than
  18 m from its home (it gives up and goes back), or the owner leaves the
  instance (anyone resets it after 3 s).
- **Race:** two players hitting an idle enemy in the same instant both claim
  it; the last write wins and the other player's hit is lost. Rare and
  harmless.

### 6.4 Enemy AI
Run only by the owner's page, 10 times a second:
1. **Chase:** move toward the owner along the ground at the enemy's speed.
2. **Attack:** within 1.4 m, hit the owner every `attackEvery` seconds.
3. **Leash:** owner more than 18 m from home → give up, full health, go home.
4. **Dead:** hidden for 15 s, then back at home. If the owner left, anyone
   respawns it 10 s late.

Enemies only ever hurt their owner. **[SPIKE] S4** decides whether movement
uses NavMesh (walks around obstacles) or straight lines (v1).

### 6.5 Enemies (first zone)
| Enemy | Level | HP | Damage | Attack every | XP | Gold | Where |
|---|---|---|---|---|---|---|---|
| Slime | 1 | 30 | 4 | 1.6 s | 12 | 1–3 | Road and fields by town |
| Forest Wolf | 3 | 70 | 9 | 1.4 s | 30 | 2–5 | Around the Hunter's Camp |
| Goblin Scout | 5 | 120 | 14 | 1.5 s | 55 | 4–9 | Whisperwood |
| Skeleton | 7 | 180 | 20 | 1.7 s | 80 | 6–12 | The Old Graveyard |
| Goblin Chief (boss) | 9 | 600 | 35 | 2.0 s | 400 | 80–120 | Goblin Camp |

## 7. Quests

### 7.1 How they work
- A quest is a list of **steps done in order**: *talk* to an NPC, *visit* a
  place, or *kill* N of an enemy. When all steps are done, you hand it in
  (to the giver, or a named NPC) for XP and gold.
- Quests unlock in a chain (`requires`) and by level (`minLevel`).
- Up to 10 active at once. The HUD shows the first 3.
- **NPCs:** click one. It hands in a finished quest first, then counts a
  "talk to me" step, then offers its next quest. Over its head: **!** has a
  quest for you, **?** is waiting for a hand-in, **…** wants to talk.
  **[DECIDE]** a proper dialogue board with Accept/Decline buttons later.
- **Places** are invisible boxes; walking into one counts a "visit" step.

### 7.2 The first 10
| # | Quest | Giver | Lvl | Steps | Reward |
|---|---|---|---|---|---|
| q01 | Welcome to Brightwater | Elder Mara | 1 | Talk to Captain Bren | 50 XP, 5 g |
| q02 | Slime Trouble | Captain Bren | 1 | Kill 5 Slimes | 100 XP, 10 g |
| q03 | The Hunter's Camp | Captain Bren | 2 | Find the Hunter's Camp, talk to Tavi | 80 XP, 5 g |
| q04 | Thin the Pack | Tavi the Hunter | 2 | Kill 6 Forest Wolves | 220 XP, 20 g |
| q05 | Scout's Warning | Tavi the Hunter | 3 | Reach Whisperwood Edge, talk to Scout Ryn | 150 XP, 10 g |
| q06 | Goblin Scouts | Scout Ryn | 4 | Kill 6 Goblin Scouts | 400 XP, 35 g |
| q07 | The Old Graveyard | Scout Ryn | 5 | Find the Old Graveyard | 250 XP, 15 g |
| q08 | Restless Bones | Scout Ryn | 6 | Kill 8 Skeletons | 650 XP, 50 g |
| q09 | Report to the Elder | Scout Ryn | 6 | Talk to Elder Mara | 300 XP, 20 g |
| q10 | The Goblin Chief | Elder Mara | 8 | Reach the Goblin Camp, kill the Goblin Chief | 1,200 XP, 150 g |

## 8. World layout (v1)

```
                         GOBLIN CAMP (boss, lvl 8-10)
                                 │
       OLD GRAVEYARD ──── WHISPERWOOD (goblins, lvl 4-6) ──── WHISPERWOOD EDGE (Scout Ryn)
       (skeletons 6-8)           │
                          HUNTER'S CAMP (Tavi, wolves 2-4)
                                 │
                          FIELDS & ROAD (slimes 1-2)
                                 │
                     BRIGHTWATER (start, Mara, Bren, respawn)
```

- **One Unity scene** (the SDK publishes one scene per project), built from
  Asset Store fantasy packs: low-poly, Quest-friendly (see 9.6).
- **Difficulty rises with distance** from town, so a player always knows which
  way is harder.
- Enemies have fixed spawn points with fixed network ids (`enemy-slime-1`…).
  About 30 for the zone. **[SPIKE] S7** checks how many the page can drive.

## 9. Technical design

### 9.1 Backend API
| Call | Does |
|---|---|
| `GET /players/:uid?name=` | Loads the profile, creating it on the first visit |
| `POST /players/:uid/events` `{ event, name }` | Applies one event through `rules.applyEvent` and saves it. 200 with the new profile and rewards; 409 with the reason and the current profile when the rules refuse it |
| `GET /health` | `{ ok: true }` |

Events: `kill`, `talk`, `visit`, `accept`, `turn-in`, `abandon`, `death`.

- **Storage:** one D1 row per player: the profile as JSON plus a version
  number. A save only lands if the version hasn't changed since it was read;
  otherwise the server reads again and retries. Two requests at once can't
  lose each other's progress.
- **CORS:** only `https://*.worldspace.host` (where Altspace serves worlds) may
  call it from a browser.
- **Gold rolls** happen on the server, not the client.

### 9.2 What each player's page shares
| Data | Where | Written by |
|---|---|---|
| Enemy position | Synced object `enemy-<id>`, kinematic | Its owner's page |
| Enemy status, HP, owner | Public space state `enemy-<id>` (JSON string) | Whoever hits, kills or resets it |
| Your sword on your hand | Attached object `sword-<uid>`, `autoSync` | You; every page makes a copy for every player |
| Your profile | The backend | The backend only |
| Your health | Your page only | You |

### 9.3 Offline mode
If the backend can't be reached, the page says **OFFLINE** on the HUD and
runs the same rules locally, so the world is still playable, but nothing is
saved. **[DECIDE]** resync offline progress later, or keep it throwaway?
(Throwaway is safer: offline progress can't be checked.)

### 9.4 Cheating
The SDK gives the page the player's `uid`, but **no signed token our server
could check**. So a modified client could call the API pretending to be
someone, or report kills that didn't happen. What limits it:
- The server decides every reward from the rules; the client sends events only.
- Quests must be done in order, at the right level, and can't be repeated.
- **No more than 12 kills a minute** per player.
- Guests are turned away (`EnableGuests: false`, and **Edit world → Who is
  turned away → Guests** on altvr.app), so every save belongs to an account.

For a co-operative PVE game with no trading, this is acceptable: a cheater
can only inflate their own character. **Revisit before adding trading,
leaderboards or anything competitive**, and ask SideQuest whether a signed
player token is planned.

### 9.5 Unity side
- Art, terrain, buildings, enemy models and their animations come from Unity
  assets. **No C# scripts in the build.**
- Each scripted object needs a BS component (or a BS Object Id) for the page to
  find it. Enemy and NPC prefabs get one, with fixed ids.
- **Animations [SPIKE] S4:** JavaScript can't call Animator directly. Options,
  best first: a Visual Scripting graph on the enemy that plays Animator
  triggers when the page sets a value (if Animator members pass the Builder's
  allow-list check); otherwise looping idle/move animations, with attacks
  shown by effects and sounds.
- **Pathfinding [SPIKE] S4:** NavMesh is in the app; whether a page or graph
  can set a NavMeshAgent's destination is the open question. v1 moves enemies
  in straight lines, with spawn areas kept clear of obstacles.

### 9.6 Performance
Quest headsets are the limit. Low-poly assets, baked lighting, few real-time
lights, and texture atlases. Page code talks to Unity in messages, so enemy
updates are only sent for enemies that are actually moving.

## 10. Spikes (prototype first)
| # | Question | Why it matters | Covered by the test world? |
|---|---|---|---|
| S1 | Can the published page call our backend (HTTPS + CORS from `*.worldspace.host`)? | Saving at all | **Yes**, HUD shows OFFLINE if not |
| S2 | Does a sword attached to the hand fire trigger events on enemies? Is `pose-update` hand speed good enough to tell a swing from a poke? | Combat | **Yes** |
| S3 | First-hitter ownership: does the synced enemy follow its owner smoothly for other players? | Shared world | **Yes** |
| S4 | Can Animator triggers and NavMeshAgent destinations be driven (Visual Scripting allow-list, or the page)? | Enemy quality | No: check in Unity (world/README.md) |
| S5 | PC press-to-attack: playable? | PC players | **Yes** |
| S6 | Does a sword attached with `autoSync` show on your avatar for others, with every page making a copy per player? | Seeing each other fight | **Yes** |
| S7 | How many enemies can one page drive at 10 Hz before frame rate drops on Quest? | Zone size | Partly (5 slimes) |

## 11. Tunable settings
All in `shared/rules.js` (game) or `world/WebRoot/script.js` (layout).

| Setting | Default |
|---|---|
| Level cap | 10 |
| Min swing speed | 1.5 m/s |
| Full-damage swing | 3 m/s |
| Swing damage range | 75–150% |
| Hit cooldown (VR / PC) | 2 s / 2 s |
| PC reach | 2.5 m |
| Health regen | after 6 s, 5%/s |
| Death gold loss | 10% |
| Enemy leash | 18 m |
| Enemy respawn | 15 s |
| Kill rate limit | 12 per minute |
| Max active quests | 10 |

## 12. Edge cases
- **Owner leaves mid-fight:** after 3 s, any page resets the enemy (full HP, home).
- **You die while owning several enemies:** all of them reset.
- **Server unreachable mid-session:** HUD shows OFFLINE; later events aren't
  saved. Rejoining reloads the last saved profile.
- **Two tabs/headsets on one account:** both send events; versioned saves keep
  both sets of progress, in arrival order.
- **Quest step and kill at once:** a kill counts for every active quest with
  that kill step.
- **Clock differences:** respawn times use the owner's clock; others only step
  in 10 s after it should have happened.

## 13. Roadmap
| Phase | Goal | Output |
|---|---|---|
| 0. Spikes | S1–S7 in the test world | Go/no-go on backend, sword combat, enemy sync |
| 1. Greybox zone | Brightwater + Whisperwood blocked out, all 5 enemy types, 10 quests | Full quest chain playable |
| 2. Art pass | Asset Store fantasy packs, enemy animations (S4), sounds | Looks like a game |
| 3. Polish | Dialogue boards, quest log board, gold shop, stamina | Public beta |
| 4. Parties | Shared enemy ownership and quest credit for a group | Group play |
| 5. Spells | The "Spells" in the name: a second combat style | v1.0 |

## 14. Open decisions
1. **Swing limits:** beyond the 2 s cooldown: stamina? blocking? minimum arc?
2. **Dialogue:** click-through NPCs (now) or a dialogue board with buttons?
3. **Offline progress:** throwaway (now) or resync?
4. **Who owns the Cloudflare account** the backend runs on?

**Later, by decision:** spells (and how to cast them in VR), and what gold is
spent on.

## Sources
Altspace Creator docs: https://altvr.app/docs/ (pages used: Saving Data,
Browser Overview, Multiplayer, User & Multiplayer, Scene API, Scene Events,
Scene Settings, Physics, VR Interaction, Visual Scripting, Layers, Tags,
Troubleshooting, Math Types).
