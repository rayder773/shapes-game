export const phases = [
  'beginFrame',
  'input',
  'preUpdate',
  'update',
  'fixedUpdate',
  'physics',
  'postPhysics',
  'events',
  'postUpdate',
  'render',
  'ui',
  'cleanup',
  'endFrame',
] as const;

export type Phase = (typeof phases)[number];

export const fixedStepPhases = ['fixedUpdate', 'physics', 'postPhysics'] as const satisfies readonly Phase[];

export const variableStepPhases = phases.filter(
  (phase): phase is Phase => !fixedStepPhases.includes(phase as (typeof fixedStepPhases)[number]),
);
