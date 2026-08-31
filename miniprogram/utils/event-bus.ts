export const GameEvent = {
  STARS_UPDATED: 'stars:updated',
  STAR_COLLECTED: 'roof:star_collected',
  TRIP_STARTED: 'trip:started',
  TRIP_RETURNED: 'trip:returned',
  POSTCARD_DELIVERED: 'postcard:delivered',
  POSTCARD_CLAIMED: 'postcard:claimed',
  CHARACTER_HIDDEN: 'character:hidden',
  CHARACTER_VISIBLE: 'character:visible',
  INVENTORY_CHANGED: 'inventory:changed',
  BAG_PREPARED: 'bag:prepared',
} as const;

type Handler = (payload?: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

export function on(event: string, handler: Handler): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler);
  return () => off(event, handler);
}

export function off(event: string, handler: Handler): void {
  listeners.get(event)?.delete(handler);
}

export function emit(event: string, payload?: unknown): void {
  listeners.get(event)?.forEach((fn) => fn(payload));
}

export { GameEvent as default };
