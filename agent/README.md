# Agentic code generation for the Car Inventory boilerplate

A CLI that reads a natural-language specification and generates a working React +
TypeScript application into the provided boilerplate, validating its own output
and repairing what fails.

```bash
cd agent
cp .env.example .env          # add a GEMINI_API_KEY (free: https://aistudio.google.com/apikey)
npm install
npm run agent -- --spec ./specs/car-inventory.spec.md
```

The repository root delegates too, so this works from either directory — paths
are relative to wherever you run it, and `--output` defaults to `generated-app/`
beside the boilerplate in both cases:

```bash
npm run agent:install
npm run agent -- --spec ./agent/specs/car-inventory.spec.md
```

Free-tier quota is metered per model and the flash tiers are small. If a run
stops on a 429, the agent prints the models your key can still reach; passing
one explicitly avoids the round trip:

```bash
LLM_MODEL=gemini-flash-lite-latest npm run agent -- --spec ./agent/specs/car-inventory.spec.md
```

Then the generated app, which is what the agent is judged by:

```bash
cd ../generated-app
npm install && npm run typecheck && npm run test && npm run build
npm run dev                                                       # localhost:5173
```

A committed sample output is already there, so those four commands work on a
fresh checkout before you run the agent at all. The same holds for
`inspector-app/`, generated from a second spec — see *Generalisation*.

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

### A prohibition is a requirement too

Specifications say what not to build, and for a while nothing here could hold
that. Running `detail-inspector.spec.md` — whose out-of-scope section forbids
images — produced an app rendering one, and the reviewer scored it 11 of 11
satisfied. The reviewer was right: it judges the requirements it is given, and no
prohibition was among them, because the schema had nowhere to put one. The planner
had silently dropped the whole section.

Prohibitions are now extracted, carried into every generation and repair prompt,
and given a verdict each by the reviewer, with breaches routed through the same
remediation path as any other finding. The same spec now yields three
prohibitions and none breached.

Two details cost something to learn. The prohibition block is **not** scoped to
the task the way requirements are: the image appeared in a detail panel whose own
task said nothing about images, so which file will reach for a forbidden thing is
not predictable. And the reviewer is told explicitly not to excuse a breach for
being useful or conventional, because that is precisely how this one arrived — an
image in a vehicle detail view is the obvious thing to add.

The general lesson is the one worth keeping: **anything the pipeline cannot
represent, it cannot enforce.**

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

Both figures below are cold runs with the cache disabled, read straight from the
committed `.agent-run/report.json` of each sample output. Every number here is
reproducible from a file in this repository.

| Phase | `generated-app` | `inspector-app` |
| --- | --- | --- |
| plan | 1 call, 5,605 tok | 1 call, 6,283 tok |
| generate | 7 calls, 30,820 tok | 9 calls, 39,966 tok |
| repair | 5 calls, 42,159 tok | 4 calls, 27,138 tok |
| review | 1 call, 6,760 tok | 1 call, 7,917 tok |
| **total** | **14 calls, 85,344 tok** | **15 calls, 81,304 tok** |
| **cost** | **$0.0558** | **$0.0530** |
| **wall clock** | 90 s | 73 s |

At flash-lite rates ($0.30/M input, $2.50/M output) — and **$0.00** on the free
tier, which is where both of these actually ran. A cached re-run of the same spec
costs roughly half and serves most calls from disk; that was measured separately
and is not in the committed reports, since both were run with `--no-cache` to
keep them honest cold numbers.

Two runs rather than one because repair volume varies with what the generator
gets wrong, and the repair row is the number worth reading: **repair costs about
as much as first-pass generation.** On `car-inventory` it cost more — 42k against
31k, five calls to fix seven files. On `detail-inspector` it cost less — 27k
against 40k, four calls against nine files. Repair prompts carry the failing file
plus its diagnostics, so they are individually larger, and the ratio is what says
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

Two further specs exist for this, and each stresses something the sample does
not:

- **`variant.spec.md`** — a fleet colour audit. Grouped summary rows with counts
  and year ranges, a dense sortable table, click-to-filter, flagging of
  implausible years. Aggregation and tables where the sample has cards.
- **`detail-inspector.spec.md`** — a keyboard-driven read-only lookup. Forces the
  `GetCar` single-record query that neither other spec exercises, requires
  handling the error the mock returns for an unknown id, and **explicitly
  forbids** any add form, search, sort or images. That last part is the sharpest
  generalisation test in the repository: the sample spec asks for an add form, so
  producing one here would be carryover rather than comprehension. It does not.
  The plan also preserves the spec's literal values — a 22-character truncation
  limit and two exact on-screen strings.

Both produce plans with no vocabulary or structure carried over from the sample.

