# PI VR Games — Explore the World of PI

WebXR booth games for **Pico 4** (PICO Browser) — TNB Genco Digital & Data Booth, PIMS CoP Carnival 2026.

**Play:** open <https://adzimaziz.github.io/vr-game-pims/> in the PICO Browser, pick a game → **ENTER VR** → pull **both triggers**.
**Install:** in the PICO Browser use *Install* / *Add to library* (or the **INSTALL APP** button on the menu) — the app gets its own
icon and, once installed and opened online one time, keeps working **offline** at the booth (service worker cache).

| Game | Project | How to play |
|---|---|---|
| **Data Sorter** | Boiler Anomaly Detection | Tokens arrive on the beat of the music. Blue data → left saber, red anomaly → right saber. |
| **Coal Stack** | Coal Supply Chain Optimizer | Grab coal off the conveyor (grip/trigger), drop it in the slot of the same colour. 5 in a slot = bonus. |
| **Ship Dock Rush** | Coal Supply Chain Optimizer | Laser + trigger on a waiting ship, then on a free berth — before its laytime runs out (demurrage). |

All games: **B / Y** returns to the game menu · `?round=45` changes the round length · today's top 5 is kept in the headset.
Desktop test (no headset): Data Sorter `Space` / `F` / `J` · Coal Stack `Space` / `1` `2` `3` · Ship Dock Rush `Space` + mouse clicks.

Built with [three.js](https://threejs.org) (bundled in `lib/`). Background music: *tenaga-music* (beat map in `assets/beats.json`, made with `tools/beats.py`).
After changing any file, bump `VERSION` in `sw.js` so installed copies update.
