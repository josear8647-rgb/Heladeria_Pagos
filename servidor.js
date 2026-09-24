const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Base de datos temporal en memoria
let pagoActual = { confirmado: false, monto: 0, fecha: null, referencia: '' };
let registroVentas = []; // Historial diario

function getFechaHoy() {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
}

// Servir la pantalla de la heladería
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. RUTA INSTANTÁNEA (Make / Webhook / Nequi / Bancolombia)
app.post('/alerta-bancolombia', (req, res) => {
    const { monto, referencia } = req.body;
    const montoNum = parseFloat(monto) || 0;
    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (montoNum > 0) {
        pagoActual = {
            confirmado: true,
            monto: montoNum,
            fecha: horaActual,
            referencia: referencia || 'N/A'
        };

        registroVentas.push({
            id: Date.now(),
            monto: montoNum,
            hora: horaActual,
            tipo: 'Transferencia (Auto)',
            referencia: referencia || 'N/A',
            fechaCompleta: getFechaHoy()
        });

        console.log(`⚡ Pago automático registrado: $${montoNum} - Ref: ${referencia}`);
    }

    res.status(200).send('OK');
});

// 2. Consulta estado de pago en pantalla
app.get('/estado-pago', (req, res) => {
    res.json(pagoActual);
});

// 3. Confirmar y limpiar pantalla para la siguiente venta
app.post('/limpiar-pago', (req, res) => {
    pagoActual = { confirmado: false, monto: 0, fecha: null, referencia: '' };
    res.json({ status: 'ok' });
});

// 4. Obtener contabilidad y resumen del día
app.get('/ventas-dia', (req, res) => {
    const fechaHoy = getFechaHoy();
    const ventasHoy = registroVentas.filter(v => v.fechaCompleta === fechaHoy);
    const totalAcumulado = ventasHoy.reduce((acc, curr) => acc + curr.monto, 0);

    res.json({
        total: totalAcumulado,
        cantidad: ventasHoy.length,
        ventas: ventasHoy
    });
});

// 5. Agregar registro manual (Efectivo / Transferencia manual)
app.post('/agregar-manual', (req, res) => {
    const { monto, descripcion } = req.body;
    const montoNum = parseFloat(monto);

    if (!montoNum || montoNum <= 0) {
        return res.status(400).json({ error: 'Monto no válido' });
    }

    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const nuevaVenta = {
        id: Date.now(),
        monto: montoNum,
        hora: horaActual,
        tipo: descripcion || 'Efectivo / Manual',
        referencia: 'Manual',
        fechaCompleta: getFechaHoy()
    };

    registroVentas.push(nuevaVenta);
    res.json({ status: 'ok', venta: nuevaVenta });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});