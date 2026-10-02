import express from 'express';
import { prisma } from '../prismaClient.js';
import Groq from 'groq-sdk';
import * as cheerio from 'cheerio';

const router = express.Router();
let groq;
try {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key' });
} catch (e) {
  console.warn("Groq initialization failed (likely missing API key)");
}

// Crawler helper
async function crawlPage(path) {
  try {
    const url = `http://127.0.0.1:3000${path}`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const html = await res.text();
    const $ = cheerio.load(html);
    // Clean up unnecessary elements
    $('script, style, noscript, nav, footer, header').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return `--- CONTENT FROM ${path.toUpperCase()} PAGE ---\n${text}\n`;
  } catch (error) {
    return ''; // Ignore if page fails to load
  }
}

router.post('/chat', async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Groq API Key is not configured on the server.' });
  }
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    // Fetch all products to give AI live context
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        category: true,
        brand: true,
        stock: true,
        isSeasonEndSale: true,
        description: true
      }
    });

    const productsContext = products.map(p => 
      `ID: ${p.id} | Name: ${p.name} | Brand: ${p.brand || 'N/A'} | Category: ${p.category} | Price: Rs ${p.price} | Stock: ${p.stock} | Sale: ${p.isSeasonEndSale ? 'Yes' : 'No'} | Desc: ${p.description || 'None'}`
    ).join('\n');

    // Crawl important static pages live to get latest info
    const [aboutContent, contactContent, returnPolicyContent] = await Promise.all([
      crawlPage('/about'),
      crawlPage('/contact'),
      crawlPage('/return-policy')
    ]);
    const websiteContext = [aboutContent, contactContent, returnPolicyContent].filter(Boolean).join('\n');

    const systemPrompt = `You are a highly professional, friendly, and helpful AI shopping assistant for "Ezzywalk", a premium brand selling slippers and shirts in Pakistan.
Your main goal is to help customers find products, answer their queries, and provide details.

CRITICAL LANGUAGE RULES:
1. You must understand and communicate fluently in Roman Urdu (Urdish), Urdu, and English, matching the user's language.
2. NEVER use pure Hindi words (e.g., use 'shukriya' instead of 'dhanyawad', 'masla' instead of 'samasya', 'khush aamdeed' instead of 'swagat'). 
3. Do not repeat the same phrases over and over. Keep responses natural and conversational.

PRODUCT RECOMMENDATION RULES:
Below is the live catalog of all available products in our store:
<catalog>
${productsContext}
</catalog>

When a user asks about a product, or if you want to recommend a product to them, you MUST include the product's exact ID in this special format: [PRODUCT:id]
For example, if you recommend a product with ID "676f2...", you should say:
"Ye dekhain, humara bohat acha article hai: [PRODUCT:676f2...]"
The frontend will automatically intercept this tag and render a beautiful product card with an image and link for the user. Do not try to write markdown links or image URLs yourself, JUST use the [PRODUCT:id] tag.
Only recommend products that are actually in the catalog above. If something is out of stock (Stock: 0), let them know.

WEBSITE KNOWLEDGE (CRAWLED LIVE):
Below is the live text crawled from our website's static pages. 
NEVER invent answers or hallucinate facts (like fake founders, dates, or fake policies). ALWAYS read the text below. If the answer is in the text below, use it. If the answer is not in the text below, say you don't know or ask them to contact support.
<crawled_data>
${websiteContext}
</crawled_data>

Keep your responses concise, helpful, and professional.`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: apiMessages,
      model: 'openai/gpt-oss-20b',
      temperature: 0.7,
      max_tokens: 1024,
    });

    res.json({ reply: chatCompletion.choices[0]?.message?.content || 'Sorry, I could not process that.' });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: 'Failed to generate AI response', details: error.message || error.toString() });
  }
});

export default router;
