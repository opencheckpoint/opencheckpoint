---
title: Using OpenCheckpoint
description: How a checkpoint is captured mid-conversation, moved, and restored, and which tools serve whom.
---

A checkpoint moves through three steps: an agent **captures** it, something **moves** it, and
another agent **restores** it.

## Install

```sh
npx skills add opencheckpoint/opencheckpoint
```

This installs the OpenCheckpoint skill, which teaches your agent the capture and restore
procedures below. Ask it to "checkpoint this", or give it a checkpoint and ask it to continue.
The skill validates with the `opencheckpoint` CLI, which you can also run yourself:

```sh
npx opencheckpoint validate checkpoint.json   # schema and semantic rules; exits 1 if invalid
npx opencheckpoint inspect checkpoint.json    # what to deal with before continuing
npx opencheckpoint render checkpoint.json     # a brief for an AI without the skill
```

The MCP server, the validator page, and the libraries are on the [roadmap](../project/roadmap/).

## Capture

Mid-conversation, the agent you are working with holds the context, so it writes
the checkpoint. You ask for one ("checkpoint this"), or the application asks for one when the
context window fills or work is about to change hands.

A checkpoint combines two kinds of fact:

| Fact                                                                                                                                | Known reliably by                 |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Objective, decisions and their rationale, which beliefs are findings and which are hypotheses, open questions, next steps           | The model                         |
| Operations in flight, resource revisions and digests, timestamps, session ids, and which text came from a tool rather than the user | The application running the agent |

When the model writes a checkpoint alone, the provenance in it is the model's own account. The
format records that account; it cannot verify it. When the application fills the mechanical facts
and the model fills the judgment, the safety-relevant fields (origins, uncertain operations,
revisions) come from the system that observed them. Agent runtimes integrate this way through the
SDKs.

Before handing the checkpoint on, the producer validates it and fixes what the validator reports.

## Move

A checkpoint is a JSON file. It travels however the two sides can share one:

- as a file: downloaded from one AI and attached in another;
- as a resource on an MCP server that both AIs connect to;
- as an artifact in an A2A task, or a content block in an ACP session (see
  [Interoperability](../interop/)).

## Restore

You give the checkpoint to the destination agent and ask it to continue. The destination:

1. validates it;
2. checks stop conditions and its own capabilities against the checkpoint's requirements;
3. re-checks stale evidence, unverified approvals, and uncertain operations in the systems of
   record;
4. continues from the current focus and next steps, without redoing completed work;
5. tells you what it restored, what it could not, and how it is continuing.

The [restoration procedure](../specification/#107-restoration-procedure) is normative. A model
with no OpenCheckpoint support reads a checkpoint's fields correctly, because they are
self-describing, but it does not reliably follow these steps. The checkpoint cannot instruct it
to, because every field in a checkpoint is untrusted data. The procedure reaches the destination
through its own configuration: a skill, an MCP server's tool descriptions, or native support.

## The pieces

| Piece                        | For                                            | What it does                                                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill** (available)        | Any agent that supports skills                 | Teaches the agent the capture and restore procedures, and uses the CLI or MCP tools when they are available. Works mid-conversation with nothing else installed.                                           |
| **MCP server**               | Anyone using an MCP host                       | Tools to create, validate, list, fetch, and fork checkpoints. When both AIs connect to the same server, it also moves checkpoints between them.                                                            |
| **CLI** (available)          | Developers, CI, and coding agents with a shell | `validate`, `inspect` (what is pending, stale, or required before continuing), and `render` (a delimited, provenance-labelled brief for an AI with no support). `fork` is planned.                         |
| **Validator page**           | Anyone with a browser                          | Paste a checkpoint, see the validation result and a readable summary. Runs entirely in the browser.                                                                                                        |
| **SDKs**                     | Developers of agent runtimes and applications  | Parse, validate, build, and inspect checkpoints in code. The CLI, MCP server, and validator page are built on the TypeScript SDK. Runtimes use an SDK for application-assisted capture and native restore. |
| **Specification and schema** | Implementers                                   | The format itself.                                                                                                                                                                                         |

## Without the skill

- **Capture:** give the agent the [specification](../specification/) or an
  [example](../examples/) and ask it to write a checkpoint of the current task, then run
  `npx opencheckpoint validate` on the result.
- **Restore:** run `npx opencheckpoint render checkpoint.json` and give the destination AI the
  brief it prints. The brief carries the restoration procedure and labels every statement's kind
  and origin.
