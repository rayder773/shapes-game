import { BrowserInputAdapter, createComponentToken, createGameRuntime } from './framework';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root "#app" was not found.');
}

const frameLabelToken = createComponentToken<{ text: string }>('frameLabel');

const input = new BrowserInputAdapter({ pointerTarget: window });
const runtime = createGameRuntime({
  input,
  systems: [
    {
      id: 'bootstrap.frame-metrics',
      phase: 'update',
      order: 10,
      run(context) {
        const labels = context.world.query(frameLabelToken);

        for (const [, label] of labels) {
          label.text = `phase=${context.phase} frame=${context.time.frame} dt=${context.time.deltaTime.toFixed(2)}ms`;
        }
      },
    },
    {
      id: 'bootstrap.render-status',
      phase: 'ui',
      order: 10,
      run(context) {
        const [firstLabel] = context.world.query(frameLabelToken);

        app.innerHTML = `
          <div style="font-family: monospace; padding: 24px;">
            <h1>2D ECS Framework Runtime</h1>
            <p>${firstLabel?.[1].text ?? 'runtime started'}</p>
            <p>state=${String(context.state.currentState ?? 'idle')}</p>
            <p>keysDown=${context.input.keysDown.size} eventsQueued=${context.events.peekAll().length}</p>
          </div>
        `;
      },
    },
  ],
});

const labelEntity = runtime.world.createEntity();
runtime.world.addComponent(labelEntity, frameLabelToken, { text: 'runtime bootstrapped' });
runtime.state.enterState('idle');
runtime.loop.start();
