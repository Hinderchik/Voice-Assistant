// api/pusher/auth.js - Аутентификация для приватных каналов
import Pusher from 'pusher';

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { socket_id, channel_name } = req.body;
        
        // Проверяем, что пользователь аутентифицирован
        // В реальном приложении здесь должна быть проверка JWT или сессии
        const playerId = req.headers['x-player-id'] || 'anonymous';
        
        // Разрешаем подключение ко всем каналам
        // В продакшене нужно проверять права доступа
        const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
            user_id: playerId,
            user_info: {
                name: 'Игрок'
            }
        });
        
        res.status(200).json(authResponse);
        
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}