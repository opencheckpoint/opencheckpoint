# opencheckpoint

Command-line tools for [OpenCheckpoint](https://opencheckpoint.org), an open format for handing
unfinished work from one AI to another.

```sh
npx opencheckpoint validate checkpoint.json     # schema and semantic rules; exit 1 if invalid
npx opencheckpoint inspect checkpoint.json      # what to deal with before continuing
npx opencheckpoint render checkpoint.json       # a brief for an AI with no OpenCheckpoint support
```

Pass `-` to read standard input, `--json` for machine-readable output from `validate` and
`inspect`, and `--parent <file>` to `validate` to check a checkpoint against its parent.

The package also exports the validator:

```js
import { check } from "opencheckpoint";
const { level, errors, warnings } = check(JSON.parse(text)); // level: "ok", "schema", or "semantic"
```

Agents learn the capture and restore procedures from the OpenCheckpoint skill:
`npx skills add opencheckpoint/opencheckpoint`.

Apache-2.0.
