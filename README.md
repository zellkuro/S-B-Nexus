# Swords and Spells Nexus

A fantasy RPG for Altspace: solo PVE in a shared world, with sword combat,
quests and levels. Your progress is saved on our own server, so your character
follows you into every visit.

Status: **planning, first test world built**. See the
[design doc](docs/game-design.md).

## What's here
| Folder | What it is |
|---|---|
| [`docs/`](docs/game-design.md) | The design doc |
| [`shared/rules.js`](shared/rules.js) | Every game rule and number: levels, damage, enemies, quests. Used by the world and the backend |
| [`backend/`](backend/README.md) | Saves player progress. Cloudflare Worker + D1 database, JavaScript |
| [`world/`](world/README.md) | The test world: a town, quest givers, slimes, a sword and a HUD |

## Tests
```sh
npm test
```
Runs the rules, the backend API, and the world page against a fake SDK with
the real backend code behind it. Needs Node.js 22, no install.
