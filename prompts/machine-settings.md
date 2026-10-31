# Sewing room: special machine settings on sewing projects: prompts and decisions

Issue #90. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Add machine settings to sewing projects").

## Prompts I gave

1. "Lets make a machine settings entry for each project. As an optional piece"
2. Picked "Several named sets" when asked whether a project holds one set, several named sets, or just a note.

## Decisions

- **Several named sets per project:** for example Seams, Topstitch and Hem, because topstitching and hems usually use a different stitch length than seams. Up to 10 sets.
- **What a set holds, all optional:** name, stitch, stitch length (0 to 5 mm), stitch width (0 to 7 mm), tension (0 to 9), presser foot, and a short note. Lengths, widths and tension move in half steps.
- **Where it lives:** a Special machine settings part under Needle and thread on the sewing project form. Each part of a set is a tap row with a scroll wheel, like Needle and Thread color. A set folds to one line ("Straight · Length 2.5 mm · Tension 4 · All-purpose foot") once it's done, and a set left empty is dropped.
- **Project page:** the sets show under the needle and thread only when there are some, so a project without them looks the same as before.
- Sewing room only; Yarn studio projects don't change. Works on web and mobile.
- **Name:** I renamed the section from "Machine settings" to "Special machine settings" ("Let's make the Machine Settings > Special Machine Settings").
