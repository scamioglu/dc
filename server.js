const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const clients = new Map(); // {id: {ws, username, audio: bool, stream: bool}}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'join') {
            const id = Date.now();
            clients.set(id, { ws, username: data.username, audio: false, stream: false });
            ws.send(JSON.stringify({ type: 'id', id }));
            broadcastUserList();
        } else if (data.type === 'offer') {
            sendTo(data.to, { type: 'offer', offer: data.offer, from: data.from });
        } else if (data.type === 'answer') {
            sendTo(data.to, { type: 'answer', answer: data.answer, from: data.from });
        } else if (data.type === 'candidate') {
            sendTo(data.to, { type: 'candidate', candidate: data.candidate, from: data.from });
        } else if (data.type === 'toggleAudio') {
            clients.get(data.id).audio = data.state;
            broadcastUserList();
        } else if (data.type === 'toggleStream') {
            clients.get(data.id).stream = data.state;
            broadcastUserList();
        } else if (data.type === 'muteUser') {
            broadcast({ type: 'muteUser', targetId: data.targetId, muted: data.muted });
        }
    });

    ws.on('close', () => {
        const id = [...clients.entries()].find(([_, client]) => client.ws === ws)[0];
        clients.delete(id);
        broadcastUserList();
    });
});

function broadcastUserList() {
    const userList = [...clients.entries()].map(([id, client]) => ({
        id,
        username: client.username,
        audio: client.audio,
        stream: client.stream
    }));
    broadcast({ type: 'userList', users: userList });
}

function broadcast(message) {
    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

function sendTo(id, message) {
    const client = clients.get(id);
    if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
    }
}

server.listen(process.env.PORT || 3000, () => {
    console.log('Server çalışıyor');
});