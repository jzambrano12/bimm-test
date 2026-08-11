# Fleet Colour Audit

## What we're building

An internal tool for our operations team to audit the colours in our vehicle
fleet. It is not a browsing experience — the team is looking for patterns and
gaps, so the emphasis is on grouping and counting rather than on presenting each
vehicle attractively.

Data comes from the existing GraphQL API. There is no backend to build.

## Must have

**A colour summary first.** Above everything else, show one row per colour
present in the fleet, with the number of vehicles of that colour and the oldest
and newest model year in that group. Order the rows by count, most common colour
first, and break ties alphabetically by colour name.

**A compact table, not cards.** Below the summary, list every vehicle in a dense
table with one row each: make, model, year, colour. The team scans this, so
readability at a glance matters more than styling. Show a total row count above
the table.

**Filter by colour.** Clicking a colour in the summary filters the table to that
colour, and clicking it again clears the filter. Make the active filter obvious,
and show which filter is applied in text so it is unambiguous.

**Sort the table by any column.** Clicking a column header sorts by it; clicking
the same header again reverses the direction. Default to model ascending. Years
sort numerically, everything else alphabetically and case-insensitively.

**Flag suspicious entries.** Mark any vehicle whose year is before 1990 or after
2030 as an implausible record — those are data-entry errors, and the team needs
to find them. Show the count of flagged records in the summary area, and make
flagged rows visually distinct in the table.

**One data hook.** No component talks to the GraphQL layer. A single hook exposes
the vehicles plus loading and error state; components receive data as props.

**Tests.** Cover the logic that would actually break: that colours are grouped
and counted correctly, that the count ordering and alphabetical tie-break hold,
that clicking a colour filters and clicking again clears, that a column sort
reverses on a second click, and that the year bounds flag the right records. Mock
at the GraphQL layer.

## Nice to have

Genuinely optional — skip rather than compromise the must-haves.

- Let the team add a vehicle through a form, submitted via the API.
- Export the currently filtered table as CSV.
- Remember the active filter and sort across a page reload.
