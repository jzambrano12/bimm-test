# Agentic code generation for the Car Inventory boilerplate

A CLI that reads a natural-language specification and generates a working React +
TypeScript application into the provided boilerplate, validating its own output
and repairing what fails.

```bash
cd agent
cp .env.example .env          # add a GEMINI_API_KEY (free: https://aistudio.google.com/apikey)
npm install
npm run agent -- --spec ./specs/car-inventory.spec.md --output ../generated-app
```

Then the generated app, which is what the agent is judged by:

```bash
cd ../generated-app
npm install && npm run typecheck && npm run test && npm run dev   # localhost:5173
```

`--dry-run` prints the plan and exits without writing anything or scaffolding —
the cheapest way to see what the agent decided to build.

---

## The loop

Three roles that call a model, two stages that do not, and two loops nested at
different granularities. Every box is annotated with what it costs, because
deciding where a model is *not* needed was a design activity in its own right.

```
 ┌── DETERMINISTIC · 0 model calls ─────────────────────────────────────┐
 │  spec.md ──► SCAFFOLD ──────────────► CONTRACT DIGEST               │
 │              copy an allowlist of     read types.ts, queries.ts,    │
 │              boilerplate entries      handlers.ts, tsconfig and     │
 │              into the output dir      the reference component       │
 │                                       → ~1.4k tokens, invariant     │
 └──────────────────────────────────────────────┬───────────────────────┘
                                                ▼
                                 PLANNER · 1 call
                        spec → requirement list + task DAG,
                        Zod-validated, then mechanically checked
                        for cycles, duplicate file ownership,
                        writes to protected paths, tests with no
                        subject → topological levels
                                                │
   ┌── INNER LOOP · per dependency level, tasks in parallel ────────────────┐
   │                                                                        │
   │   GENERATOR · 1 call per task ────► VALIDATE, cheap · 0 calls          │
   │   mode: create │ repair             shape check: declared files only,  │
   │   context = contract + planned      no fences, no placeholders         │
   │     interfaces of dependencies      tsc --noEmit, once per round,      │
   │     + their source when it fits     diagnostics scoped per task        │
   │        ▲                                     │                         │
   │        └──── only this task's errors ◄───────┘  retry ≤ 3              │
   │                                                 └─► degraded, continue │
   └────────────────────────────────┬───────────────────────────────────────┘
                                    ▼  every task settled
   ┌── OUTER LOOP · the whole app ──────────────────────────────────────────┐
   │   npm run test · 0 calls   → harness failure? stop, do not repair      │
   │   REVIEWER · 1 call        → judge each requirement against the spec   │
   │        └─► AUDIT · 0 calls → contradict verdicts the source refutes    │
   │                                │                                       │
   │            findings ──► route to the task owning the file ──► repair   │
   │                                          └─► STABILISE · re-typecheck  │
   └────────────────────────────────┬───────────────────────────────────────┘
                                    ▼
                          REPORT · 0 calls
              generated-app/.agent-run/{plan.md, report.json}
              tokens per phase · cost · degraded tasks · traceability
```

Two arcs are easy to miss and both matter.

**The reviewer's output goes back to the planner's graph, not to the generator.**
A reviewer does not fix a file; it discovers that a requirement was never
implemented properly. That is a new piece of work routed to whichever task owns
the relevant file — a different arc from a retry, with different semantics.

**Validation is a ladder with early exit, not a step.** Shape checks, `tsc` and
`vitest` are free; the reviewer costs a call. Nothing pays for a judgement about
requirements while the code does not compile.

---

## Design decisions

### The model cannot break the contract, because the tools refuse

The boilerplate's GraphQL documents, MSW handlers, seed data, `Car` type and
Apollo/MUI bootstrap are given. An app that rewrites them is not solving the
task, it is redefining it.

So writes are restricted in the tool layer: one allowlisted root (`src/`) plus a
deny list inside it. A prompt instruction is a request a model may decline under
pressure; a rejected write is a guarantee. Reads stay open — the contract has to
be readable to be honoured. The same policy is applied to the *plan*, so a task
targeting `src/mocks/handlers.ts` is rejected before a token is spent on it.

### The plan is where interfaces are decided

Early runs produced twelve files and sixteen type errors that were almost all one
bug: a hook returned `Car[]` while its consumer destructured
`{ filteredCars, filterText, setFilterText }`. Tasks declared
`exports: ["useCarFilterSort"]` — a name, with no signature — so producer and
consumers each invented a shape and only the compiler found out.

Tasks now carry `exportedInterface`: the TypeScript declarations the task must
export, settled during planning the way a tech lead settles a boundary before
splitting work between two people. Consumers receive it verbatim, *always*. The
implementation source is a bonus included when it fits the prompt budget; the
interface is the floor. The earlier version had that inverted, and starved the
integration task — the one with the most interfaces to honour — of exactly that
information.

