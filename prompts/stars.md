# Stars: prompts and decisions

Branch `feature/stars`. Built with Claude Code in a cloud session from my Mwedi Threads project.

## Prompts I gave

1. Original ask: "How can I use claude Code to work at creating the users table and stars feature in my application?"
2. Where the Starred view lives: "Filter on projects".

## Decisions

- **Table:** `stars` has `user_id` (links to users), `project_id` (links to projects) and `created_at`. The pair is the key, so starring twice does nothing. Deleting a project or a user removes their stars.
- **Starred view:** a "Starred" filter chip on the Projects page (web and mobile) instead of a separate page, so it works alongside search and the other filters.
- **Star button:** on every project card and on the project page, on web and mobile. Tapping it again removes the star.
- **Privacy:** you can only star your own projects; anyone else gets "Project not found."
- **API:** `PUT /projects/{id}/star` stars and `DELETE /projects/{id}/star` un-stars. Every project now says whether it's `starred`, and `GET /projects?starred=true` returns only starred ones.
