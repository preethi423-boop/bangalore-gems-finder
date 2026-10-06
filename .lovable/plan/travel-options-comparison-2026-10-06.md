# Travel options comparison

## What will change
- Replace the single cab estimate with a compact travel-options panel after the user requests directions.
- Show the route distance and travel time once, followed by estimated fares for Auto, Mini, Sedan, and SUV.
- Label the fares as estimates and explain that demand, waiting, tolls, and provider pricing can change them.
- Keep the existing route line, current-location permission flow, and Google routing setup unchanged.

## Technical details
- Extend the route result with structured fare estimates calculated from the returned driving distance.
- Use category-specific base fares, included distance, and per-kilometre rates, rounded into practical ranges.
- Render the comparison responsively inside the existing details panel using the app’s current design system.
- Verify the app build and the mobile layout after implementation.
