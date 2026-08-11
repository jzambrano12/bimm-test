# Generated plan

Spec: `/Users/jorgeweb/Dev/assesments/exsq/BIMM Senior FullStack Agentic AI Challenge/Fullstack-Coding-Challenge-main/agent/specs/detail-inspector.spec.md`
Planner: `gemini-flash-lite-latest` · Generator: `gemini-flash-lite-latest`

```
Build a keyboard-driven read-only vehicle detail inspector with a master list and a detail panel. Data access is isolated into dedicated custom hooks.

Requirements: 8 required, 3 optional
  [required] master-list-and-detail-panel: A master list and a detail panel, side by side, where the left side is a compact list showing year, make, and model, and the right side shows the full record for the selected vehicle or 'Select a vehicle to inspect' when nothing is selected.
  [required] fetch-selected-vehicle-individually: When a vehicle is selected, request that single vehicle from the API by its id using the GetCar query and show the result in the detail panel.
  [required] handle-unavailable-vehicle: When the API returns an error for a vehicle lookup, the detail panel shows 'Vehicle unavailable' and the error message, while the list stays usable and populated.
  [required] keyboard-navigation: The up and down arrow keys move selection through the list with wrapping, Enter re-fetches the currently selected vehicle, rows have distinct focus styling, and the list is reachable by keyboard without clicking.
  [required] truncate-long-descriptions: In the compact list, if the combined make and model exceeds 22 characters, cut it at 22 and append a single ellipsis character.
  [required] show-colour-as-text: Show the vehicle's colour as legible text, not as a swatch.
  [required] keep-data-access-in-hooks: Keep data access in hooks: one hook for the list and one for the single-vehicle lookup.
  [required] tests: Cover what would break: list rendering, single-vehicle selection request, error handling without list emptying, arrow key movement and wrapping, and name truncation vs detail panel.
  [optional] lookup-duration: Show how long the last lookup took, in milliseconds.
  [optional] home-end-keys: Let the Home and End keys jump to the first and last vehicle.
  [optional] copy-to-clipboard: Copy the selected vehicle's details to the clipboard with a button.

Tasks: 7 across 3 dependency level(s)
  level 1 — 4 in parallel
    use-cars-hook (hook) → src/hooks/useCars.ts
      Create useCars data hook
      satisfies: master-list-and-detail-panel, keep-data-access-in-hooks
    use-car-hook (hook) → src/hooks/useCar.ts
      Create useCar data hook
      satisfies: fetch-selected-vehicle-individually, handle-unavailable-vehicle, keep-data-access-in-hooks, lookup-duration
    vehicle-list-component (component) → src/components/VehicleList.tsx
      Create VehicleList compact list component
      satisfies: master-list-and-detail-panel, keyboard-navigation, truncate-long-descriptions
    vehicle-detail-component (component) → src/components/VehicleDetail.tsx
      Create VehicleDetail detail panel component
      satisfies: master-list-and-detail-panel, handle-unavailable-vehicle, show-colour-as-text, lookup-duration, copy-to-clipboard
  level 2
    inspector-view-component (component) → src/components/InspectorView.tsx
      Create InspectorView side-by-side layout component
      needs: use-cars-hook, use-car-hook, vehicle-list-component, vehicle-detail-component
      satisfies: master-list-and-detail-panel, fetch-selected-vehicle-individually, handle-unavailable-vehicle, keyboard-navigation, keep-data-access-in-hooks
  level 3 — 2 in parallel
    inspector-view-test (test) → src/__tests__/InspectorView.test.tsx
      Create tests for Vehicle Inspector
      needs: inspector-view-component
      satisfies: tests
    app-shell (integration) → src/App.tsx
      Compose InspectorView into app shell
      needs: inspector-view-component
      satisfies: master-list-and-detail-panel

Warnings (1):
  - no test task depends on "use-cars-hook", "use-car-hook", "vehicle-list-component", "vehicle-detail-component" — 4 of 6 implementation task(s) have no test covering them directly
```

## Requirement traceability

| Requirement | Required | Tasks | Review |
| --- | --- | --- | --- |
| master-list-and-detail-panel | yes | use-cars-hook, vehicle-list-component, vehicle-detail-component, inspector-view-component, app-shell | satisfied |
| fetch-selected-vehicle-individually | yes | use-car-hook, inspector-view-component | satisfied |
| handle-unavailable-vehicle | yes | use-car-hook, vehicle-detail-component, inspector-view-component | satisfied |
| keyboard-navigation | yes | vehicle-list-component, inspector-view-component | satisfied |
| truncate-long-descriptions | yes | vehicle-list-component | satisfied |
| show-colour-as-text | yes | vehicle-detail-component | satisfied |
| keep-data-access-in-hooks | yes | use-cars-hook, use-car-hook, inspector-view-component | satisfied |
| tests | yes | inspector-view-test | satisfied |
| lookup-duration | no | use-car-hook, vehicle-detail-component | satisfied |
| home-end-keys | no | — | satisfied |
| copy-to-clipboard | no | vehicle-detail-component | satisfied |