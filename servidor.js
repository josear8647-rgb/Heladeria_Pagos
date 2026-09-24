const express = require('express');
const path = require('path');

const app = express();

// Permitir que el servidor entienda datos en formato JSON y texto
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir la página web del cajero (index.html)
app.use(express.static(path.join(__dirname)));

// Variable en memoria para guardar temporalmente el último pago recibido
let ultimoPagoRegistrado = null;

// RUTA WEBHOOK: Recibe los datos enviados desde Make, MacroDroid o pruebas manuales
// Acepta tanto /webhook como /alerta-bancolombia
app.post(['/webhook', '/alerta-bancolombia'], (req, res) => {
    console.log("------------------------------------------------");
    console.log("🔔 ¡NUEVA NOTIFICACIÓN / BANCO RECIBIDA!");
    console.log("Datos recibidos:", JSON.stringify(req.body, null, 2));

    let textoNotificacion = "";
    let montoDetectado = 0;
    let bancoDetectado = "Bancolombia";

    // 1. Extraer el texto disponible desde los datos enviados
    if (req.body) {
        if (typeof req.body === 'string') {
            textoNotificacion = req.body;
        } else {
            // Revisa si Make o el correo enviaron texto en diferentes campos
            textoNotificacion = req.body.monto || req.body.texto || req.body.text || req.body.subject || req.body.body || JSON.stringify(req.body);
        }
    }

    // 2. Buscar dinámicamente un valor en dinero dentro del texto (Ej: $12.000, 12,000 COP, etc.)
    let coincidencia = textoNotificacion.match(/\$?\s*([\d\.\,]+)/);

    if (coincidencia && coincidencia[1]) {
        // Limpiamos los puntos o comas para obtener el número entero
        let numeroLimpio = coincidencia[1].replace(/\./g, '').replace(',', '');
        let valorEfectivo = parseInt(numeroLimpio, 10);

        // Validamos que sea un número coherente
        if (!isNaN(valorEfectivo) && valorEfectivo > 0) {
            montoDetectado = valorEfectivo;
        }
    }

    // Si Make envió directamente un número claro en la variable 'monto'
    if (typeof req.body.monto === 'number') {
        montoDetectado = req.body.monto;
    }

    // Identificar banco si viene en la petición
    if (req.body.banco) {
        bancoDetectado = req.body.banco;
    }

    // Si encontramos un monto válido, guardamos la transferencia
    if (montoDetectado > 0) {
        ultimoPagoRegistrado = {
            monto: montoDetectado,
            banco: bancoDetectado,
            fecha: new Date().toLocaleTimeString('es-CO')
        };
        console.log(`✅ ¡PAGO EXTRAÍDO CON ÉXITO! Monto: $${montoDetectado} COP`);
    } else {
        console.log("⚠️ Se recibió la alerta pero no se pudo extraer un monto numérico válido.");
    }

    // Responder a Make / Cliente HTTP con respuesta exitosa
    res.status(200).send('Notificación recibida y procesada correctamente');
});

// RUTA CONSULTA: La pantalla consulta esta ruta constantemente para actualizarse
app.get('/consultar-pago', (req, res) => {
    if (ultimoPagoRegistrado) {
        let pagoAEnviar = ultimoPagoRegistrado;
        ultimoPagoRegistrado = null; // Se borra para no repetir la alerta en pantalla
        res.json({ nuevoPago: true, pago: pagoAEnviar });
    } else {
        res.json({ nuevoPago: false });
    }
});

// Ruta principal para cargar el archivo HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Configuración de puerto para Render o entorno local
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});