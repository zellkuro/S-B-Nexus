# Test World

A small world for trying the riskiest parts of Swords and Spells Nexus before
building the real zone: saving to our backend, sword swings, shared enemies
and PC attacks. These are spikes S1–S3, S5 and S6 in
[the design doc](../docs/game-design.md#10-spikes-prototype-first).

The whole world is built by `WebRoot/script.js`, so the Unity scene stays
empty apart from the SDK.

## What's in it
| Thing | Where | What to test |
|---|---|---|
| Brightwater town square (30 × 30 m) | Spawn, at the origin | Arrive here; respawn here when you die |
| Elder Mara, Captain Bren | In the square, either side of the sign | Click them: quests q01 and q02 |
| Field with 5 slimes | North of town | Sword fights, ownership, respawns |
| Tavi the Hunter + Hunter's Camp area | Far end of the field | Quest q03's "visit" and "talk" steps (needs level 2) |
| Sword | Your right hand | Swing speed, hits |
| HUD | Under your view | Level, XP, gold, HP, quests, messages, OFFLINE |

## Setup
1. **Backend first** (optional): follow [backend/README.md](../backend/README.md),
   then put its address in `CONFIG.backendUrl` at the top of
   `WebRoot/script.js`. Without it the world still runs, in OFFLINE mode, and
   nothing is saved.
2. **Unity:** install Unity **6000.3.21f1** with Android and Windows build
   support, and create a project from the **Universal 3D** template.
3. **SDK:** import the
   [installer package](https://altvr.app/files/Install-com.sidequest.creator-sdk-latest.unitypackage),
   then press **Fix All** in the Setup panel. This also creates
   `Assets/WebRoot/index.html`.
4. **Page:** copy into the project's `Assets/WebRoot/`:
   - `world/WebRoot/index.html` (replacing the generated one)
   - `world/WebRoot/script.js`
   - `shared/rules.js`
5. **Scene:** an empty scene is fine. Keep one scene in the project.
6. **Publish:** open the Builder (`Creator SDK > Builder`), sign in, and use
   **Build & upload**. After changing only the scripts, **Upload HTML + JS** is
   enough.
7. **Turn guests away** on altvr.app: **Edit world → Who is turned away →
   Guests**. (The page also sets `EnableGuests: false`.)
8. **Test in the headset.** Most of this needs the app: synced objects, the
   attached sword, `pose-update`, haptics. Play mode shows the world but not
   the fights; the SDK's **Local Multiplayer** window
   helps for the ownership checks.

`npm test` at the repo root runs the page against a fake SDK, with the real
backend code behind it. It doesn't need Unity.

## Controls
| Action | VR | PC |
|---|---|---|
| Attack | Swing the sword (right hand) | F (nearest enemy within 2.5 m) |
| Talk / take quest / hand in | Point and click an NPC | Click an NPC |

## Test checklist

**S1: Saving**
- [ ] The HUD says Lv 1 with no OFFLINE warning.
- [ ] Take q01 from Elder Mara, talk to Bren, hand it in. Leave the world,
      come back: still done, gold still 5?
- [ ] Turn the backend off (wrong `backendUrl`): does the HUD say OFFLINE and
      the world still work?

**S2: Sword**
- [ ] Is the sword in your hand, pointing forward? If not, change
      `SWORD.attachPosition` / `SWORD.attachEuler` and record what worked.
- [ ] Gently touch a slime: "Swing harder!" and no damage?
- [ ] A normal swing hits. Does 1.5 m/s feel like the right minimum?
- [ ] Waggling fast: limited by the 0.45 s cooldown?

**S3 + S6: Shared enemies (two players)**
- [ ] Player A hits a slime: health bar shows "(yours)" for A and A's name for B?
- [ ] B hits A's slime: refused with "A is fighting that one"?
- [ ] Does the slime chase A smoothly on B's screen?
- [ ] A leaves the world mid-fight: does the slime reset within a few seconds?
- [ ] Can B see A's sword in A's hand?

**S5: PC**
- [ ] On desktop, walk to a slime and press F. Does it feel OK?

**Death**
- [ ] Stand still next to a slime until you die (about 30 s at level 1).
      Back in town, full health, 10% gold gone, slime reset?

**Record:** anything that broke, the sword offsets that worked, and how swing
speed felt.

## S4: check in Unity (no headset needed)
JavaScript can't drive Animator or NavMeshAgent directly. Find out whether
Visual Scripting can:
1. Add a Script Machine to any object with a graph that uses
   **Animator: Set Trigger** and **Nav Mesh Agent: Set Destination**.
2. Open the Builder and run the checklist.
3. If **Visual Scripting node support** reports those nodes as not allowed,
   they won't run in the app: enemies stay on straight-line movement with
   looping animations. Note the result in the design doc (section 9.5), then
   delete the test graph.

## Not verified yet
Written from the SDK docs without running it in the app. Check these first if
something looks wrong:
- **Sword placement:** the hand bone's axes aren't documented, so
  `SWORD.attachPosition` and `attachEuler` are a guess.
- **Trigger between two kinematic bodies:** the sword and the slimes both have
  kinematic Rigidbodies. Unity reports triggers between those, but the app's
  layer settings for UserLayer9/10 aren't documented. If hits never register,
  try moving the sword to the Default layer.
- **Text size and facing:** labels read from their -Z side, toward the spawn.
  Font sizes are guesses.
- **Enemy health bar** uses the `█` character; if the font lacks it, change
  `hpBar` to use `|` or `#`.
