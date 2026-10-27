# Date wheels: prompts and decisions

Issue #20, branch `feature/date-wheels`, PR #21. Built with Claude Code in a cloud session (thread "Design refresh and font sizes").

## Prompts I gave

1. Original ask: "I want the Started date options to be a rollerdex style and not a type in style like the image. But make inputting an exact date optional."
2. "I like 1, but instead of "No Day" just make it an extended hyphen "-" or nothing at all."

## Decisions

- Three scroll wheels: month, day and year.
- The day wheel starts on "—", so month and year alone is enough. That saves the date with month precision.
- Used for all three dates: Started, Aiming for and Finished, on web and mobile.
- Also fixed a palette bug from PR #14: the Blue Slate colour wasn't being applied.
