# Phone: new look, layouts and opening (#120)

## What I asked for
Bring the redesign from the web (#118, #119) to the phone app: the Mist & moss
palette with Lydia violet for the Sewing room, EB Garamond headings, words-only
tabs, paper hills behind each room, project names in a craft font when there is
no photo, the open "board" layouts, and a short opening where a violet thread
draws an "M".

## Decisions (mine)
- No icons or drawings: the tab bar is words only, with a running-stitch
  underline on the tab you're on. The stat doodles and yarn-ball badge are gone.
- Craft fonts for name tiles: crochet Gluten / Pacifico, knitting Silkscreen /
  Rampart One, sewing Special Elite / Playfair Display italic.
- Overview stats and charts stay, lower down, under the greeting, notes and board.
- The opening plays once per launch, a tap skips it, and Reduce Motion skips it.

## What Claude built
- `constants/colors.ts`: new palette for light, dark and the Sewing room.
- `components/paper.tsx`: room backdrop, name tiles, pinned swatches, stitches,
  word filters, board tiles and the floating bar.
- `components/OpeningThread.tsx`: the opening animation.
- New Overview, Projects board and project pages for both rooms; shared buttons
  and chips now follow the room's color (`useRoomColors`).
