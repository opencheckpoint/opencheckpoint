# Roadmap

| Phase                             | Deliverables                                                                                                                                                                                                                                                                                                                                                     | Status                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 0. Research and architecture      | Standards survey, scope and non-goals, architecture decisions, draft schema, risks and open questions.                                                                                                                                                                                                                                                           | Done (RFC 0001).                                                                    |
| 1. Specification and website      | Normative specification v0.1, JSON Schema, four examples, conformance fixtures, behavioral scenarios, documentation site, governance, CI.                                                                                                                                                                                                                        | Done (v0.1 draft).                                                                  |
| 2. Usable tooling                 | A TypeScript library (parse, serialize, validate, semantic rules, inspect, render, fork); a CLI on it (`validate`, `inspect`, `render`, `fork`); an MCP server on it (create, validate, list, fetch, and fork checkpoints); a capture-and-restore skill; a validator page on the documentation site that runs in the browser. All pass the conformance manifest. | In progress: the skill and the CLI (`validate`, `inspect`, `render`) are available. |
| 3. Interoperability demonstration | A task is captured mid-conversation in one AI and continued in a different vendor's AI using the skill and MCP server, without transcript replay, scored with the scenarios and the continuation metrics.                                                                                                                                                        | Not started.                                                                        |
| 4. Community review               | Publish RFC 0001, solicit review from carrier-protocol maintainers and runtime authors, recruit maintainers.                                                                                                                                                                                                                                                     | Not started.                                                                        |
| 5. Additional SDKs                | Python, Go, and Rust libraries for runtimes that integrate natively, each passing the conformance manifest. Built when runtime authors need them.                                                                                                                                                                                                                | Not started.                                                                        |

## Toward external implementations

The goal is independent implementations outside this repository. Priorities:

1. **App-assisted capture** in agent runtimes: the runtime fills the facts it knows reliably
   (operations in flight, resource revisions and digests, session ids, the origin of tool output)
   and the model fills the judgment (objective, decisions, hypotheses, next steps).
2. **Converters from existing formats**, which give the format producers on day one: a pi
   compaction entry to checkpoint converter, and an Agent Session Protocol projection to
   checkpoint converter.
3. **Carrier bindings**: documented patterns, and eventually extensions proposed in each
   protocol's own process, for carrying checkpoints as MCP resources, A2A artifacts, and ACP
   content blocks.
4. **A reference destination** that implements the restoration procedure (§10.7) and runs the
   behavioral scenarios.
5. **A conformance report format**, so external implementations can publish results against the
   manifest.
