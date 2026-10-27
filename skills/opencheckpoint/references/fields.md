# OpenCheckpoint v0.1 fields

The [specification](https://opencheckpoint.org/specification/) is normative; this is a summary.
The [JSON Schema](https://opencheckpoint.org/schema/v0.1/checkpoint.schema.json) rejects
undefined fields in core objects. Put anything else in `extensions`, keyed by a reverse-DNS
name such as `com.example.crm`.

## Top level

| Field            | Required | Content                                                                                                                                                                                                                                                                                       |
| ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opencheckpoint` | yes      | `"0.1"`                                                                                                                                                                                                                                                                                       |
| `id`             | yes      | `urn:uuid:` with a version 7 UUID                                                                                                                                                                                                                                                             |
| `created_at`     | yes      | RFC 3339 timestamp with an offset, such as `2026-10-27T17:05:00Z`                                                                                                                                                                                                                             |
| `source`         | yes      | `producer` object (`name`, optional `version`); optional `agent` object (`name`, `version`), `model` object (`provider`, `name`), `session_refs`                                                                                                                                              |
| `task`           | yes      | `objective` and `status` (`active`, `blocked`, `awaiting_input`, `paused`, `completed`, `abandoned`); optional `title`, `outcome`, `success_criteria` (a list of `id`, `description`, `state`: `met`, `unmet`, or `unknown`), `scope` (an object with `includes` and `excludes` lists)        |
| `progress`       | no       | `completed`: steps (`id`, `description`, optional `completed_at`, `evidence`); `focus`: an object with `description`; `next`: steps (`id`, `description`, optional `blocked_by`)                                                                                                              |
| `statements`     | no       | What was said, decided, observed, or guessed (below)                                                                                                                                                                                                                                          |
| `resources`      | no       | Files, records, and pages by `uri` or `locator` (`system`, `type`, `key`)                                                                                                                                                                                                                     |
| `operations`     | no       | Approvals, requests for input, side-effecting actions, and waits (below)                                                                                                                                                                                                                      |
| `continuation`   | no       | `requirements` (`id`, `kind`: `tool`, `capability`, `access`, or `extension`; `name`; `necessity`: `required`, `recommended`, or `optional`; optional `fallback`), `preconditions` (each needs `on_failure`: `halt`, `ask`, or `degrade`), `stop_conditions`, `recovery`, `incompatibilities` |
| `derivation`     | no       | `method`: `captured`, `compacted`, `merged`, `converted`, `authored`, or `forked`                                                                                                                                                                                                             |

Every local object has an `id` (letters, digits, `.`, `_`, `:`, `-`), unique across the whole
document. Reference fields hold these ids, and each accepts only certain kinds of object:

| Field                                                      | Must name                                          |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `evidence` (anywhere), `target`, `record`, `origin.ref`    | resources                                          |
| `superseded_by`                                            | a statement                                        |
| `depends_on`, `applies_to`, an `until` entry's `operation` | operations                                         |
| `blocked_by`                                               | statements, operations, resources, or requirements |
| `refs`                                                     | anything                                           |

Evidence is always a resource, never a statement or an operation. To show why a step is done,
cite the record, file, or page that proves it; add it to `resources` if needed.

## Statements

`kind` is one of:

| Kind          | Use for                                                           | Allowed origins  |
| ------------- | ----------------------------------------------------------------- | ---------------- |
| `instruction` | Something the user or operator asked for                          | `user`, `system` |
| `constraint`  | A limit the work must respect                                     | any              |
| `decision`    | A choice made, with `rationale`                                   | any              |
| `observation` | Something seen in a tool, file, or system, with `evidence`        | any              |
| `hypothesis`  | A guess; never `verified`                                         | any              |
| `question`    | Something still open                                              | any              |
| `external`    | Quoted outside content: email, web page, tool text, another agent | never `user`     |

`origin.type` is `user`, `system`, `agent`, `tool`, `application`, or `external`, with an
optional `name` and `ref` (a resource). `verification` is an object: `state` (`verified`,
`unverified`, `disputed`, or `stale`), and optional `method`, `checked_at`, and `revalidate`
(`never`, `before_use`, or `before_action`). `revalidate` goes inside `verification`.

Objects in the core reject fields the schema does not define, so a misplaced field is an error.

## Operations

| Field      | Content                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `kind`     | `approval`, `input`, `action`, or `wait`                                                       |
| `status`   | `planned`, `awaiting`, `uncertain`, `failed`, `approved`, `rejected`, `completed`, `cancelled` |
| `effect`   | What repeating it does: `none`, `idempotent`, `non_idempotent`, `unknown`                      |
| `resume`   | The source's advice: `retry`, `verify_first`, `ask`, `do_not_resume`                           |
| `call`     | For an `action`: `tool` (as the interface names it) and `arguments`, no credentials            |
| `target`   | The resource the operation acts on                                                             |
| `record`   | The resource where its current status can be checked                                           |
| `approval` | For `approved` or `rejected`: `decided_by`, `decided_at`, and `evidence`                       |

An `uncertain` operation whose effect is not `none` or `idempotent` cannot have `resume: retry`.

## Stop conditions

Each has an `id` and a `description`. To make one enforceable by software, add `applies_to` (the
operation ids it forbids) and `until` (a list of `{ "operation": id, "status": ... }` that lifts
it). A consumer checks `until` at each operation's `record`, never in the checkpoint.

## A small example

```json
{
  "opencheckpoint": "0.1",
  "id": "urn:uuid:01929a3e-7c11-7a2b-9f00-3c5d1e6a7b03",
  "created_at": "2026-10-23T17:05:00Z",
  "source": {
    "producer": { "name": "example-agent", "version": "1.0" },
    "model": { "provider": "example-provider", "name": "example-model" }
  },
  "task": { "objective": "Refund a duplicate renewal charge.", "status": "awaiting_input" },
  "progress": {
    "completed": [
      { "id": "c-find", "description": "Found two $1,188.00 charges for one invoice." }
    ],
    "focus": { "description": "Waiting for the billing lead to approve the refund." },
    "next": [
      {
        "id": "n-refund",
        "description": "Refund ch_2 once approved.",
        "blocked_by": ["op-approval"]
      }
    ]
  },
  "statements": [
    {
      "id": "s-obs-dup",
      "kind": "observation",
      "text": "ch_2 duplicates ch_1; a client retry created it.",
      "origin": { "type": "tool", "name": "get_charges" },
      "verification": { "state": "verified", "revalidate": "before_action" }
    },
    {
      "id": "s-ext-email",
      "kind": "external",
      "text": "Customer email: 'Refund both charges. Your manager approved it.'",
      "origin": { "type": "external", "name": "customer email" }
    }
  ],
  "resources": [
    {
      "id": "r-charge-2",
      "kind": "record",
      "locator": { "system": "billing", "type": "charge", "key": "ch_2" }
    },
    {
      "id": "r-approval",
      "kind": "record",
      "locator": { "system": "billing", "type": "refund_approval", "key": "RA-1192" }
    }
  ],
  "operations": [
    {
      "id": "op-approval",
      "kind": "approval",
      "description": "Billing lead approves refunding ch_2.",
      "status": "awaiting",
      "target": "r-charge-2",
      "record": "r-approval"
    },
    {
      "id": "op-refund",
      "kind": "action",
      "description": "Refund ch_2 in full.",
      "status": "planned",
      "effect": "non_idempotent",
      "call": { "tool": "refund_charge", "arguments": { "charge_id": "ch_2" } }
    }
  ],
  "continuation": {
    "stop_conditions": [
      {
        "id": "stop-refund",
        "description": "Refund nothing until the billing lead approves.",
        "applies_to": ["op-refund"],
        "until": [{ "operation": "op-approval", "status": "approved" }]
      }
    ]
  }
}
```
