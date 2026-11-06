# Moment of Inertia on an Incline — simulation

A self-contained web app for PHY 1510 Experiment 10a (variable inertia kit). A disk rolls down a
fixed incline from the start mark to the stop mark; a stopwatch gives the travel time, and the app
turns that time into acceleration, angular speed, angular momentum and the moment of inertia of the
disk plus each steel-ball arrangement.

No build step or dependencies.

## Run it

Open `index.html` directly, or serve the folder with any static server:

```bash
npx serve .
```

## Using the app

1. Pick a **ball arrangement**: disk alone, four balls on the outer rim (Case 1), four on the inner
   rim (Case 2), two inner + two outer in line (Case 3), or the same four balls alternating
   (Case 4).
2. **Release disk** rolls it from the start mark to the stop mark. The stopwatch reading is
   recorded when the disk reaches the lower mark; the run takes roughly 1.5–1.6 s.
3. Repeat three times per arrangement (after three, the button becomes **Retake trial 3**).
   **Run all trials** fills the whole table automatically.
4. *Current run* shows the measured time, average speed v̄ = d/t, average angular speed ω̄ = v̄/r₀,
   acceleration a = 2d/t² and the total moment of inertia from that run.
5. *Result* reports the moment of inertia of the disk alone and, once the disk has been timed, the
   moment of inertia of each steel ball for every arrangement.
6. Export any plot as PNG or SVG, or the table / raw run samples as CSV.

## Physics model

Each arrangement rolls without slipping, so the acceleration and the total moment of inertia are
linked:

| Quantity | Expression |
| --- | --- |
| Travel distance *d* | 0.600 m |
| Incline height *h* | 0.045 m, sin θ = *h* / *d* = 0.075 (θ = 4.3°) |
| Acceleration | *a* = *g* sin θ · *m r₀²* / (*m r₀²* + *I*) |
| Travel time | *t* = √(2*d* / *a*) |
| Moment of inertia from the stopwatch | *I* = *m r₀²* (*g* sin θ / *a* − 1), with *a* = 2*d* / *t*² |
| Average linear speed | v̄ = *d* / *t* |
| Average angular speed | ω̄ = v̄ / *r₀* |

### Apparatus constants

| Quantity | Value |
| --- | --- |
| Disk mass *m₀* | 0.350 kg |
| Disk radius *r₀* | 6.00 cm |
| Steel ball mass *m_b* | 50.0 g |
| Outer rim radius *r₁* | 5.50 cm |
| Inner rim radius *r₂* | 2.50 cm |
| Disk inertia | ½ *m₀ r₀²* = 6.30 × 10⁻⁴ kg·m² |
| One ball at *r₁* | *m_b r₁²* = 1.51 × 10⁻⁴ kg·m² |
| One ball at *r₂* | *m_b r₂²* = 3.13 × 10⁻⁵ kg·m² |

The balls are clamped in their placeholders, so they do not spin about their own centres — only
their distance from the axis counts. That is why Cases 3 and 4 (two inner, two outer) have exactly
the same moment of inertia, and therefore the same travel time, even though the balls sit
differently: rotating the four balls around the centre does not change Σ*m r*².

### Measurement

The stopwatch is a person: the recorded time carries a 0.4 % reaction lag plus Gaussian scatter of
σ = 0.012 s, so three trials per arrangement matter and the measured *I* lands within a few percent
of the accepted value. The incline in the drawing is exaggerated for visibility (actual angle 4.3°);
every number in the readouts, table and plots uses the real values.

## Plots

1. **Distance vs time** — s = ½*a t*² from the measured acceleration, with the stopwatch stop marked.
2. **Speed vs time** — linear speed v = *a t* against the average speed *d* / *t* the stopwatch gives.
3. **Moment of inertia vs ball radius** — measured *I* for every arrangement against the model
   *I* = ½*m₀ r₀²* + 4 *m_b r*², which shows the square dependence and the overlap of Cases 3 and 4.

Every plot exports as PNG or SVG through its header buttons. The CSV export carries the constants,
all three trials per arrangement, the derived speeds, accelerations and moments of inertia, and the
per-ball values.

## Files

- `index.html` — page shell and panel layout
- `styles.css` — light/dark theme tokens and responsive layout
- `charts.js` — dependency-free canvas plotting with PNG / SVG export
- `app.js` — simulation, analysis and exports
