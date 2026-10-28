# Sewing room: pre-washed fabric, project tools, needle and thread, fabric chart: prompts and decisions

Issue #77. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Add sewing project links, thread fields and fabric chart").

## Prompts I gave

1. "Let's start on 2, 3 & 4 but I want a toggle when inputting fabric about whether or not it is prewashed. Where would this best live?" (2 = link notions/tools to a sewing project, 3 = thread and machine needle fields, 4 = fabric-by-type chart on the Sewing Overview)
2. "draft images for the thread and machine needle piece, cause I am fearful of it being convoluted instead of helpful and clean in presentation"
3. "I like A but it still feels too much. I think we are overloading users with data requests. How might we refine this while still using the scroll wheel to keep options preselected?"
4. "reask your query differently" (about linking tools)

## Decisions

- **Pre-washed:** a Yes / No switch next to "Measured in" on the fabric form, because washing shrinks fabric and changes the amount and width. It's optional, so blank means unknown. On web, Brand moved up next to Print so Measured in and Pre-washed share a row.
- **Tools on a project:** pick from saved Sewing room Tools (notions and kit). Just a list: no amounts and no count-down.
- **Needle and thread:** two tap rows, Needle and Thread color, that read "Add" until filled. Needle opens a type wheel and a size wheel (60/8 to 110/18). Thread color opens one wheel of the shared color families. No brand and no text boxes. I turned down a first version with typed thread and brand boxes as too much to fill in.
- **Fabric by type chart:** one bar per fabric type I own, counting pieces, most first. Tapping a bar opens Fabric stash filtered to that type.
- Works on web and mobile.
