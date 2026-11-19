import { MODULE_ID } from "./constants.mjs";

const EVENT = `module.${MODULE_ID}`;
const REPLY_TIMEOUT = 6000;
const handlers = {};
const waiting = new Map();
let counter = 0;

export const onMessage = (type, handler) => {
  handlers[type] = handler;
};

export const send = (type, payload = {}) => game.socket.emit(EVENT, { type, ...payload });

export const reply = (message, payload) => send("reply", { replyTo: message.requestId, ...payload });

export function ask(type, payload) {
  const requestId = `${game.user.id}-${++counter}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(requestId);
      reject(new Error("timeout"));
    }, REPLY_TIMEOUT);
    waiting.set(requestId, message => {
      clearTimeout(timer);
      waiting.delete(requestId);
      resolve(message);
    });
    send(type, { ...payload, requestId, userId: game.user.id });
  });
}

export function registerSocket() {
  game.socket.on(EVENT, message => {
    if (message.type === "reply") waiting.get(message.replyTo)?.(message);
    else handlers[message.type]?.(message);
  });
}
