# Jester's Maze editor

A web editor for the three dimensional mazes of the game server (`src/server/mazeserver.go`).
Its look and layout follow the Yopaca editor: app bar, navigation rail, toolbar of the view, inspector.

## Run

```
cd editor
npm start                # http://localhost:3065/, mazes in ../mazes
```

Node 18 or newer, no dependencies (`npm install` is not needed). Options:
`node server.js --port 3065 [mazes folder]`, or the environment variables `PORT`, `HOST`, `MAZES`.
The files in `public/` are read on every request: edit and reload.

## Maze module

- **Level editor** (left): one level from above, the level below faint behind it.
  Tools: Select (V), Carve (C), Wall (W), Erase (E), Stairs (S), Item (I).
  Page Up / Down changes the level, Shift+arrows toggle the passages of the selected cell, `?` lists all keys.
- **3D view** (middle): all levels stacked. Drag to turn, wheel to zoom, click a cell to go there.
- **Inspector** (right): passages, stairs and content of the selected cell, size of the maze, problems
  (no start or exit, exit not reachable, one-way passages, keys without gates ...).
- **SpaceMouse** (compass button in the header, Chrome / Edge via WebHID): roll turns the maze in the 3D view,
  twist rotates the picture, tilt tilts it, push / pull zooms, sliding moves it; with the 3D view off it moves and zooms the level grid.
  Left button: level below, right button: level above. The dialog shows the six axes live and has speed
  and invert settings. Connects automatically: a SpaceMouse allowed once opens at the start and when it is
  plugged in; before that, the first click in the editor opens the browser's device chooser (once - the
  browser lets a page ask only from a click).
- **Code** (rail): the maze as the Go literal for `mazeserver.go`, or as JSON.

## Format

Each cell is the code the server reads, `AABC`:

| char | meaning |
|------|---------|
| A | the paths on the level: `A` │, `B` ─, `C` ┼, `D` ┌, `E` ┐, `F` └, `G` ┘, `H` ┴, `I` ┬, `J` ┤, `K` ├, `L`/`M`/`N`/`O` dead end north/south/west/east, `X` none |
| A (2nd) | the stairs: `X` none, `U` up, `D` down, `B` both |
| B | type: 0 nothing, 1 start, 2 exit, 3 treasure, 4 lamp oil, 5 key, 6 gate, 7 riddle |
| C | number (a key opens the gate with the same number) |

Files are saved as `mazes/<name>.json` (`cells[level][row][column]`, row 0 is north, level 0 the lowest).
Import reads both the JSON and Go source with a `[][][]string` literal, e.g. `mazeserver.go` itself.
