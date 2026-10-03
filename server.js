import express from 'express';
import fetch from 'node-fetch';

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'SUA_CHAVE_API_GEMINI_AQUI';
const RECEPTOR_PHONE = '554497021060'; // Receptor número +55 44 9702-1060

// Evolution API / Z-API Configuration
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'SUA_CHAVE_EVOLUTION_API';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'SaborComAfeto';

// In-memory conversation memory store (Phone number -> Message history array)
const conversationStore = new Map();

const JESSICA_SYSTEM_PROMPT = `Você é a Jéssica, a atendente virtual carinhosa, fofa e muito eficiente da pizzaria "Sabor com Afeto".
Slogan da empresa: "Do meu lar para o seu ❤️".
Número Oficial do WhatsApp Receptor: +55 44 9702-1060.

REGRAS DE ATENDIMENTO:
1. Atenda com muita simpatia, carinho e educação. Use emojis doces como ❤️, 🍕, ✨. Destaque sempre que as pizzas são artesanais e feitas com muito amor.
2. Seja sempre educada, calorosa e objetiva. Use emojis como ❤️, 🍕, ✨, 🛵.
3. As pizzas têm tamanho único: Tamanho grande • 8 pedaços. O valor padrão é R$ 75,00.
4. Horário de funcionamento: Terça a Domingo, das 18h às 23h30.
5. Formas de pagamento: Pix, Cartão de Crédito, Cartão de Débito e Dinheiro.
6. Taxa de entrega: R$ 5,00 a R$ 10,00 (Conforme o bairro).
7. Quando o cliente escolher os sabores, confirme o pedido solicitando:
   - Sabores escolhidos
   - Nome completo
   - Endereço de entrega completo com ponto de referência
   - Forma de pagamento escolhida
8. Lembre sempre que sabor, carinho e ingrediente selecionado são as marcas registradas da Sabor com Afeto!

CARDÁPIO ATUALIZADO DE PIZZAS SALGADAS (Tamanho grande • 8 pedaços):
- CARBONARA: Frango, milho, ervilha, calabresa, bacon, muçarela e catupiry. [R$ 75,00] (Acompanha batata palha à parte.)
- MODA DA CASA: Presunto, frango, milho, bacon, calabresa, azeitona, tomate, palmito, muçarela e catupiry. [R$ 75,00]
- FRANGO COM CATUPIRY: Frango, milho, ervilha, tomate, muçarela e catupiry. [R$ 75,00]
- FRANGO COM CHEDDAR E BACON: Frango, milho, ervilha, bacon, cheddar, muçarela e catupiry. [R$ 75,00]
- CALABRESA: Presunto, calabresa, muçarela, azeitona e catupiry. [R$ 75,00]
- CALABRESA COM CEBOLA: Presunto, calabresa, cebola, muçarela e catupiry. [R$ 75,00]
- CALABRESA NOBRE: Muçarela, calabresa, bacon, milho, azeitona, palmito, tomate, cheddar e catupiry. [R$ 75,00] (Acompanha batata palha à parte.)
- MODA DO PIZZAIOLO: Muçarela, calabresa, bacon, milho, ervilha e catupiry. [R$ 75,00]
- ESTROGONOFE DE BOI: Estrogonofe de carne bovina, muçarela e catupiry. [R$ 75,00] (Acompanha batata palha à parte.)
- ESTROGONOFE DE FRANGO: Estrogonofe de frango, muçarela e catupiry. [R$ 75,00] (Acompanha batata palha à parte.)
- VEGETARIANA ESPECIAL: Muçarela, tomate, milho, palmito, champignon, tomate seco, azeitona, catupiry e parmesão. [R$ 75,00]

Aviso do Cardápio: Feitas com ingredientes selecionados e muito carinho para você! ❤️`;

const app = express();
app.use(express.json());

async function generateGeminiResponse(userPhone, incomingText) {
  try {
    // Get existing conversation or initialize
    if (!conversationStore.has(userPhone)) {
      conversationStore.set(userPhone, []);
    }
    const history = conversationStore.get(userPhone);

    // Append user message
    history.push({ role: 'user', parts: [{ text: incomingText }] });

    // Limit context history to last 10 messages to keep responses fast
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }

    const payload = {
      contents: history,
      systemInstruction: {
        parts: [{ text: JESSICA_SYSTEM_PROMPT }]
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`Gemini API Error: ${response.statusText}`);
      return "Oi, amor! ❤️ Tive uma pequena oscilação na conexão. Pode me enviar novamente a mensagem ou nos chamar diretamente no WhatsApp +55 44 9702-1060? 🍕";
    }

    const data = await response.json();
    const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (botReply) {
      // Save bot reply to context
      history.push({ role: 'model', parts: [{ text: botReply }] });
      return botReply;
    }

    return "Desculpe, não consegui entender direitinho. Como posso te ajudar com o cardápio da Sabor com Afeto? 🍕❤️";
  } catch (err) {
    console.error("Erro ao chamar Gemini:", err);
    return "Oi! Tive uma falha técnica rápida. Por favor, tente novamente em instantes! ❤️";
  }
}

async function sendWhatsAppReply(destinationPhone, message) {
  try {
    const cleanPhone = destinationPhone.replace(/[^0-9]/g, '');
    const sendUrl = `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`;

    const payload = {
      number: cleanPhone,
      text: message
    };

    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log(`[WhatsApp Output] Mensagem enviada para ${cleanPhone}:`, result.status || 'OK');
  } catch (err) {
    console.error("Erro ao enviar mensagem pelo WhatsApp API:", err);
  }
}

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Standard Evolution API / Baileys webhook payload structure
    const isFromMe = body.data?.key?.fromMe;
    const remoteJid = body.data?.key?.remoteJid || '';
    const incomingMessage = body.data?.message?.conversation || 
                            body.data?.message?.extendedTextMessage?.text || '';

    // Ignore status updates, group chats, or messages sent by the bot itself
    if (isFromMe || remoteJid.includes('@g.us') || !incomingMessage) {
      return res.status(200).send({ status: 'ignored' });
    }

    const senderPhone = remoteJid.split('@')[0];
    console.log(`[WhatsApp Incoming] Mensagem de ${senderPhone}: "${incomingMessage}"`);

    // Generate response with Gemini
    const botReply = await generateGeminiResponse(senderPhone, incomingMessage);

    // Send response back to the customer
    await sendWhatsAppReply(senderPhone, botReply);

    return res.status(200).send({ status: 'success' });
  } catch (error) {
    console.error("Erro no processamento do Webhook:", error);
    return res.status(500).send({ error: 'Internal Server Error' });
  }
});

app.get('/', (req, res) => {
  res.send({
    botName: 'Jéssica',
    company: 'Sabor com Afeto',
    receptor: `+${RECEPTOR_PHONE}`,
    status: 'Online & Pronto para Atendimento (Vercel)'
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🍕 Robô Jéssica (Sabor com Afeto) Rodando!`);
    console.log(`📱 Número Receptor Cadastrado: +${RECEPTOR_PHONE}`);
    console.log(`🚀 Servidor Ativo na Porta: ${PORT}`);
    console.log(`===================================================`);
  });
}

export default app;
