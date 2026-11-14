# Swords and Spells Nexus: Game Design Document (v0.2)

> Status: **design complete for levels 1–10; first test world and backend
> built.** A fantasy MMO-style RPG for Altspace: solo PVE in a shared world,
> with sword combat, levels, story quests and bounties.
>
> This is the single reference for building the game. The longer story
> write-up is [story.md](story.md); the pictures are the
> [coast map](map.html) and the [topography](topography.html) (open them in a
> browser). Every outside source is listed in [section 17](#17-references).
>
> Markers:
> - **[DECIDE]**: still needs an answer from the designer.
> - **[SPIKE]**: expected to work, but needs a quick prototype to confirm.
> - **[NEW]**: designed here, not built yet (the code still has the v0.1
>   version). Section 15 says in which phase each gets built.

---

## 1. Concept

Brightwater used to be a minor shipping town. A few years ago the cargo ship
*Dead Man's Dangle* wrecked on Tideglass Isle carrying blackberry cuttings,
and nobody knew blackberries would grow so well here. The berries made the
town rich (they brew into health potions), then the brambles grew out of
control into the **Black Thorn Blight**.

Players are **sellswords**. The town council grants each one a **Thorn Writ**:
a contract giving limited authority to fight and burn thorn in the lands it
names. Players take the town's **bounties**, follow a short **story chain**
through five zones, and level from 1 to 10. Progress is saved on our own
server, so a character follows the player into every visit and every
instance.

**Solo play in a shared world:** everyone sees and talks to everyone, but
nobody has to join a group, order or party. Shared moments (Thorn Surges, the
hourly Thornheart) are open to anyone who turns up.

**Design pillars**
1. **The swing is the skill.** In VR you really swing the sword. A real swing
   hits; a lazy poke doesn't.
2. **Always making progress.** Every session ends with more XP, gold or story
   than it started with, and it's never lost.
3. **Shared world, your own fights.** Other players are company, not
   competition. Nobody steals your kill, and nobody needs a group.
4. **Fits a headset.** Light enough for Quest, readable without menus.

## 2. Decisions

| Topic | Decision |
|---|---|
| Name | **Swords and Spells Nexus** (repo: S-B-Nexus) |
| Theme | Fantasy, woodland coast |
| Story | **The Black Thorn Blight** (section 7, [story.md](story.md)) |
| Player role | Sellswords holding a **Thorn Writ**: limited authority granted by the town council, extended as they level |
| Groups | **No groups, parties, guilds or orders.** Everyone plays solo; shared events need no sign-up |
| Map | **Tutorial + main city + four combat zones** (section 8) |
| Levels | 1 to 10 |
| Combat | Physical sword swings in VR; **one swing counts every 2 s**. PC keeps press-to-attack (F) |
| Who can fight an enemy | Normal enemies: **whoever hits first owns it**. Surge brutes and the Thornheart: **anyone can hit, everyone who hits gets credit** [NEW] |
| Berries | Ripe blackberries heal **almost nothing** (1 HP). In the lore, health potions are brewed from them |
| Death | Back to Brightwater, **lose 10% of your gold** (rounded down). XP, level and quests are kept |
| Code | All game logic in **JavaScript** (world page and backend) or **Visual Scripting** (Unity graphs). Unity assets for art only; no C# |
| Backend | **Cloudflare Workers + D1** (JavaScript, free tier), deployed from GitHub |
| Guests | Turned away: progress needs a signed-in account |
| Later, by decision | Spells (first school: embercraft), gold shop (potions first), parties if ever wanted |

## 3. What the platform gives us

Facts from the Altspace SDK docs and source that shape the design (sources in
section 17):

| Fact | What it means here |
|---|---|
| A published world carries **no C# code**, only the scene and its assets | Asset Store models, animations, textures and sounds work. Asset Store *scripts* don't. Logic is JavaScript or Visual Scripting |
| Visual Scripting runs, but only **allow-listed nodes** (SDK file `VsStubsAllowed.cs`) | Enemy AI is built in graphs: NavMeshAgent, Animator, Random and physics members are all on the list |
| The app includes **AI Navigation (NavMesh)**, Splines, Cinemachine 3, Terrain | NavMesh baked into each scene; Unity Terrain for the landscape |
| No built-in per-player save; the page **can call our own server** | The backend is required. User state is wiped when a player leaves; space state lasts 24 h per instance |
| `user.uid` is the same on every visit and in every space | The key for a player's save |
| Nothing proves to our server which player is calling | Section 12.6: the rules limit what a faked call can do |
| Collision and trigger events reach the page; `pose-update` gives head and hand positions up to 30×/s | Swing detection (page) or `Rigidbody.linearVelocity` (graph) |
| Synced objects share **position only**; the owner moves kinematic ones | Enemies are synced objects moved by one page |
| **Shared clock** (Sync Loop, shared time) | Bounty rotation, Thorn Surges and the hourly Thornheart fire at the same moment for everyone |
| Portals link worlds; a built world can be up to 300 MB | Zones can be separate worlds (section 8.4) |
| Keyboard has `key-press` **and** `key-release` | PC controls are workable |

## 4. Architecture

```
  Altspace world instance (up to ~16 players)          Our backend (Cloudflare)
 ┌──────────────────────────────────────────┐        ┌──────────────────────────────┐
 │ Unity scene: terrain, models, NavMesh     │        │ Worker (JavaScript)          │
 │ Visual Scripting graphs: enemy AI,        │        │  GET  /players/:uid          │
 │   sword hits, player health, berries      │        │  POST /players/:uid/events   │
 │ Page (JavaScript): saving, quests,        │ HTTPS  │  GET  /world        [NEW]    │
 │   bounties, HUD, NPCs                     │ ─────► │  rules.js (shared)           │
 │   rules.js (shared)                       │ ◄───── │  D1: players, zones [NEW]    │
 └───────────────┬──────────────────────────┘        └──────────────────────────────┘
                 │ synced objects, space state, one-shots
                 ▼
      other players in the instance see the same enemies, swords and fights
```

- **`shared/rules.js`** holds every number and rule. The page uses it for
  instant feedback; the server uses the same file to decide what's saved.
  **The server's answer always wins.**
- The page sends **events** ("I killed a rotfang wolf", "I burned a briar
  patch"), never numbers. The server works out XP and gold.
- **Graphs and page talk** through the SDK's bridges: graphs fire global
  events and set space state; the page listens and sends backend events.
  **[SPIKE] S8** confirms the cleanest path (section 14).
- **Instances:** each Altspace instance holds a limited number of players. The
  backend makes them feel like one world: your character, and the zones'
  thorn levels, are the same in every instance.

---

## 5. Player and progression

### 5.1 Levels

| Level | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 |
|---|---|---|---|---|---|---|---|---|---|
| XP needed | 100 | 200 | 350 | 550 | 800 | 1,100 | 1,450 | 1,850 | 2,300 |

About 8,700 XP to reach 10. The story chain gives 3,400; bounties and kills
give the rest. **[SPIKE]** Tune so level 10 takes roughly 3–4 hours.

- **Health:** 80 + 20 per level (80 at level 1, 260 at level 10).
- **Sword damage:** 8 + 2 per level, scaled by swing speed (6.1).
- **Health regen:** after 6 s without being hit, 5% of max health per second.
- **Kill XP falls off** for enemies more than 2 levels below you (down to
  10%), so players move on to new zones.

### 5.2 Gold

From kills, story quests and bounties. **[DECIDE]** First use: buying
blackberry health potions from the herbalist, then sword upgrades.

### 5.3 Death

At 0 health: back to Brightwater's spawn point with full health, **lose 10%
of your gold** (rounded down). The enemy that beat you resets and goes home.
XP, level, quests and held bounties are kept.

### 5.4 Berries and potions

| Item | Where | Effect |
|---|---|---|
| **Ripe blackberry** | Healthy hedgerows (Meadowmere Glade, Squire's Yard fence) | Eat it (raise it to your mouth in VR, click on PC): heals **1 HP**. Respawns on the bush after 60 s |
| **Blight berry** | Black thorn patches in every combat zone | Collect for bounties and the herbalist (2 gold each). Eating one makes you "sick": the view blurs for 3 s, no damage |
| **Blackthorn health potion** [DECIDE: later] | Bought from the herbalist | Heals 40% of max health |
| **Thornheart berry** | Thornheart drop | Trophy; sells for 25 gold |

---

## 6. Combat

### 6.1 VR: real swings, with limits

- The sword is a grabbable object (SDK grab preset). Its blade is a trigger
  collider tagged `UserTag1`.
- A touch is a **hit only if the sword moves at 1.5 m/s or more**.
- **Damage scales with speed:** 75% at 1.5 m/s, 100% at 3 m/s, capped at 150%.
- **One swing counts every 2 s.**
- **[DECIDE]** More limits later: stamina, minimum swing arc.

### 6.2 PC: press to attack

**F** hits the nearest enemy within 2.5 m as a "medium swing" (2.5 m/s, 83%
damage), same 2 s cooldown.

### 6.3 Who fights an enemy

**Normal enemies (first hitter owns it):**
- An idle enemy belongs to nobody. **The first player to hit it owns it**:
  their name shows on its health bar, and only they can hit it or get credit.
- Other players see the fight but their hits are refused.
- It ends when the enemy dies, the owner dies, the owner leads it more than
  18 m from home (it gives up), or the owner leaves (anyone resets it after
  3 s).
- Enemies only ever attack their owner.

**Open enemies [NEW]: Thorn brutes and the Thornheart.**
- **Anyone can hit**; damage is shared through space state.
- **Everyone who hits at least once gets full credit** (XP and gold, once per
  spawn).
- The enemy attacks whoever is closest. Its AI runs on one page: the
  synced object's owner (the first player in the instance).
- See 12.4 for how it's built.

### 6.4 Enemy AI

States: **Wander → Chase → Attack → Return**, plus **Block** for shielded
enemies and **Dead**. Run in Visual Scripting on the owning page (the build is
the [Unity guide](unity-first-scene.md), Part 6).

| Setting | Default |
|---|---|
| Wander radius / new spot every | 5 m / 3–6 s |
| Aggro range | 6 m |
| Attack range | 1.8 m |
| Leash range (from home) | 15 m |
| Walk / run speed | 1.2 / 3 m/s |
| Respawn | 15 s after death |

**Sword-and-shield enemies** (Hollow Knights, Varn): when ready to attack,
35% chance to raise the shield for 2 s instead. Hits on the raised shield do
no damage but use up the player's swing. After lowering it, a full attack
interval passes before it swings: the window to strike. Otherwise it plays one
of three swing animations at random.

### 6.5 Enemies

| Enemy | Zone | Lv | HP | Dmg | Every | XP | Gold | Notes |
|---|---|---|---|---|---|---|---|---|
| Training dummy | Yard | – | ∞ | 0 | – | 0 | 0 | Shows "Swing harder!" below 1.5 m/s |
| Sparring Knight | Yard | 1 | 40 | 1 | 2.0 s | 10 | 0 | Blocks 50%. Teaches the shield window |
| Thorn slime | Yard, Glade | 1 | 30 | 4 | 1.6 s | 12 | 1–3 | |
| Rotfang wolf | Glade | 3 | 70 | 9 | 1.4 s | 30 | 2–5 | Fast (run 4 m/s) |
| Sporeling **[NEW]** | Glowcap | 4 | 90 | 11 | 1.5 s | 40 | 3–6 | Every 3rd attack is a spore puff: view blurs 2 s |
| Goblin sapper | Glowcap | 5 | 120 | 14 | 1.5 s | 55 | 4–9 | Drops blight berries |
| Skeleton | Ruins | 6 | 180 | 20 | 1.7 s | 80 | 6–12 | |
| Hollow Knight **[NEW]** | Ruins | 7 | 200 | 18 | 1.6 s | 90 | 6–12 | Sword and shield, blocks 35% |
| Knight-Captain Varn **[NEW]** | Ruins | 7 | 450 | 24 | 2.0 s | 250 | 40–60 | Mini-boss. Blocks 35%, 3 swings |
| Tide crab **[NEW]** | Isle | 8 | 220 | 22 | 1.6 s | 100 | 8–14 | Takes half damage from the front |
| Grubnak the Sapper | Isle | 9 | 600 | 35 | 2.0 s | 400 | 80–120 | Boss, first-hitter owned (soloable) |
| Thorn brute **[NEW]** | Any zone | zone max + 1 | 4× base | 1.5× base | base | 3× base | 3× base | Thorn Surge elite, **open** |
| The Thornheart **[NEW]** | Isle | 10 | 1,500 + 500 per player present | 30 (root slam, 3 m) | 3.0 s | 300 | 50–80 | Hourly, **open**. Spawns 2 tide crabs every 30 s |

"Base" means the normal enemy of that zone. New numbers are first guesses:
**[SPIKE]** tune in playtests.

---

## 7. Story: The Black Thorn Blight

Full write-up: [story.md](story.md). The essentials:

- **Before:** Brightwater was a minor shipping town (timber, salt fish).
- **A few years ago:** the *Dead Man's Dangle* wrecked on Tideglass Isle
  carrying blackberry cuttings bound for a farm down the coast. They took
  root. Nobody knew blackberries would grow so well here.
- **The boom:** the herbalist found the berries make health potions; the town
  became a potion town; farmers planted hedgerows at Meadowmere.
- **The blight:** the brambles kept growing. Canes harden into black thorn,
  berries turn glossy black with a violet glow, and animals that eat them turn
  savage.
- **Now:** the council grants **Thorn Writs** to sellswords. The **Thornheart**,
  the bramble grown from the first cuttings, sits at the island's heart; its
  roots run under the water to the mainland. **Grubnak the Sapper**'s goblins
  farm its berries and sell them as "growth jam".
- **Why it never ends:** the thorn grows back. That's why enemies respawn,
  bounties return and the Thornheart comes back every hour.

### 7.1 Characters

| Who | Where | Role |
|---|---|---|
| Captain Bren | Squire's Yard | Trains new sellswords; signs the first writ; gives q01 |
| Elder Mara | Council hall, Brightwater | Grants and extends Thorn Writs; main story quests |
| The herbalist | Brightwater | Brews potions from ripe berries; buys and burns blight berries |
| The harbour master | Brightwater docks | Checks the writ covers the Isle before the ferry sails |
| Tavi the Hunter | Hunter's camp, Meadowmere Glade | Noticed the wolves changing |
| Scout Ryn | Lookout, Glowcap Hollow | Watching the goblins' berry trade |
| Knight-Captain Varn | Hollowmoor Ruins | Long-dead captain of the keep, woken by thorn roots in his tomb |
| Grubnak the Sapper | Tideglass Isle | Goblin chief farming the Thornheart's berries |

---

## 8. World

Pictures: [map.html](map.html) (zones, roads, story) and
[topography.html](topography.html) (heights, Brightwater close-up,
cross-sections).

### 8.1 Scale

**1 map unit = 0.5 m.** The coast is about **800 m × 500 m**. Heights are
first drafts; change freely.

### 8.2 Zones

| # | Zone | Levels | Height | Terrain | Enemies |
|---|---|---|---|---|---|
| 0 | **Squire's Yard** (tutorial) | 1 | 49 m | A fenced training clearing on a terrace below the southern ridge. You walk downhill from here into the glade | Dummies, Sparring Knight, one thorn slime |
| 1 | **Brightwater** (city) | hub | 0–22 m | Walled harbour town climbing from the docks (0 m) past the market terrace to the council hall on its hill (22 m). Gates west, south, east | None |
| 2 | **Meadowmere Glade** | 1–3 | 9 m | A shallow valley of berry farms and hedgerows along the Mere stream; windmill; hunter's camp on the east trail | Thorn slimes, rotfang wolves |
| 3 | **Glowcap Hollow** | 3–5 | 6 m floor, 17–24 m rim | A sunken bowl of giant glowing mushrooms under dark trees; you cross the rim and walk down into it | Sporelings, goblin sappers |
| 4 | **Hollowmoor Ruins** | 5–7 | 73 m (keep) | High moor in pine forest to the west; the broken keep on a knoll; graveyard; Hollow Crag (84 m) above | Skeletons, Hollow Knights, Varn |
| 5 | **Tideglass Isle** | 8–10 | 0–45 m | Pine island across the water (ferry from the docks). The wreck of the *Dead Man's Dangle* on the south-east shore, Grubnak's fort on the north cliffs (45 m), the Thornheart in a central hollow (28 m) | Tide crabs, goblin raiders, Grubnak, the Thornheart |

Also on the map: Thornback Ridge (82 m) along the south-east edge as the
world's southern wall; the Mere stream flowing north into the harbour; black
thorn patches around every combat zone, densest near the coast where the
roots come ashore.

### 8.3 Places (for "visit" quest steps)

Invisible trigger boxes; walking into one counts a visit.

| Id | Place |
|---|---|
| `squires-yard` | The training clearing |
| `brightwater` | Inside the city walls |
| `hunter-camp` | Tavi's camp, east edge of the glade |
| `glowcap-hollow` | The hollow's floor, below the rim |
| `hollowmoor` | The keep's courtyard |
| `tideglass-isle` | The island's ferry landing |
| `wreck` | The wreck of the *Dead Man's Dangle* |

### 8.4 One world or several **[DECIDE]**

| Option | For | Against |
|---|---|---|
| **Several worlds (recommended):** Brightwater + yard as one world; each combat zone its own world, joined by portals at the gates and the ferry | Small downloads (the scene was already getting slow to load); zones can ship one at a time; each fits Quest easily | Portals between worlds; each world has its own instances and space state (the backend already carries progress and thorn levels) |
| **One big world** | Simplest to wire; walk everywhere | Long load; everything must fit one Quest-friendly budget |

Either way, the SDK publishes **one scene per Unity project**, so several
worlds means several small projects sharing the same graphs and page code.

### 8.5 Building the terrain

- Use Unity **Terrain** (included in the app) with the heights from the
  topography page, or model terrain meshes per zone.
- Keep walkable slopes well under the NavMesh agent's default 45° maximum;
  gentler is better for comfort in VR.
- Budgets per world (SDK Builder's checks): about **1,000,000 triangles** and
  **1,024 MB of texture memory** at most; textures at most **2048 px** and
  compressed on Android; audio over 10 s not kept uncompressed. Use the
  Builder's **Analyze bundle** to see what makes a world big.
- Bake lighting; at most 4 extra lights per object on Quest.

---

## 9. Story quests

### 9.1 How quests work (built)

- A quest is a list of **steps done in order**: *talk* to an NPC, *visit* a
  place, or *kill* N of an enemy. When all steps are done, hand it in to the
  giver (or the named NPC) for XP and gold.
- Quests unlock in a chain (`requires`) and by level (`minLevel`). Up to 10
  active; the HUD shows 3.
- **NPCs:** click one. It hands in a finished quest first, then counts a
  "talk to me" step, then offers its next quest. Over its head: **!** has a
  quest, **?** waiting for a hand-in, **…** wants to talk.

### 9.2 The chain [NEW names and steps; rewards unchanged]

Same rewards as the v0.1 chain (3,400 XP and 320 gold in all). This table is
exactly what goes into `shared/rules.js`.

| Id | Quest | Giver → hand in | Min lv | Requires | Steps | Reward |
|---|---|---|---|---|---|---|
| q01 | Black Bramble | Bren → Bren | 1 | – | kill `thorn-slime` ×1 (the bramble burn is the tutorial bounty `b-yard-bramble`) | 50 XP, 5 g |
| q02 | Choked Hedgerows | Mara → Mara | 1 | q01 | kill `thorn-slime` ×5 | 100 XP, 10 g |
| q03 | The Hunter's Camp | Mara → Tavi | 2 | q02 | visit `hunter-camp`, talk `tavi` | 80 XP, 5 g |
| q04 | Rotfang Pack | Tavi → Tavi | 2 | q03 | kill `rotfang-wolf` ×6 | 220 XP, 20 g |
| q05 | Into the Hollow | Tavi → Ryn | 3 | q04 | visit `glowcap-hollow`, talk `ryn` | 150 XP, 10 g |
| q06 | Growth Jam | Ryn → Ryn | 4 | q05 | kill `goblin-sapper` ×6 (hand-in text: a shipping tag from the *Dead Man's Dangle*) | 400 XP, 35 g |
| q07 | The Old Keep | Ryn → Mara | 5 | q06 | visit `hollowmoor` | 250 XP, 15 g |
| q08 | Restless Garrison | Mara → Mara | 6 | q07 | kill `skeleton` ×5, kill `hollow-knight` ×3 | 650 XP, 50 g |
| q09 | Varn's Watch | Mara → Mara | 6 | q08 | kill `varn` ×1 (hand-in text: the roots in his tomb run toward the island) | 300 XP, 20 g |
| q10 | The Thornheart | Mara → Mara | 8 | q09 | visit `tideglass-isle`, visit `wreck`, kill `grubnak` ×1 | 1,200 XP, 150 g |

NPC ids: `bren`, `mara`, `herbalist`, `harbour-master`, `tavi`, `ryn`.

---

## 10. The Thorn Writ and bounties [NEW]

### 10.1 The Thorn Writ

Each player holds one writ. It's **limited authority**: the lands it covers
decide where the player may take bounties and board the ferry.

| Writ covers | Granted when | In the story |
|---|---|---|
| Meadowmere Glade | q01 done | Captain Bren signs the first writ |
| Glowcap Hollow | level 3 | Elder Mara extends it |
| Hollowmoor Ruins | level 5 | Elder Mara (the keep is the old lord's land) |
| Tideglass Isle | level 8 | Elder Mara; the harbour master checks it at the ferry |

The writ isn't stored: the server **works it out** from level and finished
quests, so it can't drift out of step.

### 10.2 Bounties

- **The board:** in Brightwater's square. Each zone shows **3 bounties** at a
  time from that zone's list.
- **Rotation:** every **30 minutes** on the shared clock. The three shown are
  picked from the time window number (`floor(UTC minutes / 30)`), hashed with
  the zone id, so every page and the server agree without talking.
- **Holding:** up to **3** at once, only in lands the writ covers. A held
  bounty stays valid until finished or **2 hours** after it was taken.
- **Many players, same bounty:** allowed. Kills are still first-hitter owned,
  so players don't take each other's progress.
- **Reward:** XP and gold (below), and the zone's thorn level drops by 5.

| Id | Zone | Bounty | Counts | XP | Gold |
|---|---|---|---|---|---|
| `b-yard-bramble` | Yard | Burn the black bramble (tutorial, once) | burn ×1 | 20 | 2 |
| `b-glade-briars` | Glade | Burn briar patches | burn ×4 | 60 | 8 |
| `b-glade-wolves` | Glade | Cull rotfang wolves | kill `rotfang-wolf` ×5 | 90 | 10 |
| `b-glade-berries` | Glade | Bring blight berries to the herbalist | collect ×6 | 60 | 12 |
| `b-glade-slimes` | Glade | Clear thorn slimes off the road | kill `thorn-slime` ×8 | 60 | 8 |
| `b-hollow-caps` | Glowcap | Cut the thorn off great glowcaps | burn ×3 | 120 | 15 |
| `b-hollow-sappers` | Glowcap | Stop goblin sappers | kill `goblin-sapper` ×5 | 180 | 20 |
| `b-hollow-jam` | Glowcap | Recover jars of growth jam | collect ×4 (from sappers) | 140 | 18 |
| `b-hollow-sporelings` | Glowcap | Put down rotting Sporelings | kill `sporeling` ×6 | 160 | 16 |
| `b-ruins-bones` | Ruins | Put skeletons back to rest | kill `skeleton` ×6 | 260 | 28 |
| `b-ruins-knights` | Ruins | Defeat Hollow Knights | kill `hollow-knight` ×3 | 260 | 30 |
| `b-ruins-chapel` | Ruins | Burn the thorn out of the chapel | burn ×4 | 220 | 25 |
| `b-isle-crabs` | Isle | Clear tide crabs off the wreck | kill `tide-crab` ×6 | 360 | 40 |
| `b-isle-barrels` | Isle | Sink Grubnak's berry barrels | burn ×5 | 320 | 40 |
| `b-isle-thornheart` | Isle | Burn back the Thornheart | Thornheart credit | 300 | 60 |

**Burning:** briar patches, glowcap thorn and barrels are objects with a
**torch** interaction (grab the torch from your belt and touch the patch for
2 s; PC: hold E nearby). A burned patch shows ash and a green sprout, and
regrows after 5 minutes (it's shared: everyone sees it burned).

### 10.3 Thorn levels, Thorn Surges and the Thornheart

- **Thorn level** per zone, 0–100, **shared by every instance** (kept by the
  backend). It rises **1 point a minute**; each finished bounty lowers it by
  5; each burned patch by 1.
- **Thorn Surge:** when a zone reaches 100, the server opens a **15-minute
  surge** there. In every instance of that zone, a **thorn brute** and 6 of the
  zone's enemies spawn at the zone's surge point. Brutes are **open enemies**
  (anyone hits, everyone who hits is credited). When the surge ends, the
  level drops to 40.
- **The Thornheart:** wakes **on the hour** (shared clock) for 10 minutes, in
  every instance of the Isle. It's an **open enemy**. If it's beaten in any
  instance, every zone's thorn level drops by 30. Players need the Isle writ.
- Thorn level also changes the look: at 70+ the zone's thorn patches grow
  denser and the sky tints violet (a page-side switch between prepared
  object sets).

---

## 11. Unity build

The step-by-step build of the first scene (sword, knight enemy, player health)
is the [Unity guide](unity-first-scene.md). It is the pattern for every zone.

- **Versions:** Unity **6000.3.21f1** (URP template), Altspace Creator SDK
  (installer link in section 17), Visual Scripting **1.9.1** (the SDK's
  dependency), AI Navigation package.
- **Setup:** Creator SDK → Setup → **Fix All**, then **Generate nodes**.
  Layers and tags are picked **by name**: `UserLayer9` is slot 13, `UserTag1`
  is "Tag 0".
- **Layers used:** Default (ground), Grabbable (sword grip), **UserLayer9**
  (enemy hitboxes, the blade).
- **Enemies:** NavMeshAgent + Animator + trigger capsule + Script Machine
  (`EnemyGraph`). Animator parameters: `Speed` (float), `Attack` (trigger),
  `AttackIndex` (int 0–2), `Blocking` (bool), `BlockHit`, `Hit`, `Die`
  (triggers).
- **Player health:** `GameManager` graph; HUD bar attached to the head
  (Attached Object, Uid `me`).
- **Asset packs:** chosen with the guide's Part 1B checklist; recorded in
  [assets.md](assets.md); never committed.
- **Pictures of every graph:** in the guide; regenerated with
  `node tools/graph-diagrams/render.cjs`.

---

## 12. Technical design

### 12.1 Backend API

| Call | Does | Status |
|---|---|---|
| `GET /health` | `{ ok: true }` | Built |
| `GET /players/:uid?name=` | Loads the profile, creating it on the first visit | Built |
| `POST /players/:uid/events` `{ event, name }` | Applies one event through `rules.applyEvent`, saves it. 200 with profile and rewards; 409 with the reason and current profile when refused | Built |
| `GET /world` | `{ thorn: { zone: level }, surge: { zone, until } \| null, window, writ? }` for the board and surges | [NEW] |

**Events:**

| Event | Fields | Status |
|---|---|---|
| `kill` | `enemy` (and `spawn` for open enemies) | Built (`spawn` [NEW]) |
| `talk`, `visit`, `accept`, `turn-in`, `abandon`, `death` | as v0.1 | Built |
| `bounty-take` | `bounty` (must be on the board now or in the last window, inside the writ) | [NEW] |
| `bounty-turn-in` | `bounty` | [NEW] |
| `burn` | `patch` (object id) | [NEW] |
| `collect` | `item` (`blight-berry`, `growth-jam`) | [NEW] |

**Storage:** D1 table `players` (built: profile JSON + version for safe
concurrent saves). **[NEW]** table `zones` (`zone`, `thorn`, `updated_at`,
`surge_until`): the thorn level is stored with its last-update time and the
1-a-minute rise is worked out on read, so no timer runs on the server.

**CORS:** only `https://*.worldspace.host`. **Gold rolls** happen on the server.

### 12.2 What each page shares (inside one instance)

| Data | Where | Written by |
|---|---|---|
| Enemy position | Synced object `enemy-<id>` | Its owner's page |
| Enemy status, HP, owner | Public space state `enemy-<id>` | Whoever hits, kills or resets it |
| Open enemy damage and hitters [NEW] | Space state `open-<spawn>`: `{ hp, hitters: [uid…] }` | Each hitter merges their hit |
| Burned patches [NEW] | Space state `patch-<id>`: burned-until time | The player who burned it |
| Sword | Grabbable synced object | Whoever holds it |
| Profile, thorn levels, surges | The backend | The backend only |
| Health | The player's own graph | That player |

### 12.3 Bounty rotation [NEW]

`window = floor(Date.now() / 1_800_000)`; the zone's 3 bounties are the first
3 of its list after a seeded shuffle with seed `hash(zone + window)`. Same
function in `rules.js` on page and server, so no network call is needed to
show the board. The server accepts `bounty-take` for the current window and
the one before (clock differences).

### 12.4 Open enemies [NEW]

- The enemy is a synced object; **the instance's first player** (the owner of
  all synced objects by default) runs its AI graph.
- A hit is applied by the hitter's page: it merges `{ hp: hp − damage,
  hitters + uid }` into `open-<spawn>` with the JSON space-state calls.
- When `hp` reaches 0, every page that sees itself in `hitters` sends
  `kill { enemy, spawn }`. The server credits each uid **once per spawn id**.
- **[SPIKE] S9:** concurrent merges from several players on the same key (lost
  updates). Fallback: each hitter writes their own key `open-<spawn>-<uid>`
  with their total damage, and the AI page adds them up.

### 12.5 Offline mode

If the backend can't be reached, the HUD says **OFFLINE** and the same rules
run locally; nothing is saved. Bounties can't be taken offline. **[DECIDE]**
keep offline progress throwaway (recommended) or resync.

### 12.6 Cheating

The SDK gives no signed player token, so a modified client could fake
events. Limits:
- The server decides every reward from the rules; clients send events only.
- Quests in order, at the right level, once each. Bounties only from the
  current board, inside the writ, 3 held at most.
- **12 kills a minute** at most; **20 burns** and **30 collects** an hour per
  bounty type; open-enemy credit once per spawn.
- Guests turned away.

Acceptable for co-operative PVE with no trading. **Revisit before trading or
leaderboards.**

### 12.7 Performance

Quest is the limit: low-poly assets, baked lighting, compressed textures
(2048 px max), Vorbis audio. Keep each world well under the Builder's scene
budget and check it with **Analyze bundle**. Page code sends Unity messages
only for things that change.

---

## 13. Tunable settings

All in `shared/rules.js` unless noted.

| Setting | Default |
|---|---|
| Level cap | 10 |
| Min / full-damage swing speed | 1.5 / 3 m/s |
| Swing damage range | 75–150% |
| Hit cooldown (VR and PC) | 2 s |
| PC reach | 2.5 m |
| Health regen | after 6 s, 5% per second |
| Death gold loss | 10% |
| Enemy aggro / attack / leash range | 6 / 1.8 / 15 m (graph variables) |
| Enemy respawn | 15 s |
| Block chance / duration (shielded enemies) | 35% / 2 s (graph variables) |
| Kill rate limit | 12 per minute |
| Max active story quests | 10 |
| Ripe berry heal | 1 HP, regrows 60 s |
| Bounties shown per zone / held at once | 3 / 3 |
| Bounty rotation / held bounty expiry | 30 min / 2 h |
| Thorn level rise / per bounty / per burn | +1 a minute / −5 / −1 |
| Surge trigger / length / level after | 100 / 15 min / 40 |
| Thornheart | on the hour, 10 min, −30 thorn everywhere |
| Patch regrow | 5 min |

---

## 14. Spikes

| # | Question | Why it matters | Status |
|---|---|---|---|
| S1 | Can the published page call our backend (HTTPS + CORS)? | Saving at all | Test world built; confirm in the app |
| S2 | Do blade triggers hit enemy hitboxes, and is sword speed reliable? | Combat | Unity guide built for it; confirm in the headset |
| S3 | Does a synced enemy follow its owner smoothly for others? | Shared world | Test world; confirm with two players |
| S4 | Can graphs drive Animator and NavMeshAgent? | Enemy quality | **Answered: yes** (on the SDK allow list) |
| S5 | PC press-to-attack playable? | PC players | Test world |
| S6 | Does a held sword show in your hand for others? | Seeing fights | Confirm with two players |
| S7 | How many enemies can one page/graph drive before Quest frame rate drops? | Zone size | Partly (5 slimes) |
| S8 **[NEW]** | Cleanest bridge from graphs to the page (global events, space state, injected script) | Saving kills from graph-run enemies | Not started |
| S9 **[NEW]** | Several players merging hits into one space-state key | Open enemies | Not started |
| S10 **[NEW]** | Torch burn interaction and berry eating (grab + head trigger) | Bounties, berries | Not started |
| S11 **[NEW]** | Portals between zone worlds keep the backend session smooth | Several worlds | Not started |

---

## 15. Roadmap

| Phase | Goal | Output |
|---|---|---|
| 0. First scene | Build the [Unity guide](unity-first-scene.md): sword, knight, player health | S2, S4, S6 confirmed in the headset |
| 1. Rules update | Move section 6.5 enemies and 9.2 quests into `shared/rules.js`; new places and NPCs; tests | Backend speaks the new story |
| 2. Graph ↔ page bridge | S8; kills from graphs reach the backend; HUD | First zone saves progress |
| 3. Greybox coast | Brightwater, yard, glade (decide 8.4); terrain from the topography | Levels 1–3 playable |
| 4. Bounties and writ | Section 10.1–10.2: board, rotation, writ, burning, berries (S10) | The core loop |
| 5. Remaining zones | Glowcap, Ruins, Isle with their enemies and the full story chain | Levels 1–10 playable |
| 6. Shared moments | Open enemies (S9), thorn levels, surges, the Thornheart | MMO feel |
| 7. Art and polish | Asset packs, sounds, dialogue boards, potions and gold shop | Public beta |
| 8. Later | Spells (embercraft), more zones | v1.0 |

## 16. Open decisions

1. **One world or several** (8.4). Recommended: several.
2. **Gold's first use:** potions from the herbalist (recommended), then sword
   upgrades.
3. **Swing limits** beyond the 2 s cooldown: stamina? minimum arc?
4. **Dialogue:** click-through NPCs (now) or a dialogue board with buttons?
5. **Offline progress:** throwaway (recommended) or resync?
6. **Who owns the Cloudflare account** the backend runs on?

---

## 17. References

### 17.1 This project

| What | Where |
|---|---|
| Story write-up | [docs/story.md](story.md) |
| Coast map (zones, roads, story) | [docs/map.html](map.html) |
| Topography (heights, town close-up, cross-sections) | [docs/topography.html](topography.html) |
| Unity build guide (sword, knight, health; pictures of every graph) | [docs/unity-first-scene.md](unity-first-scene.md) |
| Asset packs used | [docs/assets.md](assets.md) |
| Game rules (levels, damage, enemies, quests) | [shared/rules.js](../shared/rules.js) |
| Backend (Worker, D1, setup and deploy) | [backend/README.md](../backend/README.md) |
| JavaScript test world | [world/README.md](../world/README.md) |
| Graph picture generator | [tools/graph-diagrams/](../tools/graph-diagrams/) |
| CI (tests, backend deploy from `main`) | [.github/workflows/ci.yml](../.github/workflows/ci.yml) |

### 17.2 Altspace Creator SDK

Docs: **https://altvr.app/docs/** (built from the `Docs` folder of
https://github.com/SideQuestVR/BanterSDK/tree/feature/greenfield/Docs). Pages
this design relies on, by their path in that folder:

| Page | Used for |
|---|---|
| `getting-started/installation.md` | Unity version, SDK installer |
| `getting-started/testing-in-play-mode.md` | What works in Play mode |
| `building-in-unity/builder.md` | Builder, scene stats, checklist, Analyze bundle |
| `building-in-unity/publishing.md` | Upload, size limits (300 MB world), private worlds |
| `building-in-unity/layers.md`, `building-in-unity/tags.md` | Layer and tag rules |
| `building-in-unity/easy-prefabs.md` | Grab presets, spawn points, Billboard |
| `javascript-api/saving-data.md` | Persistence: why we need a backend |
| `javascript-api/scene-api.md`, `javascript-api/scene-events.md` | Space state, one-shots, pose and key events |
| `javascript-api/scene-settings.md` | Guests, teleport, player settings |
| `javascript-api/user-multiplayer.md`, `multiplayer/overview.md` | Players, synced objects, ownership, shared time |
| `multiplayer/local-testing.md` | Testing several players in the editor |
| `components/physics.md`, `components/vr-interaction.md`, `components/rendering.md` | Colliders, grabbing, attached objects, Billboard |
| `browser/overview.md` | The page can call our own server |
| `visual-scripting/overview.md` | BS nodes, allow list, Coroutine |
| `reference/performance.md` | Budgets, textures, audio, lighting, Bundle Analyzer |
| `reference/troubleshooting.md` | No C# in builds, included Unity packages |

SDK source (same repository) checked for details the docs don't spell out:

| File | Used for |
|---|---|
| `Editor/Scripts/VisualScripting/VsStubsAllowed.cs` | The Visual Scripting allow list |
| `VisualScripting/Events/OnBanterTriggerEnter.cs` | On BS Trigger Enter outputs |
| `VisualScripting/User/GetUserState.cs`, `VisualScripting/User/TeleportTo.cs` | Local User State (head position), Teleport To Location ports |
| `VisualScripting/Utils/SendGlobalEvent.cs`, `VisualScripting/Events/OnGlobalEvent.cs` | Global events and their arguments |
| `Runtime/Scripts/Utils/SdkAttachments.cs` | Attached Object Uid must be `me` |
| `Runtime/Scripts/Character/Desktop/BSDesktopMouseHand.cs` | Grabbing uses a joint (sword must not be kinematic) |
| `Editor/CreatorConveniencesMenu.cs` | Exact GameObject → BS menu items |

Also: SDK installer
https://altvr.app/files/Install-com.sidequest.creator-sdk-latest.unitypackage;
world settings (capacity, who can join, guests) on each world's page at
https://altvr.app.

### 17.3 Unity

Visual Scripting 1.9 manual,
https://docs.unity3d.com/Packages/com.unity.visualscripting@1.9/manual/ :
`vs-nodes.html` (ports, inline values), `vs-events-reference.html` (On Start,
On Update, custom events), `vs-add-custom-event-node.html` and
`vs-add-custom-event-node-trigger.html`, `vs-variables-reference.html` and
`vs-add-variable-graph.html` (Object variables), `vs-control.html` (If,
Switch On String), `vs-time.html` (Wait For Seconds, Coroutine),
`vs-types.html`, `vs-add-node-to-graph.html`.

AI Navigation 2.0 manual,
https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/manual/ :
`NavMeshSurface.html` (bake, Include Layers), `NavMeshAgent.html`.

Unity 6000.3 manual and scripting reference (https://docs.unity.com/en-us/engine/6000.3/):

| Topic | Page |
|---|---|
| Animator transitions (Has Exit Time, conditions, Any State) | `manual/animation-section/animation-mecanim/animation-animator-controller/animation-state-machines/class-transition` |
| States and default state | `manual/animation-section/animation-mecanim/animation-animator-controller/animation-state-machines/class-state` |
| Animator parameters | `manual/animation-section/animation-mecanim/animation-animator-controller/animation-state-machines/animation-parameters` |
| Animator component (Apply Root Motion) | `manual/animation-section/animation-mecanim/class-animator` |
| Model import: Rig tab | `manual/assets-and-media/asset-types/models/importing/fbximporter-rig` |
| Model import: Animation tab (Loop Time, Bake Into Pose) | `manual/assets-and-media/asset-types/models/importing/class-animation-clip` |
| Model import: Model tab (Scale Factor, Mesh Compression) | `manual/assets-and-media/asset-types/models/importing/fbximporter-model` |
| Render Pipeline Converter | `manual/render-pipelines/universal-render-pipeline/introduction/installing-and-configuring-urp/upgrading-from-birp/rp-converter` |
| Trigger and collision events | `manual/physics-section/physics-overview/collision-section/collider-interactions/other-events` |
| Which collider pairs send events | `manual/physics-section/physics-overview/collision-section/collider-interactions/collider-types-interaction` |
| `Rigidbody.isKinematic`, `Rigidbody.linearVelocity` | `script-reference/unityengine/rigidbody/iskinematic`, `.../linearvelocity` |
| `Animator.ResetTrigger`, `Animator.Play`, `NavMeshAgent.Warp`, `Random.Range` | `script-reference/unityengine/animator/resettrigger`; for the others, https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Animator.Play.html, `AI.NavMeshAgent.Warp.html`, `Random.Range.html` (they redirect to the new site) |

### 17.4 Backend and tools

| What | Where |
|---|---|
| Cloudflare Workers | https://developers.cloudflare.com/workers/ |
| Cloudflare D1 (database) | https://developers.cloudflare.com/d1/ |
| Wrangler (deploy tool; pinned to 4.151.1 in `backend/package.json`) | https://developers.cloudflare.com/workers/wrangler/ |
| Node.js 22 (tests: `npm test`) | https://nodejs.org/ |
| Unity Asset Store (asset packs) | https://assetstore.unity.com/ |
| Mixamo (free humanoid animations; check its terms) | https://www.mixamo.com/ |
