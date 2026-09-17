#!/usr/bin/env python3
"""
Generate apps/mobile/src/lib/database.types.ts from a live Postgres database.

Prefer `supabase gen types typescript` when Docker is available; this script is
the Docker-free fallback and produces the same `Database` shape supabase-js
expects (Tables / Views / Functions / Enums with Row / Insert / Update).

    PGHOST=/var/run/postgresql PGPORT=54329 PGUSER=postgres \
      python3 supabase/scripts/gen-types.py dram_check apps/mobile/src/lib/database.types.ts
"""
import json
import subprocess
import sys

DB = sys.argv[1] if len(sys.argv) > 1 else "dram_check"
OUT = sys.argv[2] if len(sys.argv) > 2 else "apps/mobile/src/lib/database.types.ts"


def q(sql):
    r = subprocess.run(["psql", "-d", DB, "-X", "-At", "-c", sql], check=True, capture_output=True, text=True)
    return [json.loads(line) for line in r.stdout.splitlines() if line.strip()]


ENUMS = {r["name"]: r["values"] for r in q("""
  select json_build_object('name', t.typname, 'values', array_agg(e.enumlabel order by e.enumsortorder))
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' group by t.typname""")}

SCALARS = {
    "uuid": "string", "text": "string", "citext": "string", "bpchar": "string", "varchar": "string",
    "int2": "number", "int4": "number", "int8": "number", "numeric": "number", "float4": "number", "float8": "number",
    "bool": "boolean", "timestamptz": "string", "timestamp": "string", "date": "string",
    "jsonb": "Json", "json": "Json", "void": "undefined", "regdictionary": "string",
}


def ts_type(pg, nsp="public"):
    if pg.startswith("_"):
        return ts_type(pg[1:], nsp) + "[]"
    if pg in ENUMS:
        return f'Database["public"]["Enums"]["{pg}"]'
    if pg in SCALARS:
        return SCALARS[pg]
    return "unknown"


def emit_columns(cols, mode):
    out = []
    for c in cols:
        t = ts_type(c["type"])
        nullable = c["nullable"]
        if mode == "Row":
            out.append(f'          {c["name"]}: {t}{" | null" if nullable else ""}')
        elif mode == "Insert":
            if c["generated"]:
                continue
            opt = "?" if (nullable or c["has_default"] or c["identity"]) else ""
            out.append(f'          {c["name"]}{opt}: {t}{" | null" if nullable else ""}')
        else:  # Update
            if c["generated"]:
                continue
            out.append(f'          {c["name"]}?: {t}{" | null" if nullable else ""}')
    return "\n".join(out)


def relations(table):
    rows = q(f"""
      select json_build_object('name', c.conname, 'cols', (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum),
        'ref', rt.relname, 'refcols', (select array_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum),
        'one', (select count(*) from pg_constraint u where u.conrelid = c.conrelid and u.contype in ('p','u') and u.conkey = c.conkey) > 0)
      from pg_constraint c join pg_class rt on rt.oid = c.confrelid
      where c.contype = 'f' and c.conrelid = 'public.{table}'::regclass order by c.conname""")
    parts = []
    for r in rows:
        parts.append(
            "          {\n"
            f'            foreignKeyName: "{r["name"]}"\n'
            f'            columns: {json.dumps(r["cols"])}\n'
            f'            isOneToOne: {"true" if r["one"] else "false"}\n'
            f'            referencedRelation: "{r["ref"]}"\n'
            f'            referencedColumns: {json.dumps(r["refcols"])}\n'
            "          },"
        )
    return "\n".join(parts)


def columns(rel):
    return q(f"""
      select json_build_object('name', a.attname, 'type', t.typname, 'nullable', not a.attnotnull,
        'has_default', a.atthasdef, 'generated', a.attgenerated <> '', 'identity', a.attidentity <> '')
      from pg_attribute a join pg_type t on t.oid = a.atttypid
      where a.attrelid = 'public.{rel}'::regclass and a.attnum > 0 and not a.attisdropped order by a.attnum""")


