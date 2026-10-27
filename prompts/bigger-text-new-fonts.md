# Bigger text and new fonts: prompts and decisions

Issue #15, branch `feature/bigger-text-new-fonts`, PR #16. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Design refresh and font sizes").

## Prompts I gave

1. Original ask: "I would like to start updating the design of the app. I have an issue with a lot of the small font that exists throughout the application. Can we find a way to make it a little less Replit coated."
2. "Give me an image to demonstrate number 1" and "And 2"
3. "Is there a middle ground between pattern book and yarn shop?"
4. "Go with your pick for text size and use 2b recommendation."
5. On the template habits: "Separate PR"
6. "Can we get rid of the words "your collection" and every idea skein….yadayafaya!"
7. "Also get rid of the box on the left-hand side of the project journal that says keep notes. They become the story. Unnecessary features like that that add no value shouldn't be included. I want a clean slate looking app."

## Decisions

- **Text size:** option B. Nothing smaller than 13px, body text 16px. Before, most labels were 8 to 11px and the phone app went down to 8px.
- **Fonts:** Lora headings with Figtree text, replacing DM Sans with Fraunces (a very common pairing in generated apps).
- **Template habits** (tiny capital labels, card art, filler lines, pill buttons) moved to a separate cleanup PR (#19).
- **Clean slate rule:** no filler copy or boxes that add no value. "Your collection", the subtitle and the "Keep the little notes" sidebar box were removed in this PR.
