const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const ARCHIVO_HISTORIAL = path.join(__dirname, 'contabilidad.json');

// Función para cargar el historial guardado en el archivo
function cargarHistorial() {
    try {
        if (fs.existsSync(ARCHIVO_HISTORIAL)) {
            const datos = fs.readFileSync(ARCHIVO_HISTORIAL, 'utf8');
            return JSON.parse(datos);
        }
    } catch (error) {
        console.error("Error al leer contabilidad.json:", error);
    }
    return [];
}

// Función para guardar permanentemente en el archivo
function guardarHistorial(historial) {
    try {
        fs.writeFileSync(ARCHIVO_HISTORIAL, JSON.stringify(historial, null, 2), 'utf8');
    } catch (error) {
        console.error("Error al guardar contabilidad.json:", error);
    }
}

let ultimoPagoRegistrado = null;
let historialPagos = cargarHistorial(); // Carga las ventas anteriores guardadas

// RUTA WEBHOOK
app.post(['/webhook', '/alerta-bancolombia'], (req, res) => {
    console.log("--------------------------------------------------");
    console.log("🔔 ¡NUEVA TRANSFERENCIA DETECTADA!");

    let textoNotificacion = "";
    let montoDetectado = 0;
    let bancoDetectado = "Bancolombia";

    if (req.body) {
        if (typeof req.body === 'string') {
            textoNotificacion = req.body;
        } else {
            textoNotificacion = req.body.monto || req.body.texto || req.body.text || 
                                req.body.subject || req.body.body || JSON.stringify(req.body);
        }
    }

    let coincidencia = textoNotificacion.match(/\$?\s*([\d\.\,]+)/);

    if (coincidencia && coincidencia[1]) {
        let numeroLimpio = coincidencia[1].replace(/\./g, '').replace(',', '');
        let valorNumerico = parseInt(numeroLimpio, 10);

        if (!isNaN(valorNumerico) && valorNumerico > 0) {
            montoDetectado = valorNumerico;
        }
    }

    if (typeof req.body.monto === 'number') {
        montoDetectado = req.body.monto;
    }

    if (req.body.banco) {
        bancoDetectado = req.body.banco;
    }

    if (montoDetectado > 0) {
        let nuevoPago = {
            id: Date.now(),
            monto: montoDetectado,
            banco: bancoDetectado,
            fecha: new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })
        };

        ultimoPagoRegistrado = nuevoPago;
        historialPagos.unshift(nuevoPago);

        // Guardar permanentemente en disco
        guardarHistorial(historialPagos);

        console.log(`✅ ¡PAGO DE $${montoDetectado} GUARDADO EN CONTABILIDAD!`);
    }

    res.status(200).send('Procesado');
});

// Consultar último pago para la alerta verde
app.get('/consultar-pago', (req, res) => {
    if (ultimoPagoRegistrado) {
        let pagoAEnviar = ultimoPagoRegistrado;
        ultimoPagoRegistrado = null;
        res.json({ nuevoPago: true, pago: pagoAEnviar });
    } else {
        res.json({ nuevoPago: false });
    }
});

// Consultar todo el historial guardado
app.get('/historial', (req, res) => {
    res.json({ historial: historialPagos });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});