# Generated plan

Spec: `/Users/jorgeweb/Dev/assesments/exsq/BIMM Senior FullStack Agentic AI Challenge/Fullstack-Coding-Challenge-main/agent/specs/car-inventory.spec.md`
Planner: `gemini-flash-lite-latest` · Generator: `gemini-flash-lite-latest`

```
Build a car inventory manager SPA using Apollo Client, Material UI, and existing GraphQL documents. Data access is isolated in custom hooks, presentation is split into cards, forms, and filters, and everything is composed in the main App component.

Requirements: 7 required, 3 optional
  [required] see-inventory: All cars load when the page opens and are presented as a grid of cards showing make, model, year, colour and a photo, with loading and error states.
  [required] responsive-photos: Serve the mobile image up to 640px, tablet from 641px to 1023px, desktop at 1024px and above, reacting to viewport changes.
  [required] find-car: A search field filters the list by model as the user types case-insensitively, displaying a message when nothing matches.
  [required] reorder-list: The user can sort by year (newest first) or by make (alphabetically).
  [required] add-car: A form collects make, model, year and colour, validates non-empty fields and plausible year, submits to the API, and updates the list optimistically or via refetch without page reload, showing submission feedback.
  [required] data-access-hook: Put query and mutation logic behind custom hooks so components only deal with data they are given and no component talks to GraphQL directly.
  [required] tests: Cover the behaviour that would actually break by testing list rendering, searching, sorting, and form submission by mocking at the GraphQL layer.
  [optional] fetch-single-car: Fetch a single car by id, for a detail view later on.
  [optional] filter-by-year: Filter by year alongside the model search, so the two can be combined.
  [optional] reusable-filter-sort-hook: Pull the combined filtering and sorting logic into its own reusable hook, separate from the data-fetching one.

Tasks: 7 across 3 dependency level(s)
  level 1 — 4 in parallel
    use-cars-hook (hook) → src/hooks/useCars.ts
      Create useCars and useAddCar data hooks
      satisfies: see-inventory, add-car, data-access-hook
    car-card (component) → src/components/CarCard.tsx
      Create CarCard presentational component with responsive image
      satisfies: see-inventory, responsive-photos
    add-car-form (component) → src/components/AddCarForm.tsx
      Create AddCarForm component with validation and feedback
      satisfies: add-car
    inventory-controls (component) → src/components/InventoryControls.tsx
      Create InventoryControls component for search and sort
      satisfies: find-car, reorder-list
  level 2
    car-inventory-list (component) → src/components/CarInventoryList.tsx
      Create CarInventoryList container component
      needs: car-card, inventory-controls, use-cars-hook, add-car-form
      satisfies: see-inventory, responsive-photos, find-car, reorder-list, add-car, data-access-hook
  level 3 — 2 in parallel
    car-inventory-test (test) → src/__tests__/CarInventoryList.test.tsx
      Test CarInventoryList features and GraphQL interactions
      needs: car-inventory-list
      satisfies: tests
    app-shell (integration) → src/App.tsx
      Compose CarInventoryList into App shell
      needs: car-inventory-list
      satisfies: see-inventory
```

## Requirement traceability

| Requirement | Required | Tasks | Review |
| --- | --- | --- | --- |
| see-inventory | yes | use-cars-hook, car-card, car-inventory-list, app-shell | satisfied |
| responsive-photos | yes | car-card, car-inventory-list | satisfied |
| find-car | yes | inventory-controls, car-inventory-list | satisfied |
| reorder-list | yes | inventory-controls, car-inventory-list | satisfied |
| add-car | yes | use-cars-hook, add-car-form, car-inventory-list | satisfied |
| data-access-hook | yes | use-cars-hook, car-inventory-list | satisfied |
| tests | yes | car-inventory-test | satisfied |
| fetch-single-car | no | — | missing |
| filter-by-year | no | — | missing |
| reusable-filter-sort-hook | no | — | missing |