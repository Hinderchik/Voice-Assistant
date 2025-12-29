// network.js - simplified online mode (public channel, no auth)
class Network {
    constructor() {
        this.pusher = null;
        this.channel = null;
        this.roomId = "global-room";
        this.connected = false;
    }

    init(onMoveCallback) {
        if (typeof Pusher === 'undefined') {
            console.error('Pusher not loaded');
            return;
        }

        this.pusher = new Pusher('f9725d9e08548ab81164', {
            cluster: 'eu',
            forceTLS: true
        });

        this.channel = this.pusher.subscribe('public-chess');

        this.channel.bind('pusher:subscription_succeeded', () => {
            this.connected = true;
            this.updateConnectionStatus(true);
        });

        this.channel.bind('move', data => {
            if (onMoveCallback) {
                onMoveCallback(data);
            }
        });
    }

    sendMove(move) {
        fetch('/api/move', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(move)
        });
    }

    updateConnectionStatus(connected) {
        const el = document.getElementById('connection-status');
        if (el) {
            el.textContent = connected ? 'Онлайн' : 'Оффлайн';
        }
    }
}

window.Network = new Network();
