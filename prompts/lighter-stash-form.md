# Lighter Add yarn form: prompts and decisions

Issue #111, branch `fix/lighter-stash-form`. Built with Claude Code in a cloud session from my Mwedi Threads project. This is the fix for reflection 2, the stranger test.

## What happened in the stranger test

My niece Temwani signed up and used the live app for 10 minutes. She paused on the project page when entering details, and again when adding yarn to her stash, where brand, sub brand, brand page link, photo, blend and skeins all showed at once.

## Prompts I gave

1. "I need to rethink how to manage the yarns options, i.e. Brand vs Sub-brand vs links vs pictures. The idea was that baking in all this information would help build a database that existing users were leveraging as well, but perhaps an AI integration to take a picture or quickly scan a ball of yarn, then auto populate the line items, and simply leave the user to cross-check instead."
2. On a decision card: "Lighter form plus scan issue": build the lighter form today and open an issue for the photo scan (#112).

## Decisions

- **Up front:** photo, brand, color, color family and weight.
- **Behind "More details":** sub brand, brand page link, blend, skeins purchased and skeins left. The row says what's inside so nothing feels hidden.
- **Opens on its own** when editing a yarn that already has any of those, or when one of them has an error.
- **Web and phone**, no database change, just pull and publish.
- **Photo scan** with AI is the longer-term answer, tracked in #112 and not built yet.
