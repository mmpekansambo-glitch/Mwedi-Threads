# One note open at a time and a sewing notes journal: prompts and decisions

Issue #84, branch `feature/one-note-at-a-time`. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Build stash, archive and notes fixes").

## Prompts I gave

1. (Decision card) Opening another note, or a new note, saves and closes the one being edited, with a "Changes saved" note.
2. "Yes it should have a notes journal."
3. "Build for the 6 open issues in git hub please"

## Decisions

- **One note at a time:** on a project page only one note can be open for editing. Opening another note, or the new-note form, saves the open note's changes first and closes it, and a short "Changes saved" signpost shows. A note with no changes just closes. If the changes can't be saved (for example the note was emptied), that note stays open with its message and nothing else opens.
- **Where:** Yarn studio progress journal and the new Sewing room notes journal, on desktop web, phone web and the mobile app. On the phone app, editing happens on its own screen, so a half-written new note is saved before another note opens.
- **Cancel still discards:** Cancel and Close note leave without saving, as before.
- **Sewing notes journal:** sewing projects get dated notes, newest first, with the same add, edit and delete as the yarn journal (⋯ bubble on web, swipe right to edit and left to delete on the phone, a confirm before deleting, and the date can be moved to another day). The single Notes field on a sewing project stays.
- **Database:** new table `sewing_project_entries` (notes and date only). Nothing is dropped.
