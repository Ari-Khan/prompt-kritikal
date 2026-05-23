# Prompt‑Kritikal

**Prompt‑Kritikal** is an interactive, data‑driven 3D nuclear conflict visualizer and simulation toolkit built with React, Vite and three.js. It simulates nation-level escalation, launches animated strike arcs, models diplomatic responses, and provides rich UI controls for investigation and experimentation.

## Highlights

- Real-time 3D globe rendered with three.js and react-three/fiber and high-quality textures
- Pluggable, modular simulation engine in `src/sim` (weapons, targeting, strikes, diplomacy, salvo management)
- Data-driven nations and relations: `src/data/nations.json` and `src/data/bilateral-relations.json`
- Animated arcs, per-event launches, and visual explosion effects
- UI for running scenarios, adjusting simulation speed, performance presets, and textures

## Features

- Interactive globe with country fills, borders, and city markers
- Escalation simulation with:
    - Weapon selection (ICBM / SLBM / air launches)
    - Per-strike target weighting and faction logic
    - Nuclear development modelling
- Visual effects:
    - Animated arc trajectories using cubic curves and per-event seeding
    - Cone head projectiles and explosions to show impacts
    - Skybox with shaders and mipmaps for stability
- Controls & UX:
    - Run simulations from the control panel or programmatically
    - Settings panel for performance, textures and tick step control
    - Smooth camera movement and reset options

## Getting started (Development)

Requirements: Node 18+ recommended.

1. Install dependencies

```bash
npm install
```

2. Run the dev server

```bash
npm run dev
```

Open http:

3. Build / Preview

```bash
npm run build
npm run preview
```

## Data & Extensibility

- Logic has been enhanced with AI to ensure realistic conflict simulation and periodic updates to global relations data
- Add or tweak nations in `src/data/nations.json` (colors, doctrine, powerTier, weapons, majorCities)
- Edit pairwise affinities in `src/data/bilateral-relations.json` to influence targeting & diplomacy
- Simulation favors modular changes: change selection logic in `src/sim/targeting.js` or strike behavior in `src/sim/strikes.js`
