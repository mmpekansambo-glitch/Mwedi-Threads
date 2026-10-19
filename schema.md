# schema.md: Mwedi Threads database

Mwedi Threads stores everything in PostgreSQL. The tables are defined with Drizzle in [`lib/db/src/schema`](lib/db/src/schema), which is the source of truth for this page.

## How the tables connect

```mermaid
erDiagram
    users ||--o{ projects : owns
    projects ||--o{ project_progress_entries : has
    users ||--o{ stars : gives
    projects ||--o{ stars : receives
    users ||--o{ stash_yarns : owns
    yarn_brands ||--o{ yarn_lines : has
    yarn_lines ||--o{ yarn_colors : has
    yarn_brands ||--o{ stash_yarns : "names"
    yarn_lines |o--o{ stash_yarns : "names"
    yarn_colors |o--o{ stash_yarns : "names"
    projects ||--o{ project_yarns : uses
    stash_yarns |o--o{ project_yarns : "links"
    stash_yarns ||--o{ skein_suggestions : "skeins left for"
    projects ||--o{ skein_suggestions : "finished in"
    users ||--o{ catalog_reviews : asks

    users {
        text id PK
        text email
        text display_name
        timestamptz joined_at
    }
    projects {
        uuid id PK
        text owner_id FK
        text title
        craft_type craft
        project_status status
        integer completion_percent
    }
    project_progress_entries {
        uuid id PK
        uuid project_id FK
        text notes
        text photo_path
        integer completion_percent
    }
    stars {
        text user_id PK, FK
        uuid project_id PK, FK
        timestamptz created_at
    }
    stash_yarns {
        uuid id PK
        text owner_id FK
        uuid brand_id FK
        uuid line_id FK
        uuid color_id FK
        text photo_path
    }
    yarn_brands {
        uuid id PK
        text name
        text match_key
    }
    yarn_lines {
        uuid id PK
        uuid brand_id FK
        text name
        jsonb blend
    }
    yarn_colors {
        uuid id PK
        uuid line_id FK
        text name
        general_color general_color
    }
    project_yarns {
        uuid id PK
        uuid project_id FK
        uuid stash_yarn_id FK
        integer position
        boolean held_together
        double skeins_used
    }
    skein_suggestions {
        uuid id PK
        uuid stash_yarn_id FK
        uuid project_id FK
        double skeins_used
        skein_suggestion_status status
    }
    catalog_reviews {
        uuid id PK
        text requester_id FK
        catalog_field field
        uuid catalog_id
        catalog_review_status status
    }
```

- **users → projects:** one-to-many. Every project belongs to one user, and each user only ever sees their own projects.
- **projects → project_progress_entries:** one-to-many. A project has many dated progress notes. Deleting a project deletes its notes.
- **users ↔ projects through stars:** many-to-many. One row means "this user starred this project." Deleting either side removes the star.
- **users → stash_yarns:** one-to-many. Each maker's yarn stash is private to them.
- **Shared yarn catalog:** `yarn_brands` → `yarn_lines` (sub brands) → `yarn_colors`, built from what makers add to their stash and shared by everyone. Each stash yarn points at its brand, and at its sub brand and color when it has them.
- **projects → project_yarns:** one-to-many. A project lists every yarn it uses, one row per yarn or per color. A yarn with a brand is linked to the maker's stash, and added to the stash if it isn't there yet.
- **skein_suggestions:** when a project is finished, each linked stash yarn gets a suggestion to take the project's skeins off what's left. The maker confirms or dismisses it.
- **catalog_reviews:** a maker asking the catalog reviewer to look at how a name was merged.

The diagram shows the key columns only. Every column is listed below.

## users

One row per person who has signed in. A row is created the first time someone makes a signed-in request.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | text | yes | | Primary key. The Clerk user ID. |
| email | text | no | | Copied from Clerk. |
| display_name | text | no | | Copied from Clerk. |
| joined_at | timestamp with time zone | yes | now | |

## projects

One row per knitting or crochet project.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | uuid | yes | random | Primary key. |
| owner_id | text | yes | | Links to `users.id`. |
| title | text | yes | | Project name. |
| craft | craft_type | yes | | `knitting` or `crochet`. |
| status | project_status | yes | `planning` | `planning`, `in_progress`, `paused` or `completed`. |
| description | text | no | | |
| pattern_name | text | no | | |
| pattern_designer | text | no | | |
| designer_website | text | no | | Link to the designer's page. |
| designer_page_title | text | no | | Page title fetched from the designer's website. |
| yarn | text | no | | Older free-text yarn note, kept for existing projects. |
| yarn_brand | text | no | | No longer used. Moved into `project_yarns` the first time the owner's projects load. |
| yarn_type | text | no | | No longer used. Moved into `project_yarns` as the sub brand. |
| yarn_color | text | no | | No longer used. Moved into `project_yarns`. |
| tools | text | no | | Older free-text tools note, shown as "Saved tools note". |
| hook_size | text | no | | Crochet hook size. |
| needle_size | text | no | | Main knitting needle size. |
| needle_type | text | no | | Main needle type, such as circular. |
| needle_cable_length | text | no | | For circular or interchangeable needles. |
| second_needle_size | text | no | | Optional second needle, such as for ribbing. |
| second_needle_type | text | no | | |
| second_needle_cable_length | text | no | | |
| started_at | date | no | | |
| started_at_precision | project_date_precision | yes | `day` | `month` or `day`. |
| target_date | date | no | | |
| target_date_precision | project_date_precision | yes | `day` | `month` or `day`. |
| completed_at | date | no | | Filled in when a project is marked completed. The maker can change it. |
| completed_at_precision | project_date_precision | yes | `day` | `month` or `day`. |
| progress_method | progress_method | yes | `estimate` | `estimate`, `rows`, `sections` or `skeins`. |
| progress_total | double precision | no | | Total rows or rounds, or skeins planned. Halves allowed. |
| progress_sections | jsonb | yes | `[]` | List of `{ name, done }` for projects tracked by sections. |
| completion_percent | integer | yes | 0 | |
| created_at | timestamp with time zone | yes | now | |
| updated_at | timestamp with time zone | yes | now | Updated on every change. |

## project_progress_entries

One row per progress note in a project's journal.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | uuid | yes | random | Primary key. |
| project_id | uuid | yes | | Links to `projects.id`. Deleted with the project. |
| notes | text | yes | | |
| photo_path | text | no | | Optional photo. |
| completion_percent | integer | yes | | Progress at the time of the note. |
| progress_value | double precision | no | | Row or round reached, or skeins used. |
| created_at | timestamp with time zone | yes | now | |

## stars

One row means "this user starred this project."

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| user_id | text | yes | | Links to `users.id`. Deleted with the user. |
| project_id | uuid | yes | | Links to `projects.id`. Deleted with the project. |
| created_at | timestamp with time zone | yes | now | |

The primary key is the pair (`user_id`, `project_id`), so a project can only be starred once per person.

## stash_yarns

One row per yarn in a maker's stash. The brand, sub brand and color names are copied from the shared catalog when the yarn is saved.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | uuid | yes | random | Primary key. |
| owner_id | text | yes | | Links to `users.id`. Deleted with the user. |
| brand_id | uuid | yes | | Links to `yarn_brands.id`. |
| line_id | uuid | no | | Links to `yarn_lines.id`. |
| color_id | uuid | no | | Links to `yarn_colors.id`. Only set when the yarn has a sub brand. |
| brand | text | yes | | |
| sub_brand | text | no | | |
| color | text | no | | The yarn's own color name, such as "Fisherman". |
| general_color | general_color | no | | Shown as a color dot on the photo. |
| weight | yarn_weight | no | | |
| blend | jsonb | yes | `[]` | List of `{ fiber, percent }` adding up to 100. |
| brand_link | text | no | | Link to the brand's page for this yarn. |
| photo_path | text | no | | Private photo, only shown to its owner. Empty for yarn added from a project until the maker adds a photo ("Needs a photo"). |
| skeins_purchased | double precision | no | | Halves allowed. |
| skeins_left | double precision | no | | Starts at skeins purchased. Can't be more than that. |
| created_at | timestamp with time zone | yes | now | |
| updated_at | timestamp with time zone | yes | now | Updated on every change. |