`detail-inspector.spec.md` is carried all the way through to a committed output —
`inspector-app/`, alongside `generated-app/` — so the generalisation claim can be
inspected rather than taken on trust:

```bash
npm run agent -- --spec ./agent/specs/detail-inspector.spec.md --output ./inspector-app
```

The reviewer scores it 11 of 11 requirements satisfied with 0 of 3 prohibitions
breached. That second number is the one that matters: the sample spec asks for an
add form, search and sorting, this one forbids all three, and none appears.

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

**Add the production build as a third validation tier.** The loop validates with
`tsc --noEmit` and `vitest run`, which is most of the value for the least time,
but it never runs `npm run build`. `vite build` can fail where both of those pass
— unresolved aliases, a rollup import error, an asset the bundler cannot find —
and a generated app that typechecks but does not build is not a runnable
deliverable. Both committed samples do build, verified by hand, but by hand is
the wrong place for it: `validate.ts` already has the shape a build tier needs,
and the repair loop would then see bundler diagnostics the way it sees compiler
ones.

**Let a test failure repair the component, not only the test.** When a test fails
because the component is wrong, the test task cannot fix it — it does not own
that file. The agent correctly degrades and names the likely culprit rather than
deleting the assertion to go green, but the honest outcome is still a failure it
could have fixed. Routing such failures to the dependency, with a guard against
rewriting the test to match wrong behaviour, is the missing piece.

**Get test granularity to hold across specs.** The planner is asked for a test
task per independently testable unit and usually complies, but a specification
whose testing requirement is one bullet listing five behaviours still yields a
single omnibus test file. Rather than ask more loudly, plan validation now warns
which implementation tasks no test task covers — on `detail-inspector.spec.md`
that is 4 of 6. Turning that warning into a planner correction round is the
obvious next step and the one I would take first.

**Generate the app's own tests from the requirements, not from the
implementation.** Generated tests are written after the component and tend to
assert what it does rather than what the spec asked. That is why a wrong set of
breakpoints passed its own test suite. Generating tests from the requirement text
before the implementation exists would make them adversarial instead of
agreeable.

## State of the committed sample output

Two outputs are committed, from two different specs. Both were produced by the
commands at the top of this file, and each carries its own run artefacts in
`.agent-run/` — `plan.md` and the `report.json` the cost table above is drawn
from.

| | `generated-app/` | `inspector-app/` |
| --- | --- | --- |
| Spec | `specs/car-inventory.spec.md` | `specs/detail-inspector.spec.md` |
| Files written | 7 | 9 |
| Tasks degraded | 0 of 7 | 0 of 9 |
| Reviewer verdict | 7 of 7 mandatory satisfied, 3 optional reported missing | 11 of 11 satisfied |
| Prohibitions breached | — | 0 of 3 |
| Model calls / cost | 14 / $0.056 | 15 / $0.053 |

Both are verified beyond the agent's own report — `npm install && npm run
typecheck && npm run test && npm run build` passes in each:

```
generated-app   tsc --noEmit clean   4 tests passed   vite build ok (629 kB)
inspector-app   tsc --noEmit clean   5 tests passed   vite build ok (551 kB)
```

`npm run build` is worth stating separately because the agent does not run it —
it validates with typecheck and tests, so the production bundle is checked here
by hand rather than by the loop. See *what I would improve*.

Behaviour verified by hand in `generated-app/`: the list renders five cars from
the mocked API, search filters by model case-insensitively, sorting reorders by
make alphabetically and by year newest-first, and adding a car submits the
mutation and shows the new card without a reload. The responsive image switches
on the specification's own thresholds — `(max-width: 640px)`,
`(min-width: 641px) and (max-width: 1023px)`, `(min-width: 1024px)` — rather than
the UI library's defaults, which is the defect the review tier was built to
catch.

`inspector-app/` is the sharper result of the two: the spec forbids an add form,
search, sorting and images, and the reviewer confirms none of the three
prohibitions was breached even though the other sample spec asks for all of them.

Runs vary. Getting here took several, and earlier ones left a degraded test task
that the report named and attributed. That variance is the honest character of
generation at this model tier; the agent's contribution is that it detects the
gap and says so rather than reporting success it cannot support.

So expect your own run to differ from what is committed here. The on-disk prompt
cache is not distributed — it is regenerable and gitignored — so running these
specs from a fresh checkout is a cold run against a non-deterministic model. It
should land in the same place; it will not land on the same bytes. The committed
outputs are evidence of what the workflow produces, not a fixture it reproduces.

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

24 source files, ~4,700 lines, 218 tests across 15 test files.
`npm run typecheck && npm run test` in `agent/` checks the agent itself; it is
held to the same strict compiler settings as the code it emits.
