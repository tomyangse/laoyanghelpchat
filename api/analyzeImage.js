// Vercel Serverless Function
// Handles image analysis: OCR, language detection, and translation.

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
        const { image: base64ImageData } = await req.json();
        if (!base64ImageData) {
            return new Response(JSON.stringify({ error: 'No image data provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

        const prompt = "请从这张图片中提取所有文字，然后判断这些文字是什么语言（例如：English, Spanish, Chinese），最后将提取的文字内容翻译成通顺的中文。请严格按照以下JSON格式返回，不要有任何多余的解释：{\"language\": \"识别出的语言\", \"originalText\": \"提取的原文\", \"translatedText\": \"翻译后的中文\"}";
        
        const imagePart = {
            inlineData: {
                data: base64ImageData,
                mimeType: "image/jpeg",
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = await response.text();
        
        // 清理并解析AI返回的JSON字符串
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(cleanedText);

        return new Response(JSON.stringify(parsedResult), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in analyzeImage API:", error);
        return new Response(JSON.stringify({ error: 'Failed to analyze image.', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