**Tradeoff**: the planner must commit to signatures before any code exists, and
sometimes commits to an awkward one. That is strictly better than three files
disagreeing at random.

### Context is a slice of the graph, not a summary of the repo

Each generation prompt carries the invariant contract (~1.4k tokens), the planned
interfaces of the task's direct dependencies, their source when it fits, and the
requirements the task serves. Nothing else. Prompt size tracks a task's fan-in
rather than the size of the app, so the last task of a fifty-file build costs no
more than the first — and no model call is spent summarising files that could
simply be quoted.

### Partial failure beats total failure

A task that exhausts its repair budget is marked `degraded` and the run
continues. An app missing one component can be run, read and judged; an aborted
run leaves nothing. What the agent owes in exchange is an honest account, so
`report.json` carries the outstanding diagnostics per task and the process exits
non-zero when anything is unfinished.

### Every model output is verified, including the reviewer's

This is the through-line. Plans are checked for cycles and ownership conflicts.
Generations are checked against the files they were asked to produce. Repairs
that drift off-contract are rejected rather than persisted. And the reviewer —
initially the one exception — is now audited against the source it judged.

That exception was expensive. Asked to judge a requirement stating 640px and
1024px thresholds against a component using its library's 600px and 900px
defaults, the reviewer answered *10 satisfied, 0 partial, 0 missing*, with
evidence that named no number at all.

---

## Which model, and why

Gemini through Google's OpenAI-compatible endpoint, driven by the `openai` SDK.
One SDK covers any compatible provider, so the compatibility layer *is* the
abstraction and there is no vendor wrapper of my own to maintain. A reviewer
holding an OpenAI key rather than a Gemini one runs the agent unchanged with
three environment variables:

```bash
LLM_BASE_URL=https://api.openai.com/v1  LLM_API_KEY=sk-...  LLM_MODEL=gpt-5-mini
```

`LLM_API_KEY` takes priority over the provider-specific names deliberately.
Testing this path found the edge it exists for: with a Gemini key already in
`.env`, the ordered fallback picked it up and sent it to OpenAI, producing a 401
about a key the caller never chose. Inferring the provider from the base URL
would have been worse — it breaks the moment someone uses a proxy or a gateway —
so the override is explicit.

Model ids are resolved from the live `/models` catalogue rather than hardcoded,
and that decision paid for itself twice:

- **`gemini-2.5-flash` and `gemini-2.5-flash-lite` are listed in the catalogue
  but return 404 at the chat endpoint.** The assignment recommends Gemini 2.5.
  A hardcoded default would have shipped an agent that cannot make a single call.
- **Free-tier quota is metered per model.** When `gemini-flash-latest` hit its
  daily limit mid-run, `gemini-flash-lite-latest` was untouched. The preflight
  records the lighter models a key can actually reach, and the quota error prints
  them as copy-pasteable `LLM_MODEL` values.

The preflight doubles as a credential check: a bad key fails in one cheap request
rather than halfway through a run that has already written files.

All measurements below used `gemini-flash-lite-latest`, because that is what had
quota. It is the weakest tier available, which makes the numbers a floor rather
than a best case — see *what I would improve*.

---

## Cost per run

Measured, not estimated — the ledger records tokens per phase and the report
prices them against published rates.

A cold run of the sample spec, from `.agent-run/report.json`:

| Phase | Calls | Tokens |
| --- | --- | --- |
| plan | 1 | ~5,600 |
| generate | 7–9 | ~33,000 |
| repair | 3–5 | ~40,000 |
| review | 1 | ~7,000 |
| **total** | **14–15** | **85,000–95,000** |

**$0.056–$0.060** at flash-lite rates ($0.30/M input, $2.50/M output), and
**$0.00** on the free tier. Around 75 seconds wall clock. A cached re-run of the
same spec costs **$0.027** and 47 seconds, serving 10 of 14 calls from disk.

A range rather than a single figure because repair volume varies with what the
generator gets wrong, and that is the number worth reading: **repair costs about
as much as first-pass generation.** Repair prompts carry the failing file plus
its diagnostics, so they are individually larger, and the ratio is what says
whether the generation prompts are working. Every prompt fix in this repo's
history moved it down — it began above 50k against 29k.

Set `LLM_PRICE_INPUT` / `LLM_PRICE_OUTPUT` to price a different provider. An
unpriced model reports tokens with no dollar figure rather than a plausible
default.

---

## Generalisation

The evaluators intend to run a modified spec, so this is treated as a property to
enforce rather than hope for.

Neither the planner nor the generator prompt contains a single domain noun — no
cars, no inventory, no search bar. The spec is data; the prompts are procedure.
The planner's few-shot example is deliberately from an unrelated domain (a
filterable book list), which teaches the *shape* of a plan without teaching this
assignment's answer.

A test asserts it, and immediately earned its place: it caught
`"Returns { cars, loading, error }"` sitting in the planner prompt as an
acceptance-criteria example. Domain vocabulary had leaked into the procedure it
was supposed to be independent of.

