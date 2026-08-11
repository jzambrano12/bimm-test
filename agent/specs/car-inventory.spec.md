# Car Inventory Manager

## What we're building

A single-page app for browsing a dealership's car inventory. Someone arriving on
the page should see every car we have, be able to narrow the list down to what
they're looking for, and add a new car to the inventory.

The data comes from our GraphQL API. There is no backend to build — the API is
already mocked and the queries already exist.

## Must have

**See the inventory.** All cars load when the page opens and are presented as a
grid of cards. Each card shows the car's make, model, year, colour and a photo.
While the data is loading the user should see that something is happening, and
if the request fails they should see an error rather than an empty page.

**Photos that fit the screen.** Every car has three images sized for different
devices, and we should serve the right one instead of scaling a large image
down. On phones (viewport up to 640px) use the mobile image; on tablets
(641px to 1023px) the tablet image; on anything 1024px or wider the desktop
image. This needs to react to the viewport changing, not just to the initial
page load.

**Find a specific car.** A search field filters the list by model as the user
types. Matching should be forgiving about capitalisation. When nothing matches,
say so rather than showing an empty grid.

**Reorder the list.** The user can sort by year or by make. Make sorts
alphabetically; year sorts newest first.

**Add a car.** A form collects make, model, year and colour, submits them to the
API, and the new car appears in the list without a page reload. Don't let the
user submit an empty field or a year that isn't a plausible number, and give
feedback while the submission is in flight.

**Keep data access in one place.** No component should talk to the GraphQL layer
directly. Put the query logic behind a single custom hook that returns the cars
along with loading and error state, so components only deal with data they are
given.

**Tests.** Cover the behaviour that would actually break: that the list renders
what the API returns, that searching narrows it, that sorting reorders it, and
that submitting the form sends a mutation. Mock at the GraphQL layer rather than
the network.

## Nice to have

These are genuinely optional. Skip any of them rather than compromising the
must-haves.

- Fetch a single car by id, for a detail view later on.
- Filter by year alongside the model search, so the two can be combined.
- Pull the combined filtering and sorting logic into its own reusable hook,
  separate from the data-fetching one.