## project_yarns

Every yarn a project uses, in the order the maker listed them.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | uuid | yes | random | Primary key. |
| project_id | uuid | yes | | Links to `projects.id`. Deleted with the project. |
| position | integer | yes | | Order in the list, starting at 0. |
| stash_yarn_id | uuid | no | | Links to `stash_yarns.id`. Cleared if the stash yarn is removed. |
| brand | text | no | | Copied from the stash yarn when linked. |
| sub_brand | text | no | | |
| color | text | no | | |
| held_together | boolean | yes | `false` | Worked as one strand with the yarn listed just above. |
| skeins_used | double precision | no | | Halves allowed. |

## skein_suggestions

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | uuid | yes | random | Primary key. |
| owner_id | text | yes | | Links to `users.id`. |
| stash_yarn_id | uuid | yes | | Links to `stash_yarns.id`. Unique together with `project_id`, so a project only takes skeins off once. |
| project_id | uuid | yes | | Links to `projects.id`. |
| skeins_used | double precision | yes | | The project's skeins of this yarn. |
| status | skein_suggestion_status | yes | `pending` | Pending suggestions are withdrawn if the project is reopened. |
| created_at | timestamp with time zone | yes | now | |

## catalog_reviews

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | uuid | yes | random | Primary key. |
| requester_id | text | yes | | Links to `users.id`. |
| stash_yarn_id | uuid | no | | The yarn the maker asked from. |
| field | catalog_field | yes | | `brand`, `sub_brand` or `color`. |
| catalog_id | uuid | yes | | The `yarn_brands`, `yarn_lines` or `yarn_colors` row being reviewed. |
| current_name | text | yes | | The catalog name when the review was asked. |
| suggested_name | text | yes | | What the maker thinks it should be. |
| note | text | no | | |
| status | catalog_review_status | yes | `open` | `renamed` updates the catalog and every stash and project yarn using it. |
| reviewer_note | text | no | | Reply shown to the maker. |
| created_at | timestamp with time zone | yes | now | |
| resolved_at | timestamp with time zone | no | | |

The reviewer is set by email in the `CATALOG_REVIEWER_EMAILS` secret.

## yarn_brands, yarn_lines and yarn_colors

The shared yarn catalog. Every name has a `match_key` (lowercase letters and digits only), so "Lion Brand" and "lionbrand" are the same entry instead of a duplicate.

| Table | Columns | Notes |
|---|---|---|
| yarn_brands | id, name, match_key, created_at | `match_key` is unique. |
| yarn_lines | id, brand_id, name, match_key, blend, link, created_at | A brand's sub brands. Unique per brand and `match_key`. Blend and link come from the first maker who adds the sub brand and pre-fill the form for the next one. |
| yarn_colors | id, line_id, name, match_key, general_color, created_at | A sub brand's real color names. Unique per sub brand and `match_key`. |

## Enums

| Enum | Values |
|---|---|
| craft_type | `knitting`, `crochet` |
| project_status | `planning`, `in_progress`, `paused`, `completed` |
| project_date_precision | `month`, `day` |
| progress_method | `estimate`, `rows`, `sections`, `skeins` |
| yarn_weight | `lace`, `fingering`, `sport`, `dk`, `worsted`, `bulky`, `super_bulky`, `jumbo` |
| general_color | `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `brown`, `black`, `gray`, `white`, `cream`, `multi` |
| skein_suggestion_status | `pending`, `accepted`, `dismissed` |
| catalog_field | `brand`, `sub_brand`, `color` |
| catalog_review_status | `open`, `renamed`, `kept` |

## Date rule

A date saved with `month` precision means only the month and year are known. In any calculation it counts as the 1st of that month.
