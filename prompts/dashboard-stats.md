# Dashboard stats (most-used yarn brand, average days to finish): prompts and decisions

Issue #31, branch `feature/dashboard-stats`. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Check class assignment documents"). This PR also adds PLAN.md test 2.

## Prompts I gave

1. "Can we update the second test based on other things we have already built? Is there anything else that would suffice for the ask?"
2. Picked "Build most-used yarn brand" on the card, over testing the Finished count or the finished-per-month chart.
3. "All your picks"

## Decisions

- **Most-used yarn brand** follows PLAN.md section 4: it counts projects per brand, matches brands regardless of capitals (and spaces, the same way the yarn catalog does), and shows every tied brand A to Z, like "Big Twist & Lion Brand".
- A project counts once per brand, even when it uses several colors of that brand.
- **Average days to finish** was added too, so feature 11 has all three stats. It leaves out finished projects with no start date, and month-only dates count as the 1st.
- **Where:** a second row of cards under All projects, In progress and Finished, on web and the iPhone app.
- **Tapping the brand card** opens My projects searched for that brand. When brands tie, the card isn't a link, because there's no single brand to search.
