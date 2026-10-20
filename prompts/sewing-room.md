# Sewing Room: prompts and decisions

Issue #54. Built with Claude Code in a cloud session from my Mwedi Threads project. This is part 1 of 2: the craft switches, the Sewing room and the fabric stash. Part 2 will add sewing projects.

## Prompts I gave

1. Original ask: "Then let's start ideating on how to update the stash and projects dashboard for sewing related projects. Can we make an allowance for that? ... branding of fabric is less a matter but we need pictures to capture patterns which is a must."
2. "I want it to be a distinct feel from yarn or crochet projects"
3. "I am not entirely sure that combining sewing and yarn arts in the same space is the best way to go about adding this feature and expanding the user market of this application. How might we differentiate but ensure we are authentic to each art?"
4. "I like A but would prefer to make a toggle for anyone who wants to explore both areas to easily turn on the one they don't currently use and begin working on it."
5. "Can we build the switch into a settings section in the bottom arrow toggle where the sign out lives?"
6. "Go with all your recommendations."
7. "Make sure to prompt for the replit database updates given the creation of new tables"

## Decisions

- **Two homes in one app:** the Yarn studio (everything before) and the Sewing room, each with its own pages, words and look. The Sewing room has a Granite sidebar and a cooler green-gray wash; yarn keeps Evergreen and lavender.
- **Craft switches:** a Settings section in the menu at the bottom of the sidebar (where Sign out is), with "My crafts" switches for Yarn and Sewing. Same menu on mobile. The last craft that's on can't be turned off.
- **Start:** existing accounts start with Yarn on and Sewing off. A new person is asked "What do you make?" (yarn crafts, sewing or both).
- **Switching homes:** when both are on, a Yarn studio | Sewing room switcher sits at the top of the sidebar, and at the top of Overview and Fabric stash on mobile.
- **Fabric stash:** a required close-up photo of the print plus up to three more photos, all private. Fabric type (required), woven or knit, print, color family, meters or yards (per piece), amount, width, optional brand and notes. No shared brand catalog.
- **Search and filters:** search matches type, brand and notes; filters for type, print and color.
- **Built in two parts:** this PR, then sewing projects (pattern, size made, stages Prep, Cut, Sew, Fit, Finish, and fabric linked from the stash).
