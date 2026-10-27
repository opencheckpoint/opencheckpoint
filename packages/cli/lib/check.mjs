// SPDX-License-Identifier: Apache-2.0
//
// Validation for OpenCheckpoint v0.1: the JSON Schema (syntactic validity) and the semantic rules
// of the specification's §8 (semantic consistency), plus the parent-child rules.

import { readFileSync, existsSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

// The published package carries a copy of the schema (copied by `prepack`); in the repository the
// specification's own file is the source.
const packaged = new URL("../schema/v0.1/checkpoint.schema.json", import.meta.url);
const repository = new URL("../../../spec/schema/v0.1/checkpoint.schema.json", import.meta.url);
export const schema = JSON.parse(
  readFileSync(existsSync(packaged) ? packaged : repository, "utf8"),
);
// Formats are annotations (specification §8.1); ajv-formats only registers their names.
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictTypes: false,
  strictRequired: false,
  validateFormats: false,
});
addFormats(ajv);
const validateSchema = ajv.compile(schema);

// Which object types each reference field may point at (§8, OCP-S003).
const ANY = null;
const REF_TARGETS = {
  evidence: ["resource"],
  "origin.ref": ["resource"],
  superseded_by: ["statement"],
  target: ["resource"],
  content_ref: ["resource"],
  "selection.resource": ["resource"],
  "approval.evidence": ["resource"],
  depends_on: ["operation"],
  requires: ["requirement"],
  blocked_by: ["statement", "operation", "resource", "requirement"],
  recoverable_from: ["resource"],
  record: ["resource"],
  applies_to: ["operation"],
  "until.operation": ["operation"],
  refs: ANY,
  affected: ANY,
};

const TERMINAL_OPS = new Set(["completed", "cancelled", "rejected"]);
const OPEN_OPS = new Set(["planned", "awaiting", "uncertain"]);

// Collect every object that carries a local id, with its type.
function indexObjects(doc) {
  const objects = [];
  const add = (type, obj) => objects.push({ type, obj });
  for (const c of doc.task?.success_criteria ?? []) add("criterion", c);
  for (const s of doc.progress?.completed ?? []) add("step", s);
  for (const s of doc.progress?.next ?? []) add("step", s);
  for (const s of doc.statements ?? []) add("statement", s);
  for (const r of doc.resources ?? []) add("resource", r);
  for (const a of doc.application_context ?? []) {
    add("application_context", a);
    for (const d of a.drafts ?? []) add("draft", d);
  }
  for (const o of doc.operations ?? []) add("operation", o);
  const c = doc.continuation ?? {};
  for (const r of c.requirements ?? []) add("requirement", r);
  for (const p of c.preconditions ?? []) add("precondition", p);
  for (const s of c.stop_conditions ?? []) add("stop_condition", s);
  for (const r of c.recovery ?? []) add("recovery", r);
  return objects;
}