tables = [r["n"] for r in q("select json_build_object('n', relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' order by relname")]
views = [r["n"] for r in q("select json_build_object('n', relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='v' order by relname")]

funcs = q("""
  select json_build_object('name', p.proname,
    'args', (select coalesce(json_agg(json_build_object('name', n, 'type', t.typname, 'optional', ord > p.pronargs - p.pronargdefaults, 'mode', coalesce(m, 'i')) order by ord), '[]'::json)
             from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[]), coalesce(p.proargnames, array[]::text[]), coalesce(p.proargmodes, array[]::"char"[])) with ordinality as x(ty, n, m, ord)
             join pg_type t on t.oid = x.ty),
    'retset', p.proretset, 'rettype', rt.typname, 'rettypekind', rt.typtype, 'retrel', rc.relname, 'retrelkind', rc.relkind)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  left join pg_class rc on rc.oid = rt.typrelid and rc.relnamespace = n.oid
  where n.nspname = 'public' and p.prokind = 'f' and rt.typname <> 'trigger'
  order by p.proname""")

lines = []
w = lines.append
w("/**")
w(" * GENERATED FILE — do not edit by hand.")
w(" * Regenerate with `supabase gen types typescript --local` (needs Docker) or")
w(" * `python3 supabase/scripts/gen-types.py <db> apps/mobile/src/lib/database.types.ts`.")
w(" */")
w("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]")
w("")
w("export type Database = {")
w("  public: {")
w("    Tables: {")
for t in tables:
    cols = columns(t)
    w(f"      {t}: {{")
    w("        Row: {")
    w(emit_columns(cols, "Row"))
    w("        }")
    w("        Insert: {")
    w(emit_columns(cols, "Insert"))
    w("        }")
    w("        Update: {")
    w(emit_columns(cols, "Update"))
    w("        }")
    w("        Relationships: [")
    w(relations(t))
    w("        ]")
    w("      }")
w("    }")
w("    Views: {")
for v in views:
    cols = columns(v)
    w(f"      {v}: {{")
    w("        Row: {")
    w(emit_columns(cols, "Row"))
    w("        }")
    w("        Relationships: []")
    w("      }")
w("    }")
w("    Functions: {")
for f in funcs:
    name = f["name"]
    ins = [a for a in f["args"] if a["mode"] in ("i", "b", "v")]
    outs = [a for a in f["args"] if a["mode"] in ("o", "t")]
    w(f"      {name}: {{")
    if ins:
        w("        Args: {")
        for a in ins:
            w(f'          {a["name"]}{"?" if a["optional"] else ""}: {ts_type(a["type"])}')
        w("        }")
    else:
        w("        Args: Record<PropertyKey, never>")
    if f["retrel"] and f["retrelkind"] in ("r", "v"):
        kind = "Tables" if f["retrelkind"] == "r" else "Views"
        ret = f'Database["public"]["{kind}"]["{f["retrel"]}"]["Row"]'
        w(f'        Returns: {ret}{"[]" if f["retset"] else ""}')
    elif outs:
        w("        Returns: {")
        for a in outs:
            w(f'          {a["name"]}: {ts_type(a["type"])} | null')
        w(f'        }}{"[]" if f["retset"] else ""}')
    else:
        w(f'        Returns: {ts_type(f["rettype"])}{"[]" if f["retset"] else ""}')
    w("      }")
w("    }")
w("    Enums: {")
for e, vals in sorted(ENUMS.items()):
    w(f"      {e}: {' | '.join(json.dumps(v) for v in vals)}")
w("    }")
w("    CompositeTypes: Record<string, never>")
w("  }")
w("}")
w("")
w("type PublicSchema = Database['public']")
w("export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']")
w("export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']")
w("export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']")
w("export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']")
w("export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]")
w("export type Functions<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]")
w("")

with open(OUT, "w") as fh:
    fh.write("\n".join(lines))
print(f"wrote {OUT}: {len(tables)} tables, {len(views)} views, {len(funcs)} functions, {len(ENUMS)} enums")
