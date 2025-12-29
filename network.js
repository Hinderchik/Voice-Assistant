class Network {
    constructor() {
        this.ws = null;
        this.room = null;
    }

    connect(room, onMessage) {
        this.room = room;
        this.ws = new WebSocket(
            "wss://quiet-grass-0e58.gondonloxlp.workers.dev/?room=" + room
        );

        this.ws.onopen = () => this.updateStatus(true);
        this.ws.onmessage = e => onMessage(JSON.parse(e.data));
        this.ws.onclose = () => this.updateStatus(false);
    }

    send(data) {
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(data));
        }
    }

    updateStatus(online) {
        const el = document.getElementById("connection-status");
        if (el) el.textContent = online ? "Онлайн" : "Оффлайн";
    }
}
window.Network = new Network();
