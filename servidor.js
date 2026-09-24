const express = require('express');
const path = require('path');

const app = express();

// Permitir que el servidor lea datos en formato JSON
app.use(express.json());

// Servir la página web del cajero (index.html)
app.use(express.static(path.join(__dirname)));

// Variable en memoria para guardar temporalmente el último pago recibido
let ultimoPagoRegistrado = null;

// RUTA WEBHOOK: Aquí entran las notificaciones de transferencia (Thunder Client o Banco)
app.post('/webhook', (req, res) => {
    const { monto, banco } = req.body;

    console.log("🔔 ¡NUEVA TRANSFERENCIA RECIBIDA!");
    console.log("Datos:", req.body);

    // Guardamos la transferencia recibida
    ultimoPagoRegistrado = {
        monto: monto || 12000,
        banco: banco || 'Bancolombia',
        fecha: new Date().toLocaleTimeString('es-CO')
    };

    // Confirmación que recibe Thunder Client
    res.status(200).send('Webhook recibido con éxito');
});

// RUTA CONSULTA: La página web llamará a esta ruta cada 2 segundos para ver si hay un pago nuevo
app.get('/consultar-pago', (req, res) => {
    if (ultimoPagoRegistrado) {
        let pagoAEnviar = ultimoPagoRegistrado;
        ultimoPagoRegistrado = null; // Se limpia para que no repita la alerta indefinidamente
        res.json({ nuevoPago: true, pago: pagoAEnviar });
    } else {
        res.json({ nuevoPago: false });
    }
});

// Ruta principal para cargar la pantalla
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Configuración de puerto dinámico para Render
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});