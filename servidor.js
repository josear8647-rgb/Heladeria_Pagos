const express = require('express');
const path = require('path');

const app = express();

// Middleware para entender JSON (necesario para cuando el banco envíe notificaciones)
app.use(express.json());

// Servir la pantalla principal (asegúrate de que tu HTML se llame 'index.html' o cambia el nombre abajo)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta Webhook: Aquí recibirá las notificaciones de transferencia de Bancolombia / Wompi
app.post('/webhook', (req, res) => {
    const evento = req.body;

    console.log('🔔 Notificación recibida del banco:', evento);

    // Respuesta 200 para confirmarle al banco que recibimos el mensaje
    res.status(200).send('Webhook recibido con éxito');
});

// Configuración dinámica del puerto (Paso clave para Render)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});