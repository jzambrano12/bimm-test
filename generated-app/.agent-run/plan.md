# Generated plan

Spec: `/Users/jorgeweb/Dev/assesments/exsq/BIMM Senior FullStack Agentic AI Challenge/Fullstack-Coding-Challenge-main/agent/specs/car-inventory.spec.md`
Planner: `gemini-flash-lite-latest` · Generator: `gemini-flash-lite-latest`

```
Build a Car Inventory Manager application with responsive image selection, model search, sorting by year or make, and an add-car mutation form using Apollo Client hooks. Data fetching is isolated in a custom hook and UI components are tested via MSW GraphQL mocks.

Requirements: 7 required, 3 optional
  [required] see-inventory: All cars load when the page opens and are presented as a grid of cards showing make, model, year, colour, and a photo, with loading and error states handled.
  [required] responsive-photos: Serve the mobile image up to 640px, tablet image from 641px to 1023px, and desktop image at 1024px and above, reacting to viewport changes.
  [required] find-car: A search field case-insensitively filters the list by model as the user types, and shows a message when nothing matches.
  [required] reorder-list: The user can sort by make alphabetically or by year newest first.
  [required] add-car: A form collects make, model, year, and colour with validation preventing empty fields and implausible years, submits via mutation, gives in-flight feedback, and updates the list without page reload.
  [required] data-hook-isolation: Keep data access in one place behind a single custom hook that returns cars, loading, error, and addCar mutation function.
  [required] tests: Cover behavior including list rendering, search filtering, sorting reordering, and form submission using GraphQL layer mocking.
  [optional] fetch-single-car: Fetch a single car by id for a detail view.
  [optional] filter-by-year: Filter by year alongside the model search so the two can be combined.
  [optional] reusable-filter-hook: Pull the combined filtering and sorting logic into its own reusable hook separate from the data-fetching one.

Tasks: 6 across 3 dependency level(s)
  level 1 — 3 in parallel
    use-cars-hook (hook) → src/hooks/useCars.ts
      Create useCars data hook
      satisfies: see-inventory, add-car, data-hook-isolation
    car-card (component) → src/components/CarCard.tsx
      Create CarCard presentational component with responsive images
      satisfies: see-inventory, responsive-photos
    car-form (component) → src/components/AddCarForm.tsx
      Create AddCarForm component with validation
      satisfies: add-car
  level 2
    inventory-dashboard (component) → src/components/InventoryDashboard.tsx
      Create InventoryDashboard component with search and sort
      needs: use-cars-hook, car-card, car-form
      satisfies: see-inventory, find-car, reorder-list, add-car, data-hook-isolation
  level 3 — 2 in parallel
    app-shell (integration) → src/App.tsx
      Wire InventoryDashboard into App.tsx
      needs: inventory-dashboard
      satisfies: see-inventory
    inventory-test (test) → src/__tests__/InventoryDashboard.test.tsx
      Test InventoryDashboard behavior
      needs: inventory-dashboard
      satisfies: tests
```

## Requirement traceability

| Requirement | Required | Tasks | Review |
| --- | --- | --- | --- |
| see-inventory | yes | use-cars-hook, car-card, inventory-dashboard, app-shell | satisfied |
| responsive-photos | yes | car-card | partial |
| find-car | yes | inventory-dashboard | satisfied |
| reorder-list | yes | inventory-dashboard | satisfied |
| add-car | yes | use-cars-hook, car-form, inventory-dashboard | satisfied |
| data-hook-isolation | yes | use-cars-hook, inventory-dashboard | satisfied |
| tests | yes | inventory-test | satisfied |
| fetch-single-car | no | — | satisfied |
| filter-by-year | no | — | satisfied |
| reusable-filter-hook | no | — | satisfied |