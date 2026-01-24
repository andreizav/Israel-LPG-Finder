import * as functions from 'firebase-functions';
import { bot } from './bot';

// Export the Telegram bot webhook handler
// This creates an HTTPS endpoint: /telegramBot
export const telegramBot = functions.https.onRequest(async (req, res) => {
    // Manual handling of the update
    try {
        await bot.handleUpdate(req.body, res);
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Error');
    }
});
