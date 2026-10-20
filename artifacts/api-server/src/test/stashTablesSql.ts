// The yarn catalog, stash, project yarn and fabric stash tables for the PostgreSQL route
// tests, matching lib/db/src/schema. The users and projects tables must
// already exist in the schema.
export function stashTablesSql(isolatedSchema: string): string {
  return `
    CREATE TYPE ${isolatedSchema}.yarn_weight AS ENUM ('lace', 'fingering', 'sport', 'dk', 'worsted', 'bulky', 'super_bulky', 'jumbo');
    CREATE TYPE ${isolatedSchema}.general_color AS ENUM ('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'gray', 'white', 'cream', 'multi');
    CREATE TYPE ${isolatedSchema}.catalog_field AS ENUM ('brand', 'sub_brand', 'color');
    CREATE TYPE ${isolatedSchema}.catalog_review_status AS ENUM ('open', 'renamed', 'kept');
    CREATE TYPE ${isolatedSchema}.skein_suggestion_status AS ENUM ('pending', 'accepted', 'dismissed');
    CREATE TABLE ${isolatedSchema}.yarn_brands (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      match_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX yarn_brands_match_key ON ${isolatedSchema}.yarn_brands (match_key);
    CREATE TABLE ${isolatedSchema}.yarn_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_id uuid NOT NULL REFERENCES ${isolatedSchema}.yarn_brands(id) ON DELETE CASCADE,
      name text NOT NULL,
      match_key text NOT NULL,
      blend jsonb NOT NULL DEFAULT '[]'::jsonb,
      link text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX yarn_lines_brand_match_key ON ${isolatedSchema}.yarn_lines (brand_id, match_key);
    CREATE TABLE ${isolatedSchema}.yarn_colors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      line_id uuid NOT NULL REFERENCES ${isolatedSchema}.yarn_lines(id) ON DELETE CASCADE,
      name text NOT NULL,
      match_key text NOT NULL,
      general_color ${isolatedSchema}.general_color,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX yarn_colors_line_match_key ON ${isolatedSchema}.yarn_colors (line_id, match_key);
    CREATE TABLE ${isolatedSchema}.stash_yarns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL REFERENCES ${isolatedSchema}.users(id) ON DELETE CASCADE,
      brand_id uuid NOT NULL REFERENCES ${isolatedSchema}.yarn_brands(id),
      line_id uuid REFERENCES ${isolatedSchema}.yarn_lines(id),
      color_id uuid REFERENCES ${isolatedSchema}.yarn_colors(id),
      brand text NOT NULL,
      sub_brand text,
      color text,
      general_color ${isolatedSchema}.general_color,
      weight ${isolatedSchema}.yarn_weight,
      blend jsonb NOT NULL DEFAULT '[]'::jsonb,
      brand_link text,
      photo_path text,
      skeins_purchased double precision,
      skeins_left double precision,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE ${isolatedSchema}.project_yarns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES ${isolatedSchema}.projects(id) ON DELETE CASCADE,
      position integer NOT NULL,
      stash_yarn_id uuid REFERENCES ${isolatedSchema}.stash_yarns(id) ON DELETE SET NULL,
      brand text,
      sub_brand text,
      color text,
      held_together boolean NOT NULL DEFAULT false,
      skeins_used double precision
    );
    CREATE TABLE ${isolatedSchema}.skein_suggestions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL REFERENCES ${isolatedSchema}.users(id) ON DELETE CASCADE,
      stash_yarn_id uuid NOT NULL REFERENCES ${isolatedSchema}.stash_yarns(id) ON DELETE CASCADE,
      project_id uuid NOT NULL REFERENCES ${isolatedSchema}.projects(id) ON DELETE CASCADE,
      skeins_used double precision NOT NULL,
      status ${isolatedSchema}.skein_suggestion_status NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX skein_suggestions_yarn_project ON ${isolatedSchema}.skein_suggestions (stash_yarn_id, project_id);
    CREATE TABLE ${isolatedSchema}.catalog_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_id text NOT NULL REFERENCES ${isolatedSchema}.users(id) ON DELETE CASCADE,
      stash_yarn_id uuid REFERENCES ${isolatedSchema}.stash_yarns(id) ON DELETE SET NULL,
      field ${isolatedSchema}.catalog_field NOT NULL,
      catalog_id uuid NOT NULL,
      current_name text NOT NULL,
      suggested_name text NOT NULL,
      note text,
      status ${isolatedSchema}.catalog_review_status NOT NULL DEFAULT 'open',
      reviewer_note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz
    );
    CREATE TYPE ${isolatedSchema}.fabric_type AS ENUM ('cotton', 'linen', 'jersey', 'denim', 'silk', 'wool', 'polyester', 'blend', 'other');
    CREATE TYPE ${isolatedSchema}.fabric_construction AS ENUM ('woven', 'knit');
    CREATE TYPE ${isolatedSchema}.fabric_print AS ENUM ('solid', 'floral', 'stripe', 'check', 'dots', 'geometric', 'abstract', 'animal', 'novelty');
    CREATE TYPE ${isolatedSchema}.fabric_unit AS ENUM ('meters', 'yards');
    CREATE TABLE ${isolatedSchema}.stash_fabrics (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL REFERENCES ${isolatedSchema}.users(id) ON DELETE CASCADE,
      fabric_type ${isolatedSchema}.fabric_type NOT NULL,
      construction ${isolatedSchema}.fabric_construction,
      print ${isolatedSchema}.fabric_print,
      general_color ${isolatedSchema}.general_color,
      unit ${isolatedSchema}.fabric_unit NOT NULL DEFAULT 'meters',
      amount double precision,
      width double precision,
      brand text,
      notes text,
      photo_paths text[] NOT NULL DEFAULT '{}'::text[],
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
}
