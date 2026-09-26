const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

// Estado del pago activo para la pantalla
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
// Función para extraer montos numéricos desde texto largo
// Función para extraer montos numéricos desde texto largo
function extraerMonto(texto) {
    if (typeof texto === 'number') return texto;
    if (!texto) return 0;

    // Convertir a texto y minúsculas
    const textoMinusculas = String(texto).toLowerCase();

    // Ver en la consola qué texto está llegando exactamente
    console.log("📩 Texto recibido en servidor:", textoMinusculas);

    // FILTRO DE TRANSACCIONES SALIENTES (PAGOS/ENVIOS TUYOS)
    if (textoMinusculas.includes("transferiste") || 
        textoMinusculas.includes("enviaste") || 
        textoMinusculas.includes("compra") || 
        textoMinusculas.includes("pago realizado") ||
        textoMinusculas.includes("pagaste") ||
        textoMinusculas.includes("envio exitoso") ||
        textoMinusculas.includes("envío exitoso") ||
        textoMinusculas.includes("transferencia a") ||
        textoMinusculas.includes("debito") ||
        textoMinusculas.includes("débito") ||
        textoMinusculas.includes("salida")) {
        
        console.log("⚠️ Notificación ignorada: Es una transferencia saliente o pago tuyo.");
        return 0; // Devuelve 0 para no registrar nada
    }

    // Extraer el valor del dinero
    let coincidencia = textoMinusculas.match(/\$?\s*([\d\.\,]+)/);
    if (coincidencia && coincidencia[1]) {
        let numeroLimpio = coincidencia[1].replace(/\./g, '').replace(',', '');
        let valorNumerico = parseInt(numeroLimpio, 10);
        if (!isNaN(valorNumerico)) return valorNumerico;
    }

    return 0;
}
// Función para extraer montos numéricos desde texto largo

// 1. RUTA RECEPTORA DE NOTIFICACIONES (MacroDroid / Webhooks)
app.post('/alerta-bancolombia', (req, res) => {
    console.log("🔔 ¡NOTIFICACIÓN AUTOMÁTICA RECIBIDA!");
    console.log("Datos recibidos:", req.body);

    const { monto, referencia } = req.body;
    const montoNum = extraerMonto(monto);
    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (montoNum > 0) {
        // ACTIVA LA PANTALLA VERDE EN TIEMPO REAL
        pagoActual = {
            confirmado: true,
            monto: montoNum,
            fecha: horaActual,
            referencia: referencia || 'Bancolombia/Nequi'
        };

        // GUARDA EN EL HISTORIAL DIARIO
        registroVentas.push({
            id: Date.now(),
            monto: montoNum,
            hora: horaActual,
            tipo: 'Transferencia (Auto)',
            referencia: referencia || 'Bancolombia/Nequi',
            fechaCompleta: getFechaHoy()
        });

        console.log(`✅ Venta automática registrada: $${montoNum} (${pagoActual.referencia})`);
    } else {
        console.log("⚠️ No se pudo extraer un monto válido del mensaje.");
    }

    res.status(200).send('OK');
});

// 2. Consulta estado de pago en pantalla (Polling cada 2s)
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
    console.log(`🚀 Servidor ejecutándose correctamente en el puerto ${PORT}`);
});