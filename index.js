const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const qrcode = require('qrcode-terminal');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const sock = makeWASocket({
    version: (await fetchLatestBaileysVersion()).version,
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (connection === 'open') console.log('✅ Conectado a WhatsApp');
    if (qr) {
      console.log('📲 Escanea este QR:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      console.log('🔄 Conexión cerrada. Reconectando...');
      setTimeout(startBot, 5000);
    }
  });

  // Escuchar mensajes entrantes
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (text.toLowerCase() === 'imagen') {
      try {
        const imagePath = path.join(__dirname, 'prueba.png');
        const imageBuffer = await fs.readFile(imagePath);
        console.log('📸 Imagen cargada con', imageBuffer.length, 'bytes');

        await sock.sendMessage(from, {
          image: imageBuffer,
          caption: '¡Aquí tienes la imagen!',
          mimetype: 'image/png'
        });

        console.log(`✅ Imagen enviada a ${from}`);
      } catch (error) {
        console.error('❌ Error al enviar imagen:', error);
        await sock.sendMessage(from, { text: 'Ocurrió un error al enviar la imagen.' });
      }
    }
  });

  // Endpoint para enviar desde el CRM
  app.post('/send', async (req, res) => {
    const { to, text } = req.body;
    if (!to || !text) {
      return res.status(400).json({ status: 'error', message: 'Faltan parámetros: to, text' });
    }

    try {
      const formattedNumber = to.startsWith('+') ? to.slice(1) : to;
      const imagePath = path.join(__dirname, 'prueba.png');
      const imageBuffer = await fs.readFile(imagePath);

      await sock.sendMessage(`${formattedNumber}@s.whatsapp.net`, {
        image: imageBuffer,
        caption: text,
        mimetype: 'image/png'
      });

      res.json({ status: 'success', message: '✅ Mensaje e imagen enviados' });
    } catch (error) {
      console.error('❌ Error al enviar desde API:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return sock;
}

// Iniciar servidor y bot
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  startBot();
});

// Ruta de prueba
app.get('/', (req, res) => res.send('🤖 Bot de WhatsApp activo'));
