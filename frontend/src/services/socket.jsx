import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    let API_URL = 'http://localhost:5000';

    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
      API_URL = import.meta.env.VITE_API_URL;
    } else if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
      API_URL = process.env.REACT_APP_API_URL;
    }

    this.socket = io(API_URL, {
      autoConnect: false,
    });
  }

  connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  emit(event, data) {
    if (this.socket) this.socket.emit(event, data);
  }

  on(event, callback) {
    if (this.socket) this.socket.on(event, callback);
  }

  off(event, callback) {
    if (this.socket) this.socket.off(event, callback);
  }

  joinDocument(documentId) {
    this.socket.emit('join-document', { documentId });
  }

  leaveDocument(documentId) {
    this.socket.emit('leave-document', { documentId });
  }

  // Send BOTH json and html so receiver uses json for precise replacement
  sendChanges(documentId, json, html) {
    this.socket.emit('send-changes', { documentId, delta: html, json });
  }

  sendCursorPosition(documentId, position) {
    this.socket.emit('cursor-position', { documentId, position });
  }

  sendTitleChange(documentId, title) {
    this.socket.emit('title-change', { documentId, title });
  }
}

const socketService = new SocketService();
export default socketService;