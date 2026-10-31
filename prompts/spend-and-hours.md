# Total spend and hours: prompts and decisions

Issue #99. Built with Claude Code in a cloud session from my Mwedi Threads project (threads "Track total spend on projects" and "Log hours spent on projects").

## Prompts I gave

1. "Let's include a total spend input for projects."
2. "Add an official hour tracker to the projects. So when you finish the project you log the total number of hours spent as an option."
3. Spend choices: "1A 2A 3B 4C 5A".

## Decisions

- **Studios:** both the Yarn studio and the Sewing room.
- **When:** total spend is a tap-to-open row on the project page, editable any time, not only once finished.
- **Currency:** a choice in Settings (13 currencies, US dollar by default). Changing it relabels amounts; it doesn't convert them.
- **Overview:** no spend card for now; spend shows on the project page only.
- **Hours:** built together with spend, in one PR, with one optional finish-up prompt.
