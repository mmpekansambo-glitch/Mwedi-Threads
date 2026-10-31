# Supplies list on sewing projects: prompts and decisions

Issue #98, branch `feature/supplies-list`. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Add supplies list to sewing projects").

## Prompts I gave

1. Original ask: "Add a project supplies list to the sewing project. One can add from the notions and tools list or add new stuff inclusive of fabric selection or adding a new fabric via this tab that is then edited and augmented to match the stash."
2. After seeing a phone mockup with four questions: "all recs"

## Decisions

- **One Supplies section** replaces the separate Fabric and Tools sections on the project form and project page, with Fabric and Notions and tools groups and one "Add supplies" button (fabric from my stash, notions and tools I have, new fabric, new notion or tool).
- **New fabric can be saved without a photo.** It shows "Needs a photo" in the Fabric stash, the same as yarn. The full stash form still asks for the print photo when it is edited there.
- **Short quick-add forms.** New fabric: type, amount, optional photo. New notion or tool: section, type, name. The rest is filled in later in the stash or Tools.
- **No "To buy" tick** for now: everything on the list is something the maker has.
- **No database change.** Fabric photos were already a list, so only the API rule changed (`photoLater` on new fabric).