What the prompts *do* contain is stack idiom — how to mock GraphQL, that a mocked
provider consumes each mock once, that a page-wide role query collects matches
from every section. The test for whether such a rule belongs is whether it would
help a completely different spec on this boilerplate. These would. A rule about
sorting cars by year would not, and there isn't one.

Run `--spec ./specs/variant.spec.md` to see a different spec produce a different
plan.

---

## What worked

**Deterministic checks on model output, everywhere.** Nearly every real defect
was caught by plain code rather than by another model call: cycles and ownership
conflicts in the plan, off-contract generations, diagnostics attributed per file,
spec values missing from the requirement list, reviewer verdicts the source
refutes. Each is cheap, instant and cannot itself hallucinate.

**Attributing failures to the task that caused them.** Repairs receive only their
own file's diagnostics. Showing a task the project's other errors invites it to
"fix" files it does not own — and it cannot write them anyway, so the call is
wasted twice.

**Tracing a defect to its origin instead of its symptom.** The
responsive-breakpoint bug looked like a generator problem, then like a
complaisant reviewer. It was neither: the planner had dropped the spec's
thresholds when summarising the requirement, and every later stage reads that
summary rather than the spec. One upstream omission, two independent downstream
failures. Fixing either symptom would have left the cause in place.

**Knowing when the failure is not yours to fix.** A run once spent three repair
rounds and ~10k tokens rewriting a test file when the real fault was a setup file
resolving to the wrong directory, so no module loaded and no assertion executed.
The agent now separates "the runner is broken" from "the assertion failed" and
declines the former.

## What I would improve with more time

**Run the reviewer on a stronger model than the generator.** The architecture
already supports it — `LLM_PLANNER_MODEL` covers planning and review — but the
free-tier quota that survived long enough to test with was the weakest tier, so
every measurement here is a floor. Review is one call per run against eight
generations; spending more per token on the judgement than on the drafts is
obviously right and I could not demonstrate it.

**Persist progress for a real `--resume`.** Today `--resume` reuses the output
directory but regenerates every task. The prompt cache makes that cheap rather
than correct. Writing task outcomes to `.agent-run/state.json` and skipping
settled tasks would make a quota-exhausted run genuinely resumable, which on a
free tier is the difference between continuing and waiting a day.

**Let a test failure repair the component, not only the test.** When a test fails
because the component is wrong, the test task cannot fix it — it does not own
that file. The agent correctly degrades and names the likely culprit rather than
deleting the assertion to go green, but the honest outcome is still a failure it
could have fixed. Routing such failures to the dependency, with a guard against
rewriting the test to match wrong behaviour, is the missing piece.

**Generate the app's own tests from the requirements, not from the
implementation.** Generated tests are written after the component and tend to
assert what it does rather than what the spec asked. That is why a wrong set of
breakpoints passed its own test suite. Generating tests from the requirement text
before the implementation exists would make them adversarial instead of
agreeable.

## State of the committed sample output

`generated-app/` was produced by the command at the top of this file. It
typechecks cleanly, all four of its generated tests pass, and the reviewer scores
it 7 of 7 mandatory requirements satisfied with the three optional ones honestly
reported as skipped. Its run artefacts are committed alongside it in
`.agent-run/`.

Verified independently of the agent's own report: the list renders five cars from
the mocked API, search filters by model case-insensitively, sorting reorders by
make alphabetically and by year newest-first, and adding a car submits the
mutation and shows the new card without a reload. The responsive image switches
on the specification's own thresholds — `(max-width: 640px)`,
`(min-width: 641px) and (max-width: 1023px)`, `(min-width: 1024px)` — rather than
the UI library's defaults, which is the defect the review tier was built to
catch.

Runs vary. Getting here took several, and earlier ones left a degraded test task
that the report named and attributed. That variance is the honest character of
generation at this model tier; the agent's contribution is that it detects the
gap and says so rather than reporting success it cannot support.

---

## Layout

```
agent/
├── specs/                     natural-language input, including a variant
└── src/
    ├── cli.ts                 flags, wiring, distinct exit codes per failure class
    ├── config.ts              env resolution; models optional by design
    ├── schemas.ts             every model boundary, as Zod types
    ├── concurrency.ts         bounded parallel map
    ├── report.ts              cost estimation and run artefacts
    ├── llm/                   client + preflight, usage ledger, structured output, cache
    ├── context/               contract digest, artifact registry, spec-value extraction
    ├── prompts/               planner, generator (create + repair modes), reviewer
    ├── tools/                 sandboxed fs, shell, deterministic scaffolding
    └── pipeline/              plan, generate, validate, review, run
```

24 source files, ~4,400 lines, 194 tests. `npm run typecheck && npm run test` in
`agent/` checks the agent itself; it is held to the same strict compiler settings
as the code it emits.
