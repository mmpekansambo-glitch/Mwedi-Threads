# Design cleanup: prompts and decisions

Issue #18, branch `feature/design-cleanup`, PR #19. Built with Claude Code in a cloud session (thread "Design refresh and font sizes").

## Prompts I gave

1. Asking about the sign-out icon: "What is the purpose of the export button in the bottom left corner where the sample work room note is?"
2. "Make the sign out into a menu that opens up when you tap your name. Add that to the next cleanup PR."
3. "Can we varigate the colors of the dashboard "all projects, In progress and finished banners such that they look disinct? Or add a doodle of some sort. to add some whimsical to the page?"
4. "Pick C"
5. "Change "designer to DEsign" and keep the "DEsigner Name" distinct? it is a bit confusing a the moment."

## Decisions

- Removed every small capital label, encouragement line and the quote card, on web and mobile.
- Project cards lost the ⌘ placeholder art and show real facts instead (status, craft, pattern, progress, yarn, last update).
- Buttons got gentler corners and no shadows.
- **Sign out** lives in a menu that opens when you tap your name (the avatar on mobile).
- **Dashboard cards:** option C, soft palette tints plus small doodles (yarn ball, hook, granny square).
- The form heading became "Design" with "Designer name" under it (later merged into one row in #24).
- "On the needles" was renamed "Planning" everywhere so the badge matches the filter.
