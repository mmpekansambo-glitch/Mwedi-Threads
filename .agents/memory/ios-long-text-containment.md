---
name: iOS long-text containment
description: Keep long preview titles and saved link labels inside native iOS layouts.
---

In the native app, line limits and ellipsizing alone may still let long text extend horizontally. Constrain the containing card or row and the text itself with explicit width bounds, shrinking, and overflow clipping.

**Why:** A designer page title still overflowed on iPhone after title cleanup; the user confirmed it fit after the text and parent layout were bounded.

**How to apply:** Use this for long page-title previews and detail links in the mobile UI, and confirm on an iPhone when possible.
