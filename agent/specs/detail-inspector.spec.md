# Vehicle Detail Inspector

## What we're building

A read-only inspector for support staff who need to look up one vehicle at a
time while on a call. The interaction is keyboard-first: they are typing notes in
another window and cannot reach for a mouse.

This tool does not create, edit or delete anything. If a requirement below could
be read as allowing modification, read it the other way.

Data comes from the existing GraphQL API. There is no backend to build.

## Must have

**A master list and a detail panel, side by side.** The left side is a compact
list with one line per vehicle, showing only year, make and model. The right side
shows the full record for whichever vehicle is selected. Nothing is selected when
the page opens; the detail panel says "Select a vehicle to inspect" until
something is.

**Fetch the selected vehicle individually.** Do not reuse the record from the
list. When a vehicle is selected, request that single vehicle from the API by its
id, and show the result in the detail panel. This is deliberate: the list is a
summary and the detail panel must reflect a fresh read.

**Handle a vehicle that cannot be fetched.** The API returns an error when asked
for an id it does not have. When that happens, the detail panel shows
"Vehicle unavailable" and the message the API returned, and the list stays usable
so staff can pick another. A failed lookup must never blank the list.

**Keyboard navigation.** The up and down arrow keys move the selection through
the list, and the selection wraps: pressing up on the first vehicle goes to the
last. Enter re-fetches the currently selected vehicle. The focused row must be
visibly distinct from the merely selected one, and the list must be reachable by
keyboard without a click.

**Truncate long descriptions.** In the compact list, if the combined make and
model exceeds 22 characters, cut it at 22 and append a single ellipsis
character. The detail panel always shows the full, untruncated values.

**Show the vehicle's colour as text, not as a swatch.** Support staff read values
aloud over the phone, so the colour must be legible as a word.

**Keep data access in hooks.** One hook for the list, one for the single-vehicle
lookup. No component talks to the GraphQL layer directly, and no component holds
fetching logic.

**Tests.** Cover what would break: that the list renders what the API returns,
that selecting a vehicle triggers the single-vehicle request, that an API error
produces the unavailable state without emptying the list, that arrow keys move
and wrap the selection, and that a name longer than 22 characters is truncated
while the detail panel is not.

## Explicitly out of scope

Do not build any of these. Their absence is correct, not an omission:

- Any form, dialog or control that adds, edits or removes a vehicle.
- Search, filtering or sorting. The list order is whatever the API returns.
- Images of any kind. This is a text tool.

## Nice to have

Optional. Skip rather than compromise anything above.

- Show how long the last lookup took, in milliseconds.
- Let the Home and End keys jump to the first and last vehicle.
- Copy the selected vehicle's details to the clipboard with a button.
