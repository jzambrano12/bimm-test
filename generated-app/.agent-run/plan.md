# Generated plan

Spec: `/Users/jorgeweb/Dev/assesments/exsq/BIMM Senior FullStack Agentic AI Challenge/Fullstack-Coding-Challenge-main/agent/specs/car-inventory.spec.md`
Planner: `gemini-flash-lite-latest` · Generator: `gemini-flash-lite-latest`

```
Build the Car Inventory Manager featuring data fetching via custom hook, responsive image selection, model search, sorting, and car addition via mutation.

Requirements: 7 required, 3 optional
  [required] see-inventory: All cars load when the page opens and are presented as a grid of cards showing make, model, year, colour, and a photo, with loading and error states handled.
  [required] responsive-photos: Serve the mobile image up to 640px, tablet from 641px to 1023px, desktop at 1024px and above, reacting to viewport changes.
  [required] find-specific-car: A search field filters the list by model as the user types case-insensitively, showing a message when nothing matches.
  [required] reorder-list: The user can sort by year (newest first) or by make (alphabetically).
  [required] add-car: A form collects make, model, year, and colour, validates inputs (no empty fields, plausible year), submits via AddCar mutation, gives in-flight feedback, and updates the list without a page reload.
  [required] keep-data-access-isolated: Put query and mutation logic behind custom hooks so components only deal with data they are given.
  [required] tests: Cover list rendering, search filtering, sorting reordering, and form mutation submission with GraphQL-level mocks.
  [optional] fetch-single-car: Fetch a single car by id, for a detail view later on.
  [optional] filter-by-year: Filter by year alongside the model search, so the two can be combined.
  [optional] reusable-filter-hook: Pull the combined filtering and sorting logic into its own reusable hook, separate from the data-fetching one.

Tasks: 8 across 4 dependency level(s)
  level 1 — 4 in parallel
    use-cars-hook (hook) → src/hooks/useCars.ts
      Create useCars data hook
      satisfies: see-inventory, add-car, keep-data-access-isolated
    car-image (component) → src/components/ResponsiveCarImage.tsx
      Create ResponsiveCarImage component
      satisfies: responsive-photos
    car-form (component) → src/components/AddCarForm.tsx
      Create AddCarForm component
      satisfies: add-car
    car-filter-sort (hook) → src/hooks/useCarFilterSort.ts
      Create filter and sort utility / hook
      satisfies: find-specific-car, reorder-list
  level 2
    car-card (component) → src/components/CarCard.tsx
      Create CarCard presentational component
      needs: car-image
      satisfies: see-inventory, responsive-photos
  level 3
    car-inventory (component) → src/components/CarInventory.tsx
      Create CarInventory container component
      needs: use-cars-hook, car-card, car-form, car-filter-sort
      satisfies: see-inventory, find-specific-car, reorder-list, add-car, keep-data-access-isolated
  level 4 — 2 in parallel
    app-shell (integration) → src/App.tsx
      Compose CarInventory into the app shell
      needs: car-inventory
      satisfies: see-inventory
    car-inventory-test (test) → src/__tests__/CarInventory.test.tsx
      Test CarInventory list, search, sort, and add mutation
      needs: car-inventory
      satisfies: tests, see-inventory, find-specific-car, reorder-list, add-car
```

## Requirement traceability

| Requirement | Required | Tasks | Review |
| --- | --- | --- | --- |
| see-inventory | yes | use-cars-hook, car-card, car-inventory, app-shell, car-inventory-test | satisfied |
| responsive-photos | yes | car-image, car-card | satisfied |
| find-specific-car | yes | car-filter-sort, car-inventory, car-inventory-test | satisfied |
| reorder-list | yes | car-filter-sort, car-inventory, car-inventory-test | satisfied |
| add-car | yes | use-cars-hook, car-form, car-inventory, car-inventory-test | satisfied |
| keep-data-access-isolated | yes | use-cars-hook, car-inventory | satisfied |
| tests | yes | car-inventory-test | satisfied |
| fetch-single-car | no | — | missing |
| filter-by-year | no | — | missing |
| reusable-filter-hook | no | — | satisfied |