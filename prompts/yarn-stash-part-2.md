# Yarn Stash part 2 and projects with several yarns: prompts and decisions

Issues #42 (part 2) and #45. Built with Claude Code in a cloud session from my Mwedi Threads project, as one pull request because linking project yarn to the stash has to work yarn by yarn.

## Prompts I gave

1. "Start on part two and combine with my new comment if it makes sense" (the new comment became issue #45, projects with more than one yarn).
2. "Proceed with all the recommendations" for the eight questions below.
3. On a decision card: "Needs a photo" for yarn added to the stash from a project.

## Decisions

- **Several yarns per project:** a project lists up to 12 yarns, on web and mobile, in the new-project form, Edit details and the project page.
- **Same yarn in several colors:** one entry per color, so each color links to its own stash yarn. "Add another color of this yarn" copies the brand and sub brand.
- **Held together:** a yarn can be marked as held together with the yarn above it.
- **Labels:** no Main color or Contrast labels.
- **Skeins:** skeins used are recorded per yarn.
- **Dashboard yarn stats:** count every yarn in a project (for #31 when it's built). Search already matches any of a project's yarns.
- **Stash linking:** each yarn can be picked from the stash. Typing over it makes it a new yarn. A new yarn with a brand is matched to the stash, or added to it.
- **Yarn added from a project:** goes into the stash right away with a "Needs a photo" marker until a photo is added.
- **Skeins left:** when a project is marked finished (or a progress note reaches 100%), the app asks on the stash page and the project page whether to take the project's skeins off what's left. It's an in-app prompt, not a phone notification. A project only takes skeins off once, and reopening it withdraws a prompt still waiting.
- **Merge reviews:** a question-mark button beside a stash yarn's brand, sub brand and color asks for a review of how the catalog merged the name. A Name reviews page, only shown to the reviewer, lets them rename the catalog entry or keep it. The reviewer is set by email in the `CATALOG_REVIEWER_EMAILS` Replit secret.
- **Existing projects:** each project's old brand, type and color become the first yarn in its list the first time its owner's projects load.
