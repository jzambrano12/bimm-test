# Generated plan

Spec: `/Users/jorgeweb/Dev/assesments/exsq/BIMM Senior FullStack Agentic AI Challenge/Fullstack-Coding-Challenge-main/agent/specs/detail-inspector.spec.md`
Planner: `gemini-flash-lite-latest` · Generator: `gemini-flash-lite-latest`

```
Build a keyboard-driven vehicle detail inspector with a master list and detail panel, using isolated Apollo hooks and exhaustive tests.

Requirements: 8 required, 3 optional
  [required] master-list-and-detail: Display a master list showing year, make, and model on the left, and a detail panel showing the full record on the right, with no vehicle selected initially.
  [required] fetch-single-vehicle: Fetch the selected vehicle individually using the single vehicle query when a vehicle is selected.
  [required] handle-fetch-error: Show Vehicle unavailable and the API error message in the detail panel if single vehicle fetch fails, keeping the list usable.
  [required] keyboard-navigation: Support up and down arrow keys to move and wrap selection through the list, Enter to re-fetch, distinct visual focus vs selection, and keyboard reachability.
  [required] truncate-descriptions: Truncate combined make and model in the compact list at 22 characters appending an ellipsis, while keeping detail panel untruncated.
  [required] color-as-text: Show the vehicle's colour as readable text rather than a swatch.
  [required] hooks-isolation: Keep data access in separate hooks for the list and single-vehicle lookup with no direct GraphQL calls in components.
  [required] tests-coverage: Cover list rendering, single-vehicle request on selection, error state without emptying the list, arrow key navigation and wrapping, and truncation.
  [optional] lookup-duration: Show how long the last lookup took in milliseconds.
  [optional] home-end-keys: Let the Home and End keys jump to the first and last vehicle.
  [optional] clipboard-copy: Copy the selected vehicle's details to the clipboard with a button.

Tasks: 9 across 4 dependency level(s)
  level 1 — 4 in parallel
    use-cars-hook (hook) → src/hooks/useCars.ts
      Create useCars hook for fetching vehicle list
      satisfies: master-list-and-detail, hooks-isolation
    use-car-hook (hook) → src/hooks/useCar.ts
      Create useCar hook for fetching single vehicle
      satisfies: fetch-single-vehicle, handle-fetch-error, hooks-isolation, lookup-duration
    truncate-util (component) → src/utils/format.ts
      Create string truncation utility
      satisfies: truncate-descriptions
    car-detail-component (component) → src/components/CarDetail.tsx
      Create CarDetail component for full record and error handling
      satisfies: master-list-and-detail, handle-fetch-error, color-as-text, lookup-duration, clipboard-copy
  level 2
    car-list-component (component) → src/components/CarList.tsx
      Create CarList component with keyboard navigation and truncation
      needs: truncate-util
      satisfies: master-list-and-detail, keyboard-navigation, truncate-descriptions, home-end-keys
  level 3 — 2 in parallel
    inspector-app (component) → src/components/VehicleInspector.tsx
      Create VehicleInspector main view component
      needs: use-cars-hook, use-car-hook, car-list-component, car-detail-component
      satisfies: master-list-and-detail, fetch-single-vehicle, handle-fetch-error, keyboard-navigation, hooks-isolation
    car-list-test (test) → src/__tests__/CarList.test.tsx
      Test CarList navigation and truncation
      needs: car-list-component
      satisfies: tests-coverage, keyboard-navigation, truncate-descriptions
  level 4 — 2 in parallel
    app-shell (integration) → src/App.tsx
      Mount VehicleInspector in App.tsx
      needs: inspector-app
      satisfies: master-list-and-detail
    vehicle-inspector-test (test) → src/__tests__/VehicleInspector.test.tsx
      Test VehicleInspector integration and error states
      needs: inspector-app
      satisfies: tests-coverage, master-list-and-detail, fetch-single-vehicle, handle-fetch-error

Warnings (1):
  - no test task depends on "use-cars-hook", "use-car-hook", "truncate-util", "car-detail-component" — 4 of 7 implementation task(s) have no test covering them directly
```

## Requirement traceability

| Requirement | Required | Tasks | Review |
| --- | --- | --- | --- |
| master-list-and-detail | yes | use-cars-hook, car-list-component, car-detail-component, inspector-app, app-shell, vehicle-inspector-test | satisfied |
| fetch-single-vehicle | yes | use-car-hook, inspector-app, vehicle-inspector-test | satisfied |
| handle-fetch-error | yes | use-car-hook, car-detail-component, inspector-app, vehicle-inspector-test | satisfied |
| keyboard-navigation | yes | car-list-component, inspector-app, car-list-test | satisfied |
| truncate-descriptions | yes | truncate-util, car-list-component, car-list-test | satisfied |
| color-as-text | yes | car-detail-component | satisfied |
| hooks-isolation | yes | use-cars-hook, use-car-hook, inspector-app | satisfied |
| tests-coverage | yes | car-list-test, vehicle-inspector-test | satisfied |
| lookup-duration | no | use-car-hook, car-detail-component | satisfied |
| home-end-keys | no | car-list-component | satisfied |
| clipboard-copy | no | car-detail-component | satisfied |