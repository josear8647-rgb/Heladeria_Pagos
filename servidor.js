const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('./'));

let ultimoPagoRegistrado = null;

// RUTA QUE RECIBIRÁ LAS NOTIFICACIONES REALES O DE PRUEBA DEL BANCO
app.post('/webhook-banco', (req, res) => {
    const { monto, banco } = req.body;

    console.log(`\n🔔 ¡TRANSFERENCIA DETECTADA!`);
    console.log(`💰 Monto: $${monto} COP | Banco: ${banco || 'Bancolombia'}`);

    // Guardamos el pago para que la pantalla del cajero lo lea
    ultimoPagoRegistrado = {
        monto: monto || 15000,
        banco: banco || 'Bancolombia',
        fecha: new Date()
    };

    res.status(200).send({ status: "OK", mensaje: "Notificación procesada con éxito" });
});

// RUTA QUE LA PÁGINA CONSULTA SEGUNDO A SEGUNDO
app.get('/ultimo-pago', (res, resOut) => {
    if (ultimoPagoRegistrado) {
        let pagoEnviar = ultimoPagoRegistrado;
        ultimoPagoRegistrado = null; // Limpiar para no repetir la alerta
        resOut.json({ nuevoPago: true, monto: pagoEnviar.monto, banco: pagoEnviar.banco });
    } else {
        resOut.json({ nuevoPago: false });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de la heladería corriendo en http://localhost:${PORT}`);
});