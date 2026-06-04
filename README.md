# ProcAIstination

ProcAIstination is a short desktop AI experiment built to test how a playful assistant might behave directly on top of a real Windows workspace.

Instead of building a polished productivity product first, this project focused on a simpler question:

- What happens if an AI assistant feels more like a mischievous desktop creature than a normal chat box?

The result is a draggable 3D ghost overlay that reacts to the current desktop context, accepts lightweight slash commands, and uses a local Ollama model to answer prompts and trigger playful interventions.

## Demo

- Portfolio project page: https://filipebhenriques.github.io/Portfolio/projects/procaistination
- Recorded demo video: https://filipebhenriques.github.io/Portfolio/projects/procaistination/ghost-ai-demo.mp4

## What this app does

- Renders a floating 3D ghost assistant on top of the desktop.
- Lets the user interact through slash commands like `/ask`, `/open`, and `/meme`.
- Uses local Ollama inference for ghost replies and simple autonomous reactions.
- Experiments with desktop-aware behavior by reading active windows and available apps.
- Mixes useful actions with playful ones to test how an AI presence feels in a real workspace.

## Why this project exists

This is intentionally a small test app, not a production-ready assistant.

The main goal was to explore:

- whether a desktop AI should feel visible and character-driven instead of invisible and purely utilitarian
- how often it can interrupt before it becomes annoying
- what kinds of actions feel fun, helpful, unsafe, or distracting
- how local AI and desktop-native behavior can work together in a lightweight prototype

## Tech stack

- Electron
- React
- Vite
- Three.js
- Ollama with `mistral`
- Windows desktop/window APIs

## Commands

- `/ask <question>` sends a prompt to the local Ollama model.
- `/open <app>` tries to find and launch an installed application.
- `/meme <topic>` opens the meme viewer.

## How it works

At a high level, the app has two sides:

1. The Electron main process handles desktop-native behavior such as window management, app launching, and access to active-window information.
2. The renderer process draws the ghost, handles the command UI, and plays back the assistant behavior visually.

The ghost itself is not meant to be a deeply agentic system yet. It is more of a behavior sandbox:

- observe desktop context
- ask a local model for a lightweight reaction
- translate that reaction into a visible ghost response or desktop action

## Quick start

1. Install the requirements used by the project.
2. Install dependencies:

```bash
npm install
```

3. Run the app:

```bash
npm run start-app
```

This command will:

- install packages if needed
- start `ollama serve` if it is not already running
- pull the `mistral` model if it is missing
- launch the Electron app in development mode

## Current limitations

- Windows-focused only
- behavior logic is still very experimental
- little persistence or personalization
- limited safety boundaries around automated desktop actions
- no mature onboarding, settings flow, or long-term memory model

## Future improvements

- Improve context detection so the ghost can better distinguish focused work from harmless breaks.
- Add clearer user consent and safer boundaries around desktop-affecting actions.
- Introduce memory, personalization, and configurable ghost personalities.
- Refine the autonomous behavior loop so reactions feel smarter and less repetitive.
- Clean up the app architecture to better separate renderer behavior, desktop integrations, and AI logic.
- Improve onboarding and settings so the prototype is easier to understand and tune.

## Notes

- This repo is best understood as a prototype for interaction design and AI behavior on desktop, not as a finished assistant product.
- The recorded demo linked above shows the real Electron app, which is why the portfolio uses video instead of a browser embed for this project.
