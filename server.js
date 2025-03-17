const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const clients = new Map();

wss.on('connection', (ws) => {
    console.log('Yeni istemci bağlandı');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Gelen mesaj:', data);

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
        } catch (error) {
            console.error('Mesaj işleme hatası:', error);
        }
    });

    ws.on('close', () => {
        const id = [...clients.entries()].find(([_, client]) => client.ws === ws)?.[0];
        if (id) {
            clients.delete(id);
            console.log(`İstemci ayrıldı: ${id}`);
            broadcastUserList();
        }
    });

    ws.on('error', (error) => console.error('WebSocket hatası:', error));
});

function broadcastUserList() {
    const userList = [...clients.entries()].map(([id, client]) => ({
        id,
        username: client.username,
        audio: client.audio,
        stream: client.stream
    }));
    console.log('Kullanıcı listesi güncellendi:', userList);
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
    } else {
        console.log(`Hedef istemci bulunamadı veya kapalı: ${id}`);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
});
