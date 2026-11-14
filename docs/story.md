# Story: The Black Thorn Blight

> Status: **chosen, draft v1.** The visual map of the coast, with this story
> on it: [docs/map.html](map.html), and its heights (contours, a close-up of
> Brightwater and cross-sections): [docs/topography.html](topography.html).
> Open them in a browser. The numbers for everything here (quest steps,
> enemy stats, bounties, thorn levels) are in
> [game-design.md](game-design.md) sections 6–10.

## The short version

Brightwater used to be a **minor shipping town**: timber and salt fish down
the coast, and a stop for bigger ships passing by.

A few years ago the cargo ship *Dead Man's Dangle* wrecked on Tideglass Isle. Her
cargo was **blackberry cuttings**, bound for a farm further down the coast. The crates broke open on the rocks and the cuttings took root.
**Nobody knew blackberries would grow so well here.**

At first it was a blessing. Brambles spread from the island to the mainland,
the town's herbalist found the berries make **health potions**, and Brightwater
turned from a minor shipping town into a potion town. Farmers planted
hedgerows at Meadowmere.

Then the brambles kept growing. Now **black thorn** is pushing up through the
woods all along the coast: briars that grow overnight, berries gone glossy black with a violet glow, and
animals that eat them turning savage. Brightwater can't clear it alone, so the
town council grants sellswords a **Thorn Writ**: a contract giving them
**limited authority** to act on the town's behalf. Every player holds one.

It's small and local on purpose: a shipwreck, a greedy goblin and a plant that
grows too well. Nothing world-ending.

## Why it works for an MMO

- **Nobody is the one hero.** Everyone is a sellsword holding the same kind of
  writ.
- **The thorn grows back.** That explains respawning enemies, bounties that
  return and a boss that comes back every hour.
- **No group to join.** The council grants you authority; it doesn't recruit
  you into anything. There's no order, guild or party. Players work alone and
  run into each other because their writs send them to the same places.

## Places

| # | Zone | Levels | What the thorn has done |
|---|---|---|---|
| 0 | **Squire's Yard** (tutorial) | 1 | Captain Bren trains new sellswords in a clearing south of town. Mid-drill, a slime crawls out of a black bramble with berries stuck in it. Burn that bramble and Bren signs your first Thorn Writ |
| 1 | **Brightwater** (city) | hub | Elder Mara and the council grant and extend Thorn Writs from the hall, and post bounties in the square. The herbalist brews ripe berries into health potions and burns blight berries |
| 2 | **Meadowmere Glade** | 1–3 | Black thorn is choking the farm hedgerows. Wolves that eat blight berries become rotfang wolves |
| 3 | **Glowcap Hollow** (mushroom forest) | 3–5 | Thorn vines strangle the glowcaps; Sporelings rot where they're wrapped. Goblin sappers harvest blight berries to sell as "growth jam" |
| 4 | **Hollowmoor Ruins** | 5–7 | Thorn roots crack the old graves and the Hollow Knights rise, led by their old captain, Varn. The roots in his tomb all run north, toward the sea and the island |
| 5 | **Tideglass Isle** (ferry, level 8) | 8–10 | The Thornheart, a black bramble the size of a hill, grows where the wreck's cuttings first took root: the oldest and biggest bramble on the coast. Grubnak the Sapper's goblins farm its berries |

The thorn's roots run **under the water** from the island to the coast, which
is why it comes up from the ground, first along the shore.

## Berries

The blackberry is the heart of the look and of a few mechanics:

- **Ripe blackberries** grow on healthy hedgerows (the farm glade, the training
  yard fence). Eating one (bring it to your mouth in VR; click it on PC) heals
  **almost nothing**: 1 HP, a little VR moment rather than a real heal.
- **Health potions are made from them.** In the lore, every health potion on
  the coast is brewed by the herbalist from ripe blackberries, which is why the
  thorn choking the hedgerows matters to the town. Potions are the real heal
  (an item for later, once there's an inventory and gold).
- **Blight berries** are glossy black with a violet glow. Eating one is a bad
  idea (a short "sick" effect). Collect them instead: the herbalist pays for
  them so she can burn them, and many bounties ask for them.
- **Why the animals turn:** wolves and goblins eat blight berries. Goblins
  bottle them as "growth jam".
- **The Thornheart's berries** are the size of a fist: a boss drop.

## The Thorn Writ (limited contracts)

Each sellsword holds a **Thorn Writ** from Brightwater's council: a contract
granting **limited authority** to act on the town's behalf. There's **no group
or order to join**: the council lends you its authority; it doesn't recruit
you.

**What the writ allows:**

- Bear arms in the woods and on the coast roads.
- Burn black thorn on other people's land (farms, the old lord's keep).
- Claim the town's bounties.

**What makes it limited:** it only covers the lands it names. Prove yourself
and the council extends it. This gives the zone order a reason in the story:

| Writ covers | Granted | By |
|---|---|---|
| Meadowmere Glade | After the tutorial (level 1) | Captain Bren signs the first writ |
| Glowcap Hollow | Level 3 | Elder Mara, at the council hall |
| Hollowmoor Ruins | Level 5 | Elder Mara. The keep is the old lord's land, so the council's say-so matters there |
| Tideglass Isle | Level 8 | Elder Mara. The harbour master checks your writ before letting you on the ferry |

In the game these line up with the zone level ranges and the story quests that
already gate the zones; the writ is the in-story reason for the gate.

### Bounties

Work under the writ comes from the **bounty board** in Brightwater's square:

- **Limited time:** each zone shows a few bounties at a time. They rotate every
  **30 minutes** on the SDK's shared clock, so everyone sees the same ones.
- **Taken alone:** a player holds up to **three** at once, only in lands their
  writ covers.
- **Shared by accident:** many players can hold the same bounty at once, so
  people meet clearing the same briar patch. They help each other just by
  being there.
- **Push the thorn back:** every finished bounty lowers that zone's **thorn
  level** (shown on the board).

Sample bounties:

| Zone | Bounties |
|---|---|
| Squire's Yard | Burn the black bramble in the yard (tutorial) |
| Meadowmere Glade | Burn 4 briar patches · Cull 5 rotfang wolves · Bring 6 blight berries to the herbalist |
| Glowcap Hollow | Cut the thorn off 3 great glowcaps · Stop 5 goblin sappers · Recover a jar of goblin "growth jam" |
| Hollowmoor Ruins | Put 6 skeletons back to rest · Defeat 3 Hollow Knights · Burn the thorn out of the chapel |
| Tideglass Isle | Burn back the Thornheart (hourly) · Sink Grubnak's berry barrels · Clear the tide crabs off the wreck |

### Thorn Surges and the Thornheart

No party is ever needed for these; anyone whose writ covers the zone joins in
by turning up.

- **Thorn Surge:** when a zone's thorn level gets too high, a surge bounty
  appears there: a **thorn brute** (an elite version of the zone's enemy) and a
  wave of creatures. Everyone who hits the brute gets paid.
- **The Thornheart:** once an hour, a bounty opens on the island to **burn
  back the Thornheart**. Succeed and the thorn level drops in every zone for a
  while, which even players who weren't there notice. Then it grows back.

## Story quests (solo)

Alongside bounties, a short story chain takes each player through every zone.
It follows the same talk / visit / kill shape as the 10 quests already in
`shared/rules.js`, renamed:

| # | Quest | Zone | What you do | Level |
|---|---|---|---|---|
| q01 | Black Bramble | Squire's Yard | Kill the thorn slime, burn the bramble, report to Bren; he signs your first writ | 1 |
| q02 | Choked Hedgerows | Meadowmere Glade | Kill 5 thorn slimes | 1 |
| q03 | The Hunter's Camp | Meadowmere Glade | Find Tavi's camp; she says the wolves have turned | 2 |
| q04 | Rotfang Pack | Meadowmere Glade | Kill 6 rotfang wolves | 2 |
| q05 | Into the Hollow | Glowcap Hollow | Reach Scout Ryn's lookout | 3 |
| q06 | Growth Jam | Glowcap Hollow | Kill 6 goblin sappers; find a shipping tag from the *Dead Man's Dangle* in their packs (the first clue) | 4 |
| q07 | The Old Keep | Hollowmoor Ruins | Follow the thorn roots to the ruins | 5 |
| q08 | Restless Garrison | Hollowmoor Ruins | Defeat 8 skeletons and Hollow Knights | 6 |
| q09 | Varn's Watch | Ruins → city | Defeat Knight-Captain Varn; the roots in his tomb all run toward the island. Tell Mara | 6 |
| q10 | The Thornheart | Tideglass Isle | Take the ferry, find the *Dead Man's Dangle*, defeat Grubnak | 8–10 |

Grubnak and Varn work like today's enemies (whoever hits first owns the
fight), so the whole chain can be done alone.

## Characters

| Who | Where | Role |
|---|---|---|
| Elder Mara | Council hall, Brightwater | Grants and extends Thorn Writs; gives the main story quests |
| Captain Bren | Squire's Yard | Trains new sellswords; signs the first writ |
| The herbalist | Brightwater | Brews health potions from ripe blackberries; buys and burns blight berries |
| The harbour master | Brightwater docks | Checks your writ covers the Isle before the ferry sails |
| Tavi the Hunter | Hunter's camp, Meadowmere Glade | First noticed the wolves changing |
| Scout Ryn | Lookout, Glowcap Hollow | Watching the goblins' berry trade |
| Knight-Captain Varn | Hollowmoor Ruins | Long-dead captain of the old keep, woken when thorn roots broke into his tomb |
| Grubnak the Sapper | Tideglass Isle | Goblin chief farming the Thornheart's berries |

## Enemies

| Enemy | Zone | Level | Notes |
|---|---|---|---|
| Thorn slime | Glade | 1 | Today's slime with thorns and berries stuck in it |
| Rotfang wolf | Glade | 3 | A wolf that ate blight berries |
| Sporeling | Glowcap | 3–4 | Half-rotted where the thorn wraps it; puffs spore clouds |
| Goblin sapper | Glowcap | 5 | Harvests blight berries |
| Skeleton | Ruins | 6–7 | |
| Hollow Knight | Ruins | 7 | The sword-and-shield knight from the Unity guide |
| Knight-Captain Varn | Ruins | 7 | Mini-boss |
| Tide crab | Isle | 8 | Thorn-barnacles; armoured from the front |
| Grubnak the Sapper | Isle | 9 | Boss, solo |
| The Thornheart | Isle | 10 | Hourly, open to everyone |
| Thorn brute | Any zone | zone + 1 | Thorn Surge elite, open to everyone |

## Later

- **Spells:** the town's alchemists find that fire burns black thorn best.
  Learning **embercraft** is a natural first spell school, and it fits the
  game's name.
- **Gold and potions:** bounty pay and berry sales give gold its first use:
  buying blackberry health potions from the herbalist, then sword upgrades.

## Technical notes

- **Enemies everyone can hit:** thorn brutes and the Thornheart need a new
  enemy mode. Today only the first player to hit an enemy can damage it (design
  doc 6.3). Shared enemies need "anyone can hit, everyone who hits gets
  credit", with one player's page still running the AI.
- **Thorn levels and bounty rotation** are shared numbers. Inside one world
  instance, space state can hold them. Across instances, the backend keeps
  them (bounties as a new event type, thorn level per zone). The writ itself is
  per player: the lands it covers can be worked out from level and story
  quests already saved by the backend.
- **Eating a berry:** a grabbable berry with a trigger collider near the head
  (VR), or a click (PC). Heals 1 HP through the same player-health graph as
  the Unity guide's Part 5.
