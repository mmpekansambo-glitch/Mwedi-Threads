# App palette: prompts and decisions

Issue #13, branch `feature/app-palette`. Built with Claude Code in a cloud session from my Mwedi Threads project.

## Prompts I gave

1. Original ask: "Can we make sure there is pallette consistency throughout the app per the plan md and our conversations"
2. Background: "Lavender plus white cards"
3. Web sidebar: "Evergreen"
4. Status badges: "Pallette shades"

## Decisions

- **Palette:** every color now comes from PLAN.md section 6 (Lavender `#C5D1EB`, Powder Blue `#92AFD7`, Blue Slate `#5A7684`, Granite `#395B50`, Evergreen `#1F2F16`) or a lighter or darker shade of one of them. The old warm paper, plum and apricot are gone.
- **Background:** Lavender pages with white cards.
- **Web sidebar:** Evergreen with Lavender text. The selected item gets a Powder Blue edge.
- **Status badges:** Planning is Lavender, In progress is Powder Blue, Paused is a pale Blue Slate, and Completed is Granite with white text.
- **Stars:** Granite instead of gold, as PLAN.md says.
- **Selected filters:** Powder Blue, as PLAN.md says.
- **Readability:** Blue Slate is too light to read on Lavender in small text, so small text sitting straight on the page uses a deeper Blue Slate (`#425863`). This applies to page subtitles and breadcrumbs on web, and to all secondary text on mobile.
- **Kept red:** delete buttons, the delete confirmation and error messages stay red.
- **Also updated:** the Clerk sign-in box, the web logo and favicon, and the mobile splash background.
