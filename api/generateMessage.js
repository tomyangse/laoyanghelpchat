// Vercel Serverless Function
// Handles the "Proactively Write" feature.

import { GoogleGenerativeAI } from "@google/generative-ai";

// 移除了 Vercel Edge Runtime 的配置，使用默认的 Node.js 环境

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { targetLanguage, userIntent, tone } = await req.json();

        if (!targetLanguage || !userIntent || !tone) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        let toneInstruction = '';
        switch (tone) {
            case 'casual':
                toneInstruction = `语气要非常随意、口语化，就像和好朋友聊天一样。`;
                break;
            case 'friendly':
                toneInstruction = `语气要友好、标准，适合大多数日常场景。`;
                break;
            case 'polite':
                toneInstruction = `语气要礼貌、客气，可以稍微正式一点。`;
                break;
            case 'business':
                toneInstruction = `语气要非常商务、正式，适合工作场合。`;
                break;
        }

        const generationPrompt = `你是一位精通 ${targetLanguage} 的语言专家和写作助手。
你的任务是根据用户的意图，用 ${targetLanguage} 写一条信息。
用户的意图是（用中文描述）：“${userIntent}”
${toneInstruction}
请直接生成 ${targetLanguage} 的信息内容，不要包含任何额外的解释或标题。`;

        const generationResult = await model.generateContent(generationPrompt);
        const generatedMessage = (await generationResult.response).text();

        const translationPrompt = `请将以下 ${targetLanguage} 文本翻译成自然流畅的中文：\n\n"${generatedMessage}"`;
        const translationResult = await model.generateContent(translationPrompt);
        const translatedMessage = (await translationResult.response).text();

        return new Response(JSON.stringify({
            reply: generatedMessage.trim(),
            replyTranslation: translatedMessage.trim()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in generateMessage API:", error);
        return new Response(JSON.stringify({ error: 'Failed to generate message.', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

