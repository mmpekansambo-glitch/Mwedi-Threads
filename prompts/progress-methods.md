# Progress tracking methods: prompts and decisions

Issue #17, branch `feature/progress-methods`, PR #22. Built with Claude Code in a cloud session (thread "Design refresh and font sizes").

## Prompts I gave

1. "How exactly are people able to track the percentage of completeness of the project? What is the standard based off of the way the app is structured right now"
2. "Make an optional combination of one under the guise of a guest that is about how far along are you? So a user can choose how they want to track the project. whether it is rows or rounds, pattern sections, or skeins used."
3. "All your picks"

## Decisions

- Before this, the percentage was a number the maker typed in, with no standard behind it.
- Each project picks a method: "About how far along are you?" (the default), rows or rounds, pattern sections, or skeins used.
- The method is chosen on the new-project form and can be changed in Edit details.
- Pattern sections all count the same (3 of 4 ticked = 75%).
- Half skeins are allowed (2.5).
- Switching methods keeps the current percentage until the next note.
- The server works out the percentage. New columns: `progress_method`, `progress_total`, `progress_sections` on projects and `progress_value` on progress entries.
