import { EventEmitter } from 'events';

const bus = new EventEmitter();
bus.setMaxListeners(100);

export function emitEntityChange(entityType, event) {
  bus.emit(`entity:${entityType}`, event);
  bus.emit('entity:*', { entityType, ...event });
}

export function subscribeEntity(entityType, listener) {
  const channel = `entity:${entityType}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}
