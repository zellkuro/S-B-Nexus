# Your First Scene: A Sword and an Enemy (Visual Scripting)

A step-by-step guide to building, in Unity with Visual Scripting only:

- a **sword** you can pick up and swing,
- an **enemy** that **wanders** around its home, **chases** you when you get
  close, **attacks**, and has a **health bar** over its head,
- **your health**, shown under your view, and a **respawn** in town when it
  runs out.

It's **solo first**: each player's copy of the world runs its own enemy.
Making it shared ("whoever hits first owns it", design doc 6.3) is the next
step, once this works.

No C#: published worlds don't run C# scripts. Everything here is Unity
components plus Visual Scripting graphs, using only nodes the app allows (the
SDK's allow list includes everything this guide uses).

> Numbers in this guide come from `shared/rules.js` (a level 1 player vs a
> Slime): enemy 30 HP, 4 damage every 1.6 s; you have 80 HP and your sword
> does 8 damage; **one swing counts every 2 s**.

---

## Part 0: What you'll end up with

```
Hierarchy
├── Ground                (a big flat plane, NavMesh baked on it)
├── Spawn Point           (where you arrive and respawn)
├── GameManager           (graph: your health, death, respawn)
├── PlayerHUD             (attached to your head: your health bar)
│   └── HUD Bar Pivot
│       └── HUD Bar Fill
├── Sword                 (grabbable)
│   ├── Grip              (where your hand holds it)
│   ├── Blade             (trigger collider, tag UserTag1)
│   └── (your sword model)
└── Enemy                 (graph: wander / chase / attack / hit / die)
    ├── (your enemy model, with its Animator)
    └── Health Bar        (turns to face you)
        ├── Bar Background
        └── Bar Pivot
            └── Bar Fill
```

How the pieces talk:

```
 Sword Blade ──touches──► Enemy (On BS Trigger Enter)
                            │  fast enough? 2 s since last hit? → lose 8 HP, update bar
                            │
 Enemy graph ──"PlayerHit" (4)──► GameManager graph
                                     │  lose 4 HP, update HUD
                                     │  at 0: teleport to Spawn Point, refill
                                     └──"PlayerDied"──► Enemy goes home
```

---

## Part 1: Project setup (once)

1. Install **Unity 6000.3.21f1** with **Android Build Support** and
   **Windows Build Support** (in Unity Hub: Installs → the version → Add
   modules).
2. Unity Hub → **New project** → **Universal 3D** template. Name it
   `SBN First Scene`.
3. Import the SDK: download the
   [installer package](https://altvr.app/files/Install-com.sidequest.creator-sdk-latest.unitypackage),
   double-click it with the project open, and click **Import**.
4. Open **Creator SDK → Setup**. Click **Fix All**. This sets up the layers
   and tags the app expects (including `UserLayer9` and `UserTag1`, used below).
5. In the same Setup panel, find **Visual Scripting nodes** and click
   **Generate nodes**. Wait for it to finish (it can take a minute or two).
6. Check the NavMesh package is installed: **Window → Package Manager** →
   top-left dropdown **Unity Registry** → search **AI Navigation**. If it says
   **Install**, click it.
7. **Import your Asset Store models**: **Window → Package Manager** → **My
   Assets** → find the sword pack and the enemy pack → **Download** →
   **Import**.

> **Tip:** keep only one scene in this project. The SDK publishes one scene
> per project.

---

## Part 2: Ground, spawn point and NavMesh

### 2.1 Ground
1. **GameObject → 3D Object → Plane**. Rename it `Ground` (select it, press
   F2).
2. In the **Inspector**, set **Transform → Scale** to `5, 1, 5` (a 50 × 50 m
   floor).
3. Leave its **Layer** on **Default** (players can stand and teleport on it).

### 2.2 Spawn point
1. **GameObject → BS → Player → Spawn Point**.
2. Set its **Position** to `0, 0, -10`. This is where you arrive and where you
   respawn when you die.

### 2.3 Bake the NavMesh (the walkable area for the enemy)
1. Select `Ground`. **Add Component** → search **NavMeshSurface** → add it.
2. On the NavMeshSurface component, click **Bake**.
3. You'll see a blue overlay on the ground in the Scene view. That's where the
   enemy can walk. If you add obstacles later (rocks, walls), click **Bake**
   again.

---

## Part 3: The sword

### 3.1 Start from the grab preset
1. **GameObject → BS → Grab → Cylinder (Stick)**. This makes a ready-to-grab
   object: a **Rigidbody** root (so it has physics and a speed we can measure),
   synced so others see it move, and a child **Stick** whose collider is the
   handle (held anywhere along its length, like a sword grip).
2. Rename the root `Sword`. Rename the child `Stick` to `Grip`.
3. Move the sword somewhere easy to reach, e.g. **Position** `0, 1, -8`
   (just in front of the spawn point, at waist height).
4. Select `Sword` and in its **Rigidbody**, tick **Is Kinematic** for now, so
   it floats there until you grab it instead of falling over. (Grabbing still
   works.) If you'd rather it lies on a table, leave it unticked and build a
   table under it.

### 3.2 Add your sword model
1. From your sword pack, drag the sword **prefab or model** onto `Sword` in
   the Hierarchy, so it becomes a child.
2. Set the model's **Position** to `0, 0, 0` and rotate/scale it so **the hilt
   sits on the Grip** (the thin cylinder) and **the blade points up** (along
   the Grip's Y axis, the green arrow).
3. If the model came with its own colliders, **remove them** (select each one,
   click the ⋮ on the collider component → **Remove Component**). We add our
   own.
4. Make the Grip invisible but keep it grabbable: select `Grip`, untick its
   **Mesh Renderer** (leave the **Capsule/Mesh Collider** and **BS Grab
   Handle** alone). Resize the Grip (its Scale Y) so it covers the hilt.

### 3.3 The blade: the part that hits
1. Right-click `Sword` → **Create Empty**. Rename it `Blade`.
2. **Add Component → Box Collider**. Tick **Is Trigger**. Set its **Size** and
   **Center** so the green box covers the blade of your model (look in the
   Scene view).
3. Set `Blade`'s **Layer** to **UserLayer9**. (Hands and teleport ignore it,
   so it won't get in the way of grabbing.) If Unity asks "change children?",
   choose **No, this object only**.
4. Set `Blade`'s **Tag** to **UserTag1**. That's how the enemy knows "this is
   a sword".

> Why a trigger? A trigger doesn't push things around; it only reports "I
> touched something". The sword's Rigidbody (on the root) makes Unity report
> the touch.

---

## Part 4: The enemy object

### 4.1 Root and model
1. **GameObject → Create Empty**. Rename it `Enemy`. **Position** `0, 0, 8`.
2. Drag your enemy **model prefab** onto `Enemy` so it's a child. Set the
   child's Position to `0, 0, 0` and make sure it faces **+Z** (the blue
   arrow). Rename the child `Model`.
3. If the model has its own colliders or a Rigidbody, **remove** them.

### 4.2 NavMeshAgent (walking)
1. Select `Enemy` → **Add Component → Nav Mesh Agent**.
2. Set **Speed** `1.2`, **Angular Speed** `360`, **Stopping Distance** `0.5`.
   Adjust **Radius** and **Height** so the agent's cylinder (Scene view)
   roughly fits the model.

### 4.3 Hitbox
1. Still on `Enemy` → **Add Component → Capsule Collider**.
2. Tick **Is Trigger**. Set **Center**, **Radius** and **Height** to cover the
   model's body.
3. Set `Enemy`'s **Layer** to **UserLayer9** (choose **Yes, change children**
   this time; it's fine for the model too).

### 4.4 Animator (your model's animations)
Your enemy pack should come with animation clips (idle, walk/run, attack, hit,
death). We drive them with **4 parameters**.

1. **Project window** → right-click in your own folder → **Create → Animator
   Controller**. Name it `EnemyController`.
2. Double-click it to open the **Animator** window.
3. In the **Parameters** tab (left), click **+** and add:
   - `Speed` (**Float**)
   - `Attack` (**Trigger**)
   - `Hit` (**Trigger**)
   - `Die` (**Trigger**)
4. Drag these clips from your pack into the Animator window: **Idle**,
   **Walk** (or Run), **Attack**, **Hit** (or "Get Hit"/"Damage"), **Death**.
   - Right-click **Idle** → **Set as Layer Default State** (it turns orange).
5. Make the transitions (right-click a state → **Make Transition** → click the
   target state). Select each arrow and set it up in the Inspector:

   | From → To | Has Exit Time | Condition |
   |---|---|---|
   | Idle → Walk | off | `Speed` Greater `0.1` |
   | Walk → Idle | off | `Speed` Less `0.1` |
   | **Any State** → Attack | off | `Attack` |
   | Attack → Idle | **on** (Exit Time `1`) | none |
   | **Any State** → Hit | off | `Hit` |
   | Hit → Idle | **on** (Exit Time `1`) | none |
   | **Any State** → Death | off | `Die` |

   For the three **Any State** arrows, untick **Can Transition To Self**.
   Death has no way out: it stays dead until we reset it.
6. Select `Model` (the child) → its **Animator** component (add one if it
   doesn't have it) → set **Controller** to `EnemyController`. **Untick Apply
   Root Motion** (the NavMeshAgent moves the enemy, not the animation).

> If your pack's walk animation slides or looks too fast/slow, change the
> NavMeshAgent **Speed** or the Walk state's **Speed** in the Animator.

### 4.5 Health bar
A bar made of two flat cubes. The green one shrinks from the left as health
drops.

1. Right-click `Enemy` → **Create Empty** → rename `Health Bar`. **Position**
   `0, 2.2, 0` (just above the head; adjust to your model's height).
2. With `Health Bar` selected: **Add Component** → search **BS Billboard** →
   add it. It turns the bar to face you. Untick **Enable X Axis** so it only
   turns sideways.
3. Right-click `Health Bar` → **3D Object → Cube** → rename `Bar Background`.
   Scale `1, 0.12, 0.02`. Remove its **Box Collider**. Make a dark grey
   material for it (Project → Create → Material, set Base Map colour, drag
   onto the cube).
4. Right-click `Health Bar` → **Create Empty** → rename `Bar Pivot`.
   **Position** `-0.5, 0, -0.015` (the left edge, just in front).
5. Right-click `Bar Pivot` → **3D Object → Cube** → rename `Bar Fill`.
   **Position** `0.5, 0, 0`, Scale `1, 0.1, 0.02`. Remove its **Box
   Collider**. Give it a green material.

Scaling `Bar Pivot` on X from 1 down to 0 now shrinks the green bar toward the
left edge. Try it in the Inspector, then set it back to `1, 1, 1`.

> If the bar shows its back to you in the headset, rotate `Bar Background` and
> `Bar Pivot` 180° on Y.

---

## Part 5: Your health (GameManager + HUD)

### 5.1 HUD bar under your view
1. **GameObject → Create Empty** → rename `PlayerHUD`.
2. **Add Component** → **BS Attached Object**. Set:
   - **Avatar Attachment Point**: `HEAD`
   - **Attachment Position**: `0, -0.25, 0.7` (a little below your eyeline)
   - **Auto Attach**: ticked
   - **Auto Sync**: unticked (only you see it)
3. Build the same bar as 4.5 inside it, but smaller: `HUD Bar Background`
   scale `0.3, 0.03, 0.005`; `HUD Bar Pivot` at `-0.15, 0, -0.004`;
   `HUD Bar Fill` at `0.15, 0, 0` (as a child of the pivot), scale
   `0.3, 0.025, 0.005`, red material. **Remove every Box Collider** (colliders
   on your head would bump into things).
   No Billboard here: it's already on your head.

### 5.2 GameManager object and its variables
1. **GameObject → Create Empty** → rename `GameManager`.
2. **Add Component → Script Machine**. Unity also adds a **Variables**
   component.
3. On **Script Machine**, set **Source** to **Graph** → click **New** → save
   it as `GameManagerGraph`.
4. In the **Variables** component, click **+** for each (name, type, value):

   | Name | Type | Value |
   |---|---|---|
   | `MaxHealth` | Float | `80` |
   | `Health` | Float | `80` |
   | `HudPivot` | Transform | drag `HUD Bar Pivot` in |
   | `SpawnPoint` | Transform | drag `Spawn Point` in |

### 5.3 Visual Scripting basics (read once)
- Click **Edit Graph** on the Script Machine to open the graph window.
- **Add a node:** right-click empty space → the **fuzzy finder** opens → type
  the name in **bold** below → click it.
- **Wires:** drag from an output port (right side) to an input port (left
  side). **Green arrows** are the order things happen in ("flow"); other
  colours carry values (numbers, positions, objects).
- **Variables:** in the fuzzy finder, type **Get Variable** or **Set
  Variable**, then pick **Object** as the kind and type the variable's name in
  the node's text box. (Shortcut: drag a variable from the **Blackboard**
  panel → Object tab, onto the graph.)
- **Numbers on ports:** click an unconnected input port's box to type a value.
- **Save** with Ctrl+S.

### 5.4 GameManagerGraph
Delete the default **On Start** / **On Update** nodes if you don't need them.

**A. Update the HUD bar (a reusable "Custom Event")**
1. **Custom Event** → name it `UpdateHud`.
2. **Divide** (Scalar) → A: Get Variable `Health`, B: Get Variable `MaxHealth`.
3. **Clamp 01** (Mathf) → input from Divide. (Keeps it between 0 and 1.)
4. **Vector 3: Create (X, Y, Z)** → X from Clamp 01, Y `1`, Z `1`.
5. **Transform: Set Local Scale** → its target (top input) from Get Variable
   `HudPivot`; value from the Vector 3. Flow: Custom Event → Set Local Scale.

**B. On start: fill up**
1. **On Start** → **Set Variable** `Health` (value: Get Variable `MaxHealth`)
   → **Trigger Custom Event** (name `UpdateHud`, target: **This**).

**C. Getting hit**
1. **On Global Event** (Events → BS → Utils). Click it; in the Graph
   Inspector set **Arguments** to `1`. Type `PlayerHit` in its name box.
2. **Subtract** (Scalar) → A: Get Variable `Health`, B: the event's
   `argument_0`.
3. **Set Variable** `Health` ← Subtract. Flow: On Global Event → Set Variable.
4. → **Trigger Custom Event** `UpdateHud` (target **This**).
5. → **If**: condition **Less Or Equal** (A: Get Variable `Health`, B: `0`).
6. If **True** →
   1. **Teleport To Location** (BS → User): **Position** ← **Transform: Get
      Position** of Get Variable `SpawnPoint`. Tick **Stop Velocity**.
   2. → **Set Variable** `Health` ← Get Variable `MaxHealth`.
   3. → **Trigger Custom Event** `UpdateHud`.
   4. → **Trigger Global Event** (BS → Utils), name `PlayerDied`, Arguments
      `0`.

That's your health done. Later, `PlayerDied` is also where the backend's
"death" event (lose 10% gold) will be sent.

---

## Part 6: The enemy's brain (EnemyGraph)

### 6.1 Script Machine and variables
1. Select `Enemy` → **Add Component → Script Machine** → Source **Graph** →
   **New** → save as `EnemyGraph`.
2. In its **Variables** component add:

   | Name | Type | Value | What it's for |
   |---|---|---|---|
   | `State` | String | `Wander` | Wander, Chase, Attack, Return or Dead |
   | `MaxHealth` | Float | `30` | |
   | `Health` | Float | `30` | |
   | `Home` | Vector 3 | (set at start) | Where it lives |
   | `WanderRadius` | Float | `5` | How far it strolls from home |
   | `AggroRange` | Float | `6` | Get this close and it chases you |
   | `AttackRange` | Float | `1.8` | Close enough to hit you |
   | `LeashRange` | Float | `15` | Chased this far from home → gives up |
   | `WalkSpeed` | Float | `1.2` | |
   | `RunSpeed` | Float | `3` | |
   | `Damage` | Float | `4` | Per attack |
   | `AttackEvery` | Float | `1.6` | Seconds between attacks |
   | `SwordDamage` | Float | `8` | Per hit you land |
   | `MinSwingSpeed` | Float | `1.5` | m/s: slower is a touch, not a hit |
   | `SwingCooldown` | Float | `2` | Only one hit counts every 2 s |
   | `RespawnSeconds` | Float | `15` | |
   | `NextWanderTime` | Float | `0` | (used by the graph) |
   | `LastAttackTime` | Float | `0` | (used by the graph) |
   | `LastHitTime` | Float | `-10` | (used by the graph) |
   | `Anim` | Animator | drag `Model` in | |
   | `BarPivot` | Transform | drag `Bar Pivot` in | |
   | `Model` | Game Object | drag `Model` in | |
   | `HealthBar` | Game Object | drag `Health Bar` in | |

> Nav Mesh Agent and Capsule Collider nodes work on **this** object by
> default (the Enemy), so they don't need variables.

The graph has six parts. Build them one at a time and test as you go
(Part 7). Use **Groups** (Ctrl+drag a box around nodes → name it) to keep
them tidy.

### 6.2 Part A: start and the health bar
1. **Custom Event** `UpdateBar` → same as the HUD (5.4 A) but with
   `Health`/`MaxHealth`/`BarPivot`.
2. **On Start** →
   **Set Variable** `Home` ← **Transform: Get Position** (target **This**) →
   **Set Variable** `Health` ← Get Variable `MaxHealth` →
   **Trigger Custom Event** `UpdateBar`.

### 6.3 Part B: every frame, look where the player is
1. **On Update** → **Switch On String**. Its input: Get Variable `State`. In
   the Graph Inspector add the options `Wander`, `Chase`, `Attack`, `Return`.
   (`Dead` isn't listed, so a dead enemy does nothing.)
2. Two values you'll reuse (make them once, wire them to several places):
   - **Player feet**: **Local User State** (BS → User) gives your head
     **Position**. Feed it into **Expose Vector 3** (gets x, y, z). Then
     **Vector 3: Create** with X = head x, Y = **this enemy's** position y
     (Transform: Get Position → Expose → y), Z = head z. Call this
     *PlayerFlat* (you can add a **Sticky Note** to label it).
   - **Distance to player**: **Vector 3: Distance** (A: PlayerFlat, B:
     Transform: Get Position of This).
3. Also on every frame, before the switch: **Animator: Set Float** (target:
   Get Variable `Anim`) name `Speed`, value **Nav Mesh Agent: Get Velocity** →
   **Vector 3: Get Magnitude**. Wire the flow: On Update → Set Float → Switch
   On String.

### 6.4 Part C: the four states
Wire each from its output on **Switch On String**.

**Wander**
1. **If**: Distance to player **Less** `AggroRange` →
   - True: **Set Variable** `State` = `Chase` → **Nav Mesh Agent: Set Speed**
     ← `RunSpeed`.
   - False: **If**: **Get Time** (Time: Time) **Greater** `NextWanderTime` →
     True:
     1. **Random: Inside Unit Circle** → **Expose Vector 2** (x, y).
     2. **Vector 3: Create**: X = x × `WanderRadius`, Y = `0`, Z = y ×
        `WanderRadius` (use **Multiply** nodes).
     3. **Add** (Vector 3) that to Get Variable `Home`.
     4. **Nav Mesh Agent: Set Destination** ← the result.
     5. **Nav Mesh Agent: Set Speed** ← `WalkSpeed`.
     6. **Set Variable** `NextWanderTime` = Get Time + **Random: Range**
        (`3`, `6`).

**Chase**
1. **Nav Mesh Agent: Set Destination** ← PlayerFlat.
2. → **If**: **Vector 3: Distance** (Transform position, Get Variable
   `Home`) **Greater** `LeashRange` → True: **Set Variable** `State` =
   `Return`. **Nav Mesh Agent: Set Destination** ← `Home`.
3. False → **If**: Distance to player **Less** `AttackRange` → True:
   **Set Variable** `State` = `Attack` → **Nav Mesh Agent: Reset Path**.

**Attack**
1. **Transform: Look At** (target **This**) ← PlayerFlat. (Turns to face you.)
2. → **If**: Distance to player **Greater** `AttackRange` + `0.5` → True:
   **Set Variable** `State` = `Chase`.
3. False → **If**: Get Time **Greater** `LastAttackTime` + `AttackEvery` →
   True:
   1. **Set Variable** `LastAttackTime` = Get Time.
   2. **Animator: Set Trigger** (target `Anim`) name `Attack`.
   3. **Trigger Global Event**, name `PlayerHit`, **Arguments** `1`,
      `argument_0` ← Get Variable `Damage`.

**Return**
1. **If**: **Vector 3: Distance** (Transform position, `Home`) **Less** `1` →
   True:
   1. **Set Variable** `Health` ← `MaxHealth` → **Trigger Custom Event**
      `UpdateBar`.
   2. **Set Variable** `State` = `Wander`.

### 6.5 Part D: getting hit by the sword
1. **On BS Trigger Enter** (Events → BS → Trigger). It fires when anything
   enters the Enemy's hitbox. Its **Collider** output is what touched it.
2. → **If**: **Collider: Compare Tag** (target: the Collider output) tag
   `UserTag1`. (Only the blade has this tag. Your body touching the enemy
   is ignored.)
3. True → **If**: Get Variable `State` **Not Equal** `Dead`.
4. True → **If**: Get Time **Greater** `LastHitTime` + `SwingCooldown`.
   (Only one hit counts every 2 s.)
5. True → **If**: swing speed **Greater Or Equal** `MinSwingSpeed`, where
   swing speed = Collider output → **Collider: Get Attached Rigidbody** →
   **Rigidbody: Get Linear Velocity** → **Vector 3: Get Magnitude**.
6. True →
   1. **Set Variable** `LastHitTime` = Get Time.
   2. **Set Variable** `Health` = `Health` − `SwordDamage`.
   3. **Trigger Custom Event** `UpdateBar`.
   4. **Animator: Set Trigger** (`Anim`) `Hit`.
   5. **If** `State` **Equal** `Wander` → True: **Set Variable** `State` =
      `Chase` (hitting it from behind makes it fight back).
   6. → **If** `Health` **Less Or Equal** `0` → True: **Trigger Custom
      Event** `Die`.

### 6.6 Part E: dying and coming back
1. **Custom Event** `Die`. Select it, and in the Graph Inspector tick
   **Coroutine** (this lets it wait).
2. → **Set Variable** `State` = `Dead`.
3. → **Nav Mesh Agent: Reset Path**.
4. → **Animator: Set Trigger** (`Anim`) `Die`.
5. → **Capsule Collider: Set Enabled** (target **This**) = false (can't be hit
   while dead).
6. → **Game Object: Set Active** (target `HealthBar`) = false.
7. → **Wait For Seconds** `2` (let the death animation play) → **Game
   Object: Set Active** (`Model`) = false.
8. → **Wait For Seconds** ← `RespawnSeconds`.
9. → **Nav Mesh Agent: Warp** ← Get Variable `Home`.
10. → **Set Variable** `Health` ← `MaxHealth` → **Trigger Custom Event**
    `UpdateBar`.
11. → **Game Object: Set Active** (`Model`) = true → (`HealthBar`) = true →
    **Capsule Collider: Set Enabled** = true.
12. → **Animator: Rebind** (target `Anim`) (back to Idle, out of the death
    pose).
13. → **Set Variable** `State` = `Wander`.

### 6.7 Part F: when you die, it goes home
1. **On Global Event**, name `PlayerDied`, Arguments `0`.
2. → **If**: `State` **Equal** `Chase` **Or** `State` **Equal** `Attack`
   (use **Equal** twice and an **Or**).
3. True → **Set Variable** `State` = `Return` → **Nav Mesh Agent: Set
   Destination** ← `Home`.

---

## Part 7: Test it

### 7.1 In Play mode (in the editor)
Press **Play**. The SDK gives you a desktop player (WASD to walk, mouse to
look, click to grab).

| Check | Expected |
|---|---|
| Enemy | Strolls around near its home, a new spot every 3–6 s, walk animation playing |
| Walk within 6 m | It turns and runs at you |
| Stand next to it | Attack animation every 1.6 s; your red HUD bar shrinks |
| Stand there ~30 s | You're teleported to the spawn point with full health; the enemy goes home |
| Run away 15 m from its home | It gives up and walks home, healing to full |
| Grab the sword and hit it | Works only with fast mouse moves. Real swings are a headset test |

**If nothing moves:** open **Window → Visual Scripting → Graph** while
playing and select `Enemy`. Active wires glow, so you can see which part runs.
Add **Debug: Log** nodes to print values to the Console.

### 7.2 Before publishing: the Builder check
1. **Creator SDK → Builder**. Sign in.
2. Look at the checklist. **Visual Scripting node support** must pass: it
   lists any node the app won't run. (Play mode doesn't check this, so a graph
   can work in the editor and not in the app.) Everything in this guide is on
   the allow list, but if you added something else, replace it.
3. Fix anything else the checklist flags (it has **Fix** buttons for most).
4. **Build & upload**.

### 7.3 In the headset
- [ ] Pick up the sword. Does it sit right in your hand? (If not, rotate the
      model under `Sword` in Unity.)
- [ ] Touch the enemy gently: no damage. Swing properly: health bar drops.
- [ ] Swing twice quickly: only the first counts (2 s).
- [ ] Does 1.5 m/s feel right as the minimum? (Change `MinSwingSpeed`.)
- [ ] Kill it: death animation, gone, back after 15 s.
- [ ] Let it beat you: back at the spawn point, full health.
- [ ] Is the HUD bar readable and not in the way? (Change the
      **Attachment Position** on `PlayerHUD`.)
- [ ] With a friend: each of you sees your own copy of the enemy (expected
      for now; see "Next steps").

---

## Part 8: Troubleshooting

| Problem | Try |
|---|---|
| Enemy doesn't move | NavMesh baked? (blue overlay on the ground.) Enemy placed on the blue area? Graph saved? |
| Enemy slides without animating | `Anim` variable points at the `Model`'s Animator? Parameter named exactly `Speed`? |
| Enemy floats or sinks | Change the NavMeshAgent's **Base Offset**, or the `Model` child's Y position |
| Sword hits never register | `Blade` has **Is Trigger** on, Tag **UserTag1**, and is a child of `Sword` (which has the Rigidbody)? Enemy's Capsule Collider **Is Trigger** on? Try moving `Blade` to the **Default** layer |
| Hits register even on gentle touches | Raise `MinSwingSpeed` |
| Health bar doesn't shrink | `BarPivot` variable points at `Bar Pivot` (not `Bar Fill`)? |
| Health bar is invisible in the headset | It's showing its back: rotate `Bar Background` and `Bar Pivot` 180° on Y |
| Works in Play mode, not in the app | The Builder's **Visual Scripting node support** check: a node isn't allowed. Also check the graph is saved and **Build & upload** ran |
| You don't respawn | `SpawnPoint` variable set on GameManager? On Global Event name is exactly `PlayerHit` / Arguments 1? |

---

## Next steps (after this works)

1. **Share the enemy between players** (design doc 6.3): make `Enemy` a **BS
   Synced Object** (with **Take Ownership On Collision** off), keep its health
   and state in **space state**, and only let the owner's copy run Parts B–C
   (check **Do I Own** first). The first player to land a hit calls **Take
   Ownership**.
2. **Connect to the backend** for XP, gold and quests: when the enemy dies,
   and when you die, tell the page (JavaScript) so it sends `kill` / `death`
   to the server. The test world's script already does this.
3. **PC press-to-attack (F)** stays: the page script already handles the F
   key; it will tell the enemy graph about a PC hit once step 2 connects them.
4. Swap the Slime numbers for each enemy type in `shared/rules.js` (Wolf,
   Goblin…), and turn the Enemy into a **prefab** so you can place many.
