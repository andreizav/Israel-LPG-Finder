import { Telegraf } from 'telegraf';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (if not already done)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// CONSTANTS
const ADMIN_IDS = [497973726]; // Replace with actual admin IDs or load from env
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8201318259:AAEBQNGAGVM66QdHgPd-ElFBlVQOqJIHmfc';

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
        const data = JSON.parse(text);

        // Basic validation
        if (!data.name) {
            // If valid JSON but missing 'name', treat it as just a chat message or error?
            // User requirement: "Expected format JSON... find document... where name matches"
            await ctx.reply('⚠️ JSON должен содержать поле "name".');
            return;
        }

        const stationName = data.name;

        // 2. Find station in Firestore
        const stationsRef = db.collection('stations');
        const snapshot = await stationsRef.where('name', '==', stationName).limit(1).get();

        if (snapshot.empty) {
            await ctx.reply(`⚠️ Станция с таким именем не найдена: "${stationName}"`);
            return;
        }

        // 3. Update station
        const stationDoc = snapshot.docs[0];

        // Create update object (excluding name if we want, or just merge)
        // Add last_updated
        const updateData = {
            ...data,
            last_updated: new Date().toISOString()
        };

        await stationDoc.ref.update(updateData);

        await ctx.reply(`✅ Данные обновлены для: ${stationName}`);

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