// Yield [field, id, path] for every local reference in the document.
function* references(doc) {
  const list = function* (field, ids, path) {
    for (const id of ids ?? []) yield [field, id, path];
  };
  const one = function* (field, id, path) {
    if (id !== undefined) yield [field, id, path];
  };
  for (const [i, c] of (doc.task?.success_criteria ?? []).entries())
    yield* list("evidence", c.evidence, `/task/success_criteria/${i}`);
  yield* list("refs", doc.progress?.focus?.refs, "/progress/focus");
  for (const [i, s] of (doc.progress?.completed ?? []).entries())
    yield* list("evidence", s.evidence, `/progress/completed/${i}`);
  for (const [i, s] of (doc.progress?.next ?? []).entries()) {
    const p = `/progress/next/${i}`;
    yield* list("blocked_by", s.blocked_by, p);
    yield* list("requires", s.requires, p);
    yield* list("refs", s.refs, p);
  }
  for (const [i, s] of (doc.statements ?? []).entries()) {
    const p = `/statements/${i}`;
    yield* one("origin.ref", s.origin?.ref, p);
    yield* one("superseded_by", s.superseded_by, p);
    yield* list("evidence", s.evidence, p);
  }
  for (const [i, a] of (doc.application_context ?? []).entries()) {
    const p = `/application_context/${i}`;
    for (const sel of a.selections ?? []) yield* one("selection.resource", sel.resource, p);
    for (const d of a.drafts ?? []) {
      yield* one("target", d.target, p);
      yield* one("content_ref", d.content_ref, p);
    }
  }
  for (const [i, o] of (doc.operations ?? []).entries()) {
    const p = `/operations/${i}`;
    yield* one("target", o.target, p);
    yield* one("record", o.record, p);
    yield* list("depends_on", o.depends_on, p);
    yield* list("approval.evidence", o.approval?.evidence, p);
  }
  const c = doc.continuation ?? {};
  for (const key of ["requirements", "preconditions", "stop_conditions", "recovery"])
    for (const [i, x] of (c[key] ?? []).entries())
      yield* list("refs", x.refs, `/continuation/${key}/${i}`);
  for (const [i, x] of (c.stop_conditions ?? []).entries()) {
    const p = `/continuation/stop_conditions/${i}`;
    yield* list("applies_to", x.applies_to, p);
    for (const u of x.until ?? []) yield* one("until.operation", u.operation, p);
  }
  for (const [i, o] of (doc.derivation?.omissions ?? []).entries())
    yield* one("recoverable_from", o.recoverable_from, `/derivation/omissions/${i}`);
  for (const [i, t] of (doc.derivation?.transformations ?? []).entries())
    yield* list("affected", t.affected, `/derivation/transformations/${i}`);
}

// Yield [name, value, path] for every timestamp that records a past event.
function* pastTimestamps(doc) {
  for (const [i, s] of (doc.progress?.completed ?? []).entries())
    if (s.completed_at) yield ["completed_at", s.completed_at, `/progress/completed/${i}`];
  for (const [i, s] of (doc.statements ?? []).entries()) {
    if (s.recorded_at) yield ["recorded_at", s.recorded_at, `/statements/${i}`];
    if (s.verification?.checked_at)
      yield ["checked_at", s.verification.checked_at, `/statements/${i}/verification`];
  }
  for (const [i, r] of (doc.resources ?? []).entries())
    if (r.observed_at) yield ["observed_at", r.observed_at, `/resources/${i}`];
  for (const [i, a] of (doc.application_context ?? []).entries())
    if (a.observed_at) yield ["observed_at", a.observed_at, `/application_context/${i}`];
  for (const [i, o] of (doc.operations ?? []).entries()) {
    const p = `/operations/${i}`;
    if (o.requested_at) yield ["requested_at", o.requested_at, p];
    if (o.last_attempt_at) yield ["last_attempt_at", o.last_attempt_at, p];
    if (o.approval?.decided_at) yield ["decided_at", o.approval.decided_at, p];
  }
}

