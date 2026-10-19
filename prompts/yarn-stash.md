# Yarn Stash: prompts and decisions

Issue #42. Built with Claude Code in a cloud session from my Mwedi Threads project. This is part 1 of 2: the stash tab and the shared catalog. Part 2 will link project yarn to the stash, suggest skeins left with push notifications, and add merge reviews.

## Prompts I gave

1. Original ask: "Can we create a new issue to add a new tab to the "Overview", "my project" collection titled "Yarn Stash". This will be a tab dedicated to cataloging all the yarn that a user has by brand, sub brand, color, type, and blend"
2. On GitHub: "Can we add in the ability for a photo submission?"
3. Images: no third-party images or scraping. "Combine 1 & 2": my own photo plus a brand link, and a shared yarn catalog that grows as makers add yarn.
4. Answers to the open questions in the issue (comment on #42), then follow-ups in the project thread.
5. Colors: "Yarn's real color names but include a color dot on the image that represents a general color list."
6. "Build please", and two PRs instead of one.

## Decisions

- **Tab:** "Yarn stash" comes after My projects, on web and mobile.
- **Each yarn:** brand (required), sub brand, color name, color family (shown as a dot on the photo), weight, blend, brand page link, skeins purchased and skeins left, and one required photo that becomes the yarn's icon.
- **Weight:** picked with a scroll wheel styled like the date wheels. The standard weights 0 Lace to 7 Jumbo.
- **Blend:** pick fibers from the known list (or type another one) and enter a whole percent for each. It must add up to 100%.
- **Shared catalog:** brands, sub brands (with blend and link) and color names (with color family) are shared, so the next maker picks instead of retyping. Photos stay private to each maker.
- **Duplicates and typos:** names that differ only in case, spaces or punctuation are merged automatically. A near miss shows "Did you mean …?" and the maker taps to accept.
- **Skeins left:** starts at skeins purchased, halves allowed, and can't be more than skeins purchased.
- **Search and filters:** search by brand, sub brand, color or fiber, and filter by weight and color family.
