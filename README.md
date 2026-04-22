# CouchQuest

CouchQuest is a no-build browser prototype for a two-controller couch co-op game:

- `Player 1` controls the hero in a top-down action adventure.
- `Player 2` is the dungeon director and can place enemies, rocks, hazards, and challenge waves on cooldowns.
- Every run rolls a fresh procedural map.

## Run it

Because the project uses ES modules and the Gamepad API, serve it over HTTP instead of opening `index.html` directly from disk.

One simple option on Windows if Python is installed:

```powershell
py -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

## Current controls

Hero controller:

- `Left Stick` move
- `Right Stick` aim
- `A` dash
- `X` or `RB` sword sweep
- `B` or `LB` pulse burst

Director controller:

- `Left Stick` move the cursor
- `A` spawn a goblin
- `X` place a rock
- `B` drop a hazard field
- `Y` start a challenge wave

Menu:

- `A` start
- `X` swap which controller is the hero or the director
- `Roll New Map Preview` generates a fresh procedural preview before the run starts