export function checkSemantics(doc) {
  const errors = [];
  const warnings = [];
  const err = (code, path, message) => errors.push({ code, path, message });
  const warn = (code, path, message) => warnings.push({ code, path, message });

  const byId = new Map();
  for (const { type, obj } of indexObjects(doc)) {
    if (byId.has(obj.id)) err("OCP-S001", "", `local id "${obj.id}" is used more than once`);
    else byId.set(obj.id, { type, obj });
  }

  for (const [field, id, path] of references(doc)) {
    const target = byId.get(id);
    if (!target) {
      err("OCP-S002", path, `${field} refers to "${id}", which does not exist`);
      continue;
    }
    const allowed = REF_TARGETS[field];
    if (allowed && !allowed.includes(target.type))
      err(
        "OCP-S003",
        path,
        `${field} must refer to ${allowed.join(" or ")}, not ${target.type} "${id}"`,
      );
  }

  if (doc.parent?.id === doc.id)
    err("OCP-S004", "/parent", "a checkpoint cannot be its own parent");

  const created = Date.parse(doc.created_at);
  for (const [name, value, path] of pastTimestamps(doc))
    if (Date.parse(value) > created)
      err("OCP-S005", path, `${name} ${value} is later than created_at`);

  if (doc.task?.status === "completed")
    for (const [i, o] of (doc.operations ?? []).entries())
      if (OPEN_OPS.has(o.status))
        err(
          "OCP-S006",
          `/operations/${i}`,
          `task is completed but operation "${o.id}" is ${o.status}`,
        );

  for (const [i, s] of (doc.statements ?? []).entries()) {
    const target = s.superseded_by && byId.get(s.superseded_by);
    if (target?.type !== "statement") continue;
    const confirms = s.kind === "hypothesis" && target.obj.kind === "observation";
    if (target.obj.id === s.id || (target.obj.kind !== s.kind && !confirms))
      err(
        "OCP-S007",
        `/statements/${i}`,
        `"${s.id}" must be superseded by a different statement of kind ${s.kind}`,
      );
  }

  for (const [i, r] of (doc.resources ?? []).entries())
    if (r.uri && /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*@/.test(r.uri))
      err(
        "OCP-S008",
        `/resources/${i}`,
        `uri of "${r.id}" contains userinfo; credentials must not appear in a checkpoint`,
      );

  const operations = new Map((doc.operations ?? []).map((o) => [o.id, o]));
  for (const [i, x] of (doc.continuation?.stop_conditions ?? []).entries())
    for (const u of x.until ?? [])
      if (
        (u.status === "approved" || u.status === "rejected") &&
        operations.has(u.operation) &&
        operations.get(u.operation).kind !== "approval"
      )
        err(
          "OCP-S009",
          `/continuation/stop_conditions/${i}`,
          `until waits for "${u.operation}" to be ${u.status}, but it is not an approval`,
        );

  if (doc.task?.status === "blocked") {
    const stepBlocked = (doc.progress?.next ?? []).some((s) => s.blocked_by?.length);
    const opWaiting = (doc.operations ?? []).some((o) => o.status === "awaiting");
    if (!stepBlocked && !opWaiting)
      warn("OCP-W001", "/task", "task is blocked but nothing records what blocks it");
  }

  for (const [i, s] of (doc.statements ?? []).entries())
    if (s.kind === "observation" && s.origin.type === "agent" && !s.evidence?.length)
      warn("OCP-W002", `/statements/${i}`, `observation "${s.id}" by an agent cites no evidence`);

  if (doc.derivation?.method === "forked") {
    const guarded = new Set(
      (doc.continuation?.stop_conditions ?? []).flatMap((s) => [
        ...(s.refs ?? []),
        ...(s.applies_to ?? []),
      ]),
    );
    for (const [i, o] of (doc.operations ?? []).entries())
      if (
        o.kind === "action" &&
        o.effect !== "none" &&
        !TERMINAL_OPS.has(o.status) &&
        !guarded.has(o.id)
      )
        warn(
          "OCP-W004",
          `/operations/${i}`,
          `fork carries actionable operation "${o.id}" with no stop condition guarding it`,
        );
  }

  for (const [i, o] of (doc.operations ?? []).entries())
    if (o.status === "awaiting" && o.expires_at && Date.parse(o.expires_at) <= created)
      warn(
        "OCP-W003",
        `/operations/${i}`,
        `operation "${o.id}" expired before the checkpoint was created`,
      );

  return { errors, warnings };
}

export function checkTransition(parent, child) {
  const errors = [];
  if (child.parent?.id !== parent.id)
    errors.push({
      code: "OCP-T002",
      path: "/parent",
      message: "child's parent.id does not name the parent",
    });
  if (Date.parse(child.created_at) < Date.parse(parent.created_at))
    errors.push({
      code: "OCP-T002",
      path: "/created_at",
      message: "child was created before its parent",
    });
  const before = new Map((parent.operations ?? []).map((o) => [o.id, o.status]));
  for (const [i, o] of (child.operations ?? []).entries()) {
    const was = before.get(o.id);
    if (TERMINAL_OPS.has(was) && was !== o.status)
      errors.push({
        code: "OCP-T001",
        path: `/operations/${i}`,
        message: `operation "${o.id}" was ${was} in the parent and cannot become ${o.status}`,
      });
  }
  return errors;
}

export function check(doc, parent) {
  if (!validateSchema(doc))
    return {
      level: "schema",
      errors: validateSchema.errors.map((e) => `${e.instancePath || "/"} ${e.message}`),
      warnings: [],
    };
  const { errors, warnings } = checkSemantics(doc);
  if (parent) errors.push(...checkTransition(parent, doc));
  return { level: errors.length ? "semantic" : "ok", errors, warnings };
}
