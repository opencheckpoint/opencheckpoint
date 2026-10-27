// SPDX-License-Identifier: Apache-2.0
//
// What a destination must deal with before continuing: open operations, stop conditions,
// preconditions, requirements, and evidence that is stale, unavailable, or due for a re-check.

const TERMINAL = new Set(["completed", "cancelled", "rejected"]);

export function inspect(doc) {
  const resources = new Map((doc.resources ?? []).map((r) => [r.id, r]));
  const c = doc.continuation ?? {};
  return {
    task: {
      title: doc.task.title,
      objective: doc.task.objective,
      status: doc.task.status,
      unmet: (doc.task.success_criteria ?? []).filter((s) => s.state !== "met").map((s) => s.id),
    },
    focus: doc.progress?.focus?.description,
    next: (doc.progress?.next ?? []).map((s) => ({
      id: s.id,
      description: s.description,
      blocked_by: s.blocked_by ?? [],
    })),
    open_operations: (doc.operations ?? [])
      .filter((o) => !TERMINAL.has(o.status))
      .map((o) => ({
        id: o.id,
        kind: o.kind,
        status: o.status,
        effect: o.effect,
        resume: o.resume,
        call: o.call,
        record: o.record,
        description: o.description,
      })),
    stop_conditions: (c.stop_conditions ?? []).map((s) => ({
      id: s.id,
      description: s.description,
      applies_to: s.applies_to ?? [],
      until: s.until ?? [],
    })),
    preconditions: (c.preconditions ?? []).map((p) => ({
      id: p.id,
      description: p.description,
      on_failure: p.on_failure,
    })),
    requirements: (c.requirements ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      necessity: r.necessity,
      fallback: r.fallback,
    })),
    recheck: (doc.statements ?? [])
      .filter(
        (s) =>
          !s.superseded_by &&
          (s.kind === "hypothesis" ||
            ["unverified", "disputed", "stale"].includes(s.verification?.state) ||
            ["before_use", "before_action"].includes(s.verification?.revalidate)),
      )
      .map((s) => ({ id: s.id, kind: s.kind, text: s.text })),
    unavailable: [...resources.values()]
      .filter((r) => r.availability && r.availability !== "available")
      .map((r) => ({ id: r.id, availability: r.availability })),
    forked: doc.derivation?.method === "forked",
  };
}

const list = (title, items, line) =>
  items.length ? [`${title}:`, ...items.map((x) => `  - ${line(x)}`)] : [];

export function formatInspection(r) {
  const lines = [
    `Task: ${r.task.title ?? r.task.objective} (${r.task.status})`,
    ...(r.task.unmet.length ? [`Unmet criteria: ${r.task.unmet.join(", ")}`] : []),
    ...(r.focus ? [`Focus: ${r.focus}`] : []),
    ...list(
      "Next",
      r.next,
      (s) =>
        `${s.id}: ${s.description}${s.blocked_by.length ? ` [blocked by ${s.blocked_by.join(", ")}]` : ""}`,
    ),
    ...list(
      "Open operations",
      r.open_operations,
      (o) =>
        `${o.id} (${o.kind}, ${o.status}${o.effect ? `, ${o.effect}` : ""}${o.resume ? `, resume: ${o.resume}` : ""}): ${o.description}`,
    ),
    ...list(
      "Stop conditions",
      r.stop_conditions,
      (s) =>
        `${s.id}: ${s.description}${s.until.length ? ` [until ${s.until.map((u) => `${u.operation} ${u.status}`).join(", ")}]` : ""}`,
    ),
    ...list(
      "Preconditions",
      r.preconditions,
      (p) => `${p.id} (on failure: ${p.on_failure}): ${p.description}`,
    ),
    ...list(
      "Requirements",
      r.requirements,
      (q) =>
        `${q.id} (${q.kind}${q.name ? ` ${q.name}` : ""}, ${q.necessity})${q.fallback ? `: fallback: ${q.fallback}` : ""}`,
    ),
    ...list("Re-check before acting", r.recheck, (s) => `${s.id} (${s.kind}): ${s.text}`),
    ...list("Unavailable resources", r.unavailable, (u) => `${u.id} (${u.availability})`),
    ...(r.forked
      ? ["Forked: sibling forks may exist; act only on operations this fork owns."]
      : []),
  ];
  return lines.join("\n");
}
