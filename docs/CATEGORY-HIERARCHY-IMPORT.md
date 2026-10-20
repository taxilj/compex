# Category hierarchy import (F8)

Status: **BLOCKED on owner decisions. Nothing was imported or seeded; no category was invented.** The data exists, but it cannot be loaded into the current schema without choices only the owner can make. A read-only checker is provided so the decisions can be taken against facts.

## What exists

Source: `KAS CRM.xlsx`, sheet **Category** (373 rows = 2 heading rows + 371 data rows).

| Block | Columns | Content |
|---|---|---|
| INDIA (A–E) | Product Group, Product Category, "HS Code" (actually the third-level name), HSN, USA HTS | 371 rows: 6 groups, 35 categories, 371 unique leaves; every row has all three levels; 164 rows have no HSN |
| USA (H–N) | Product Group, Product Category, HS Code, HS Desc, Custom Duty, Reference, status | 108 rows, a **different** taxonomy (9 group spellings such as "Active Component" and "Active Components"); status column is only partly filled ("done") |

Live production today: 18 flat categories (no parents), created for the supplier catalogue import, which looks categories up **by name**.

## Run the checker (read-only)

```bash
cd compex-api
npm run catalog:check-hierarchy -- "D:/KAS CRM.xlsx" live-category-names.json
```

`live-category-names.json` is optional: a JSON array of the live category names (from the public `/api/v1/categories`). Exit code 1 means blocking issues. The same rules are unit-tested in `test/unit/category-hierarchy.test.ts` on synthetic rows.

Result on the real workbook (INDIA block): `rows=371 groups=6 categories=35 leaves=371`, **1 blocking issue, 1 review item**.

## Why it cannot be imported as-is

1. **33 names appear at more than one position**, but `Category.name` is globally unique (`prisma/schema.prisma`). Examples: "Thyristors" is a leaf under both Semiconductors > Discrete Semiconductors and Electromechanical > Circuit Protection; "Power Components" is both a group and a category; "Test & Measurement" and "Circuit Protection" are categories in one place and leaves in another. The full list: Digital Potentiometer ICs; Optocouplers / Photocouplers; Power Management ICs; Thyristors; EMI Feedthrough Filters; EMI Filter Circuits; EMI Gaskets, Sheets, Absorbers & Shielding; EMI Kits; Feedthrough Capacitors; Ferrites; Antennas; Audio Transformers / Signal Transformers; Encoders; Signal Conditioning; Thermistors; Circuit Protection; Thermal Cutoffs; Cable Assemblies; Circuit Breakers; Knobs & Dials; Relay Sockets & Hardware; Sensor Hardware & Accessories; Storage Boxes & Cases; I/O Modules; Cameras & Accessories; Counters & Tachometers; Ethernet & Communication Modules; Solenoids & Actuators; Test & Measurement; Timers; Power Components; RF Test Equipment; Temperature Sensors.
2. **8 live flat categories sit at different levels in the sheet**, and products and the catalogue import reference them by id and name: Capacitors, Circuit Protection, Connectors, Integrated Circuits (ICs), Sensors, Transducers, Switches (categories in the sheet) and Electromechanical, Semiconductors (groups). Importing would re-parent or duplicate them.
3. **No place to store HSN / USA HTS.** `Category` has `name`, `description` and `parentId` only.
4. **Two schemes** (India and USA) are in the same sheet; the public menu can show only one tree.

## Owner decisions needed

1. Which scheme drives the public catalogue menu: INDIA, USA, or something else?
2. How should the 33 repeated names be resolved: rename/qualify them in the sheet, drop the duplicates, or allow the same name under different parents (needs a schema change: uniqueness per parent, with care for top-level rows)?
3. How should the 18 live categories map into the hierarchy, and which products move where?
4. Should HSN / HTS be stored per category or per product (needs new columns)?

## What implementing it will take once decided (not started)

Any schema change is a migration that runs against production on the next deploy (`npm start` runs `prisma migrate deploy`), so it must be additive and reviewed first. The import itself should be idempotent (match on parent + name), run first as a dry run, and be applied to production only with explicit approval after a dry run on a copy of the data.
