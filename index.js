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
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    if (update.connection === 'open') {
      console.log('Conectado a WhatsApp');
    }
    if (update.qr) {
      console.log('Escanea este QR:');
      qrcode.generate(update.qr, { small: true }); // Muestra QR en consola
    }
    if (update.connection === 'close') {
      console.log('Conexión cerrada, intentando reconectar...');
      setTimeout(startBot, 5000);
    }
  });

  // Escuchar mensajes entrantes
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    console.log('Mensaje recibido:', msg); // Log para ver el mensaje
    if (!msg.message || msg.key.fromMe) return;
    
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    console.log('Texto recibido:', text); // Verifica el texto recibido

    // Si el mensaje es "imagen", enviar una imagen
    if (text.toLowerCase() === 'imagen') {
      try {
        const imagePath = path.join(__dirname, 'prueba.png');
        const imageBuffer = await fs.readFile(imagePath);
        console.log('Imagen leída con éxito'); // Log para verificar si la imagen se lee correctamente
        await sock.sendMessage(from, {
          text: '¡Aquí tienes la imagen!',
          image: { mimetype: 'image/png', data: imageBuffer },
        });
        console.log(`Imagen enviada a ${from}`);
      } catch (error) {
        console.error('Error al enviar imagen:', error);
        await sock.sendMessage(from, { text: 'Lo siento, ocurrió un error al enviar la imagen.' });
      }
    }
  });

  // Endpoint para enviar mensajes desde el CRM
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
        text,
        image: { mimetype: 'image/png', data: imageBuffer },
      });
      res.json({ status: 'success', message: 'Mensaje e imagen enviados' });
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return sock;
}

// Iniciar servidor y bot
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
  startBot();
});

// Ruta de prueba
app.get('/', (req, res) => res.send('Bot de WhatsApp activo'));
