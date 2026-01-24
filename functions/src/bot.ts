import { Telegraf } from 'telegraf';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (if not already done)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// CONSTANTS
const ADMIN_IDS = [497973726]; // Replace with actual admin IDs or load from env
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export const bot = new Telegraf(BOT_TOKEN);

// Middleware: Access Control
bot.use(async (ctx, next) => {
    if (!ctx.from) return;

    if (!ADMIN_IDS.includes(ctx.from.id)) {
        console.warn(`Access denied for user: ${ctx.from.id} (${ctx.from.username})`);
        await ctx.reply('Access denied');
        return;
    }
    return next();
});

// Logic: Handle Text Messages
bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    try {
        // 1. Try to parse JSON
        let parsedData = JSON.parse(text);

        // Normalize to array
        const items = Array.isArray(parsedData) ? parsedData : [parsedData];

        if (items.length === 0) {
            await ctx.reply('⚠️ Пустой массив данных.');
            return;
        }

        const batch = db.batch();
        const stationsRef = db.collection('stations');

        let updatedCount = 0;
        const notFoundNames: string[] = [];
        const errors: string[] = [];

        // 2. Process each item
        // We need to query for each item to find its doc ID (since we don't know it)
        // Firestore batch has 500 limit. Assuming items.length < 500 for MVP.

        const updates = items.map(async (item) => {
            if (!item.name) {
                errors.push(`JSON без имени: ${JSON.stringify(item)}`);
                return;
            }

            // Find document by name
            const snapshot = await stationsRef.where('name', '==', item.name).limit(1).get();

            if (snapshot.empty) {
                notFoundNames.push(item.name);
                return;
            }

            const stationDoc = snapshot.docs[0];

            // Prepare update data
            const updateData = {
                ...item,
                last_updated: new Date().toISOString()
            };

            batch.update(stationDoc.ref, updateData);
            updatedCount++;
        });

        await Promise.all(updates);

        if (updatedCount > 0) {
            await batch.commit();
        }

        // 3. Send Report
        let report = `✅ Обновлено станций: ${updatedCount}`;

        if (notFoundNames.length > 0) {
            report += `\n\n⚠️ Не найдено (${notFoundNames.length}):\n${notFoundNames.join(', ')}`;
        }

        if (errors.length > 0) {
            report += `\n\n❌ Ошибки данных:\n${errors.join('\n')}`;
        }

        if (updatedCount === 0 && notFoundNames.length === 0 && errors.length === 0) {
            report = '⚠️ Ничего не обновлено (непонятная ситуация).';
        }

        await ctx.reply(report);

    } catch (e) {
        if (e instanceof SyntaxError) {
            await ctx.reply('❌ Ошибка: Это не JSON');
        } else {
            console.error('Database/Bot Error:', e);
            await ctx.reply('🔥 Ошибка базы данных или обработки');
        }
    }
});

// Error handling
bot.catch((err, ctx) => {
    console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
});
