# Dark mode: prompts and decisions

Issue #62, branches `feature/mobile-dark-mode` and `feature/web-dark-mode`, PRs #65 and #67. Built with Claude Code in a cloud session (thread "Add dark mode to phone and web").

## Prompts I gave

1. Original ask: "Can we design a dark mode for the mobile app?"
2. Picked base B, Slate night, on the card.
3. "Any other color options beyond the soft granite green? Im all greened out"
4. "Mauve. Use in sewing room light mode as well"
5. "Can we apply this to the web page for the sewing room as well?"
6. "What would making a web dark mode entail?"
7. "Okay build a second pr fir web" and "Then build for both"
8. Picked "Per device" and "Deeper slate" on the cards.
9. "I don't like the sewing room dark mode" / "It's to bright"
10. Picked A, dusky mauve.

## Decisions

- **Base:** Slate night (dark Blue Slate) on phone and web.
- **Sewing room:** mauve instead of green, in light and dark mode, on web too. In dark mode it uses a dusky mauve (#7A6898) because the paler mauve was too bright.
- **When it turns on:** follows the phone (or computer) setting, plus a Match phone / Light / Dark choice in Settings, saved per device.
- **Web sidebar in dark mode:** a deeper slate instead of Evergreen.
- The landing and sign-in pages stay light.
- Two PRs (phone first, then web). No database change.
