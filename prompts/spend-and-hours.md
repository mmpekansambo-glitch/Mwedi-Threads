# Total spend and hours: prompts and decisions

Issue #99. Built with Claude Code in a cloud session from my Mwedi Threads project (threads "Track total spend on projects" and "Log hours spent on projects").

## Prompts I gave

1. "Let's include a total spend input for projects."
2. "Add an official hour tracker to the projects. So when you finish the project you log the total number of hours spent as an option."
3. Spend choices: "1A 2A 3B 4C 5A".
4. Hours choices: "1A, 2A, 3B, 4A, 5B".

## Decisions

- **Studios:** both the Yarn studio and the Sewing room.
- **When:** total spend is a tap-to-open row on the project page, editable any time, not only once finished.
- **Currency:** a choice in Settings (13 currencies, US dollar by default). Changing it relabels amounts; it doesn't convert them.
- **Overview:** no spend card for now; spend shows on the project page only.
- **Hours:** both studios, in half-hour steps (a whole-hours wheel plus a "+ ½" wheel). The Hours row shows only on finished projects. No Overview card or hours on project cards.
- **Finish-up prompt:** when a project is marked finished, one "Finish up" card asks for hours and total spend together. Each row is optional; Done closes it. It doesn't come back when an already-finished project is opened.
- Built together in one PR (#102), with one database sync.
