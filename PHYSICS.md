# Physics and preset behavior

The simulator uses dimensionless planar Newtonian gravity:

`a_i = G sum_j m_j (r_j - r_i) / (|r_j - r_i|^2 + epsilon^2)^(3/2)`.

All built-in presets use `G = 1` and `epsilon = 0`. Displayed body sizes are not gravitational softening lengths. Collisions are optional and off by default, matching the point-mass model used by periodic three-body orbits.

## Repeatability and accuracy

See [the measured accuracy notes](reports/accuracy-notes.md) and [all-preset comparisons](reports/determinism.md). Fixed outer ticks and deterministic start policies isolate the solver from frame timing. Internal step doubling controls a local normalized state difference of 1e-10; this is not a global error guarantee.

## Why the previous Lagrange orbits fell apart

The previous one-period tests missed long-term instability. At simulation time 100, both numerical Lagrange configurations had undergone a collision. The figure-eight remained bounded.

A correct initial condition does not make every orbit stable. For circular triangular configurations, the mass criterion is

`27 (m1*m2 + m1*m3 + m2*m3) / (m1+m2+m3)^2 < 1`.

Neither 1:1:1 nor 3:1:1 satisfies it. Roundoff and integration errors grow under the unrestricted equations. Smaller timesteps delay this growth; they cannot eliminate physical instability.

## Two explicit modes

- **Exact preset solution:** Euler's symmetric 1:3:1 circular configuration and Lagrange's equilateral configurations use their exact Newtonian solutions. Circles use uniform rotation about the mass-weighted centre. The 1:2:3 elliptical example uses eccentricity 0.5 and solves Kepler's equation, preserving an equilateral triangle whose size changes. This mode is labeled in the controls and is the default for these presets.
- **Numerical motion:** The figure-eight and custom/edited systems use fourth-order Yoshida integration. The internal step decreases with the local gravitational and crossing times during close encounters. No hidden softening, velocity damping, energy rescaling, or periodic orbit resetting is applied. Numerical Euler/Lagrange demonstrations can still become unstable.

Changing a body's mass, position, or velocity, or changing G/softening, switches to numerical motion. Changing playback speed or the timestep does not invalidate an exact solution. Turning exact mode back on reloads the preset. Changing timestep affects accuracy, while playback speed sets simulated time per wall-clock second. Excess elapsed time is discarded under heavy load instead of blocking the browser.

Collision mode uses kick-drift-kick Verlet with continuous contact detection during each drift. Merge/fragment events are phenomenological, dissipative events, not periodic point-mass solutions. Mass and linear momentum are retained; collisions do not promise conservation of orbital energy or angular momentum. The gas effect has zero mass; mass not assigned to fragments remains in a remnant.

The on-screen state label describes observed motion; it does not assert mathematical orbital stability. Escape detection uses recession and relative energy against the remaining bodies, and is invariant under translating or boosting the entire system.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`.

Tests cover the figure-eight for 100 periods, energy and angular momentum, close encounters, collision timing and conservation, and exact solutions sampled over 1,000 periods. Exact-solution velocities and accelerations are checked independently against finite differences and the Newtonian pair forces. Browser checks cover preset selection, numeric/slider synchronization, mode changes, playback, reset, collapsing controls, reports, and mobile layout.

## References

- Chenciner & Montgomery, *A remarkable periodic solution of the three-body problem in the case of equal masses*: https://arxiv.org/abs/math/0011268
- Hu, Long & Sun, *Linear stability of elliptic Lagrangian solutions of the planar three-body problem via index theory*: https://arxiv.org/abs/1206.6162
- Chenciner, *Three body problem*: https://www.scholarpedia.org/article/Three_body_problem

The supplied article also discusses restricted and spatial problems. Those require different models; this app implements the full planar massive-body equations and the central-configuration examples described above.

## Expanded catalog and repeated periods

The catalog contains 24 presets: seven exact Euler/Lagrange configurations, the numerical figure-eight, and 16 named numerical orbits. The named set includes Butterfly I/II, Moth I/II, Dragonfly, two Yin-Yang variants, Broucke R4, and eight Sheen patterns (Oval/Catface/Starship, Two Ovals, Three Ovals, Ovals with Flourishes, Hand in Hand, Loop-ended Triangles, Skinny Pineapple, and Newton's Cradle). This is a curated set, not an exhaustive catalog of all three-body solutions.

Named numerical orbits run without periodic resetting. Period-preparation helpers remain for preview generation and regression tests; they are not an active playback mode.

Sheen data comes directly from [Matthew Sheen's original examples](https://github.com/mws262/MAE5730_examples/blob/master/3BodySolutions/getSolutionNum.m). Other named initial conditions come from [the Belgrade gallery](http://three-body.ipb.ac.rs/), retrieved through [Ricky Reusser's compilation](https://observablehq.com/@rreusser/periodic-three-body-initial-conditions). Each entry retains its source URL. Positions and velocities are translated into the centre-of-mass frame without changing relative motion.

Previews are generated by this application's integrator; regenerate them with `npm run build:orbit-previews`. The gallery filters by family. Analytics can be dismissed with its close button and restored with the floating button even when controls are collapsed. Visibility is stored locally, with a fallback when browser storage is unavailable.
