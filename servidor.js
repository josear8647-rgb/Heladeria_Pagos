const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar servidor para recibir datos JSON y servir archivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// Variable en memoria para guardar el último pago
let ultimoPagoRegistrado = null;

// RUTA PRINCIPAL: Muestra la pantalla de la heladería
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// RUTA CONSULTA: La pantalla pregunta cada segundo si hay un nuevo pago
app.get('/api/ultimo-pago', (req, res) => {
    res.json(ultimoPagoRegistrado || { mensaje: 'Sin pagos nuevos' });
});

// RUTA WEBHOOK: Recibe los pagos de Wompi / Bancolombia o de Thunder Client
app.post('/webhook', (req, res) => {
    console.log("🔔 ¡NOTIFICACIÓN DE PAGO RECIBIDA EN /webhook!");
    console.log(JSON.stringify(req.body, null, 2));

    let montoRecibido = 0;
    let bancoRecibido = 'Bancolombia / Nequi';
    let detalleRecibido = 'Transferencia confirmada';

    // 1. Si la notificación viene de Wompi (Pago Real por QR)
    if (req.body && req.body.event === 'transaction.updated') {
        const transaccion = req.body.data.transaction;
        if (transaccion.status === 'APPROVED') {
            montoRecibido = transaccion.amount_in_cents / 100; // Wompi envía en centavos
            bancoRecibido = transaccion.payment_method_type || 'Bancolombia QR';
            detalleRecibido = `Ref Wompi: ${transaccion.id}`;
        } else {
            return res.status(200).send('Transacción no aprobada ignorada');
        }
    } 
    // 2. Si es una prueba manual desde Thunder Client / Postman
    else if (req.body && req.body.monto) {
        montoRecibido = req.body.monto;
        bancoRecibido = req.body.banco || 'Bancolombia (Prueba)';
        detalleRecibido = req.body.concepto || 'Prueba de transferencia';
    }

    // Si el pago es válido, guardamos los datos para enviarlos a la pantalla
    if (montoRecibido > 0) {
        ultimoPagoRegistrado = {
            id: Date.now(),
            monto: montoRecibido,
            banco: bancoRecibido,
            concepto: detalleRecibido,
            fecha: new Date().toLocaleTimeString('es-CO')
        };
        console.log(`✅ Pago guardado con éxito: $${montoRecibido} COP`);
    }

    // Responder siempre con 200 OK
    res.status(200).json({ status: 'OK', mensaje: 'Notificación procesada' });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});