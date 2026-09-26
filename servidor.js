const express = require('express');
const path = require('path');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Bases de datos en memoria para el turno
let historialPagos = [];
let ultimoPagoRegistrado = null;

/**
 * 1. RUTA AUTOMÁTICA (WEBHOOK / MACRODROID / MAKE)
 * Recibe las notificaciones enviadas automáticamente por el celular
 */
app.post(['/webhook', '/alerta-bancolombia'], (req, res) => {
    console.log("\n🔔 ¡NOTIFICACIÓN AUTOMÁTICA RECIBIDA!");
    console.log("Datos recibidos:", req.body);

    try {
        const montoRaw = req.body.monto || req.body.valor || req.body.amount;
        const bancoRaw = req.body.banco || req.body.referencia || req.body.origen || 'Bancolombia';

        let montoFinal = 0;

        // Si es prueba manual sin notificación real
        if (!montoRaw || montoRaw === "" || montoRaw === "[not_text]") {
            console.log("⚠️ Prueba manual detectada. Asignando monto de prueba.");
            montoFinal = 10000;
        } else {
            // Extraer solo números
            const soloNumeros = String(montoRaw).replace(/[^0-9]/g, '');

            if (soloNumeros.length > 0) {
                montoFinal = parseInt(soloNumeros, 10);
                if (montoFinal > 1000000 && soloNumeros.endsWith("00")) {
                    montoFinal = montoFinal / 100;
                }
            } else {
                montoFinal = 10000;
            }
        }

        const pago = {
            id: Date.now(),
            banco: bancoRaw,
            monto: montoFinal,
            referencia: 'Automática',
            hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            tipo: 'Automatico'
        };

        // Guardar para la alerta emergente y en el historial
        ultimoPagoRegistrado = pago;
        historialPagos.push(pago);

        console.log(`✅ Venta automática registrada: $${montoFinal} (${bancoRaw})`);

        return res.status(200).json({
            exito: true,
            mensaje: "Notificación procesada con éxito",
            pago
        });

    } catch (error) {
        console.error("❌ Error procesando webhook:", error);
        return res.status(200).json({ exito: false, mensaje: "Error interno pero recibido" });
    }
});

/**
 * 2. RUTA MANUAL (VERIFICACIÓN EN CAJA POR REFERENCIA)
 * Usada cuando el cajero ingresa el monto y los 4 dígitos manualmente
 */
app.post('/registrar-pago', (req, res) => {
    const { banco, monto, referencia } = req.body;

    // Control de comprobantes duplicados
    const repetido = historialPagos.find(p => p.referencia === referencia && p.banco === banco && p.referencia !== 'Automática');

    if (repetido) {
        return res.status(400).json({
            exito: false,
            mensaje: `El comprobante (Ref: ${referencia}) YA FUE USADO anteriormente a las ${repetido.hora}.`
        });
    }

    const nuevoPago = {
        id: Date.now(),
        banco: banco || 'Bancolombia',
        monto: Number(monto),
        referencia: referencia || 'Manual',
        hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        tipo: 'Manual'
    };

    historialPagos.push(nuevoPago);

    console.log(`\n💵 Venta manual registrada: $${monto} | Banco: ${banco} | Ref: ${referencia}`);

    res.json({ exito: true, pago: nuevoPago });
});

/**
 * 3. RUTA CONSULTA EN TIEMPO REAL (PANTALLA CAJERO)
 */
app.get('/consultar-pago', (req, res) => {
    if (ultimoPagoRegistrado) {
        let pagoAEnviar = ultimoPagoRegistrado;
        ultimoPagoRegistrado = null; // Limpia la alerta para no repetirla
        res.json({ nuevoPago: true, pago: pagoAEnviar });
    } else {
        res.json({ nuevoPago: false });
    }
});

/**
 * 4. RUTA HISTORIAL DEL TURNO
 */
app.get('/historial', (req, res) => {
    res.json(historialPagos);
});

// Ruta de inicio
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicio del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose correctamente en http://localhost:${PORT}`);
});