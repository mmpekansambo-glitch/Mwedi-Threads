# Sewing room: fabric left, Archive and tool fixes: prompts and decisions

Issue #83, branch `feature/sewing-stash-parity`. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Build stash, archive and notes fixes").

## Prompts I gave

1. "Let's make sure the issues we are fixing with the last thread applies to the sewing room as well!"
2. (Decision card) Fabric gets "amount bought" and "amount left".
3. "1. all factors align. Perhaps we could include a check to make sure that any submitted pictures entail a match in the print as well. If not photo submissions then fall back on the users inputs. Can we remove brand from the fabric piece. Also Unlike the yarn studio, don't track fabric in the same way. Let this database population be specific to each users, cause identifying fabric is significantly tougher than yarns which are distinct to brands in many a way. 2. sewing tools are merely a repository. Are they capable of being used up? What are some examples of tools that are on our list that may be used up?"
4. "yup" (Archive nudge for notions only, never kit)
5. "Build for the 6 open issues in git hub please"

## Decisions

- **Amount bought and amount left:** fabric now has both. Raising amount bought raises amount left by the difference, with the same gentle note as yarn skeins; buying less only lowers what's left when none was used or it would be more than bought. Cards show "1.5 of 3 m left".
- **Finished projects:** the existing "take the fabric you used off" prompt now takes it off amount left instead of changing what was bought.
- **Fabric Archive:** used-up fabric gets an "All used up. Move to Archive?" nudge (after an edit or the finished-project prompt), a signpost with Undo, an Archive chip on the Fabric stash page and "Move back to stash". Archived fabric is left out of the Sewing Overview's stash counts.
- **Same fabric?** Adding fabric whose type, woven/knit, print, general color and unit all match a piece in the maker's own Archive asks first. The server compares the two print photos by color; clearly different prints are added as new without asking. When the photos look alike, or can't be compared, the maker sees both photos and chooses "Yes, bring it back" or "No, add it as new".
- **Never pooled:** fabric matching only looks at the maker's own Archive. There's no shared fabric catalog.
- **No fabric brand:** the Brand field is gone from fabric. Brands saved before are kept by moving them into the notes.
- **Tools:** notions at quantity 0 get the Archive nudge; kit never does. The Tools page has an Archive chip. Renaming a tool's brand offers to rename it on the maker's other tools.
- **Saves and refresh (from #79):** fabric and tool saves already lock the row and land whole, and the saved item shows on the list straight away.
- **Database:** new columns `stash_fabrics.amount_left`, `stash_fabrics.archived_at` and `sewing_tools.archived_at`. No table or column is dropped.
