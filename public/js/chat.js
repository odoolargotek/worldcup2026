/**
 * chat.js — bridge para initChat()
 * group.html ya importa: import { initChat } from './js/chat.js';
 * Este módulo carga dinámicamente chat-widget.js
 */
export function initChat() {
  const s = document.createElement('script');
  s.type = 'module';
  s.src  = 'js/chat-widget.js';
  document.head.appendChild(s);
}
