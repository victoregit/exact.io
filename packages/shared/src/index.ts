export const APP_NAME = 'EXACT';

export * from './scoring.js';
export * from './records.js';
export * from './daily.js';
export * from './session.js';
export * from './multiplayer.js';
export * from './socket.js';
export * from './timing.js';

export interface HealthResponse {
  status: 'ok';
}
