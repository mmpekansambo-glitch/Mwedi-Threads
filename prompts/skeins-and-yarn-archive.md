# Skeins left and the yarn Archive: prompts and decisions

Issues #80 and #82, branch `feature/skeins-and-yarn-archive`. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Build stash, archive and notes fixes").

## Prompts I gave

1. "Can we create a separate issue that denotes specifically as it relates to the yarn stash? When a user decides to update the number of purchased yarns, it automatically increases the number of yarns left by the difference."
2. "For the last request specifically, when they increase the number of yarn skeins purchased, the yarn left should automatically increase, with a gentle bubble suggesting or cross-checking if this edit suffices, to which the user can click on it to assent or adjust as they see fit."
3. "Think of it as a gentle nudge."
4. "If the yarns left = yarns purchased before the lowering then yes. If skeins left was smaller than yarns purchased then no."
5. "Unless the number of skeins left surpassess those of the new input of purchased."
6. "Also can we have an archive that sunsets yarns where the number of skeins left is 0 after a project?"
7. "1. Nudge 2. yes, with a signposting of the action 3. yes 4. yes"
8. "Plus if the user starts to input an existing yarn that was archived (that is all matches including the color name) then automatically update per the stash inputs and remove the stash from archive instead of duplicating. Then include a signpost of the action"
9. "Build for the 6 open issues in git hub please"

## Decisions

- **Buying more raises what's left:** raising skeins purchased raises skeins left by the difference, right in the form, with a calm note ("Skeins left is now 5 (was 3). Look right?"). The maker can tap "Looks right" or type their own number, which wins. The note never blocks Save.
- **Buying fewer:** skeins left only drops when it was equal to skeins purchased before, or when it would be more than the new number (then it matches it). Otherwise it stays.
- **Archive is a nudge, never automatic:** when a finished project's skeins-left prompt or a manual edit leaves a yarn at 0, a note asks "All used up. Move it to your Archive?". Moving it shows a signpost saying where to find it, with Undo.
- **Archive filter:** an Archive chip on the Yarn stash page (web and phone) shows archived yarn. An archived yarn's page has "Move back to stash".
- **Archived yarn still counts:** it stays linked to its projects, still feeds skeins-left prompts and the Overview.
- **No copies:** adding a yarn whose brand, sub brand and color all match an archived one (ignoring capitals, spaces and punctuation) brings that yarn back with the new details and a "Welcome back" signpost.
- **Database:** one new column, `stash_yarns.archived_at`.
