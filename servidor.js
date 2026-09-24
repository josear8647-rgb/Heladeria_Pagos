const express = require('express');
const cors = require('cors');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Configuración de correo Gmail
const configImap = {
    user: 'TU_CORREO_GMAIL@gmail.com', // <--- Reemplaza con tu correo
    password: 'TU_CONTRASEÑA_DE_16_LETRAS', // <--- Reemplaza con tu clave de app
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

// Base de datos temporal en memoria
let pagoActual = { confirmado: false, monto: 0, fecha: null };
let registroVentas = []; // Historial de transferencias y pagos del día

// Función para obtener la fecha de hoy en formato YYYY-MM-DD
function getFechaHoy() {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
}

// Escuchar correos entrantes de Gmail
function iniciarEscuchaEmail() {
    const imap = new Imap(configImap);

    imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
            if (err) return console.error('Error al abrir la bandeja:', err);
            console.log('📬 Servidor escuchando transferencias de Bancolombia...');

            imap.on('mail', () => {
                const fetch = imap.seq.fetch(box.messages.total + ':*', { bodies: '' });
                fetch.on('message', (msg) => {
                    msg.on('body', (stream) => {
                        simpleParser(stream, async (err, parsed) => {
                            if (err) return;

                            const texto = parsed.text || '';
                            const asunto = parsed.subject || '';

                            // Filtro de correo de Bancolombia
                            if (asunto.includes('transferencia') || texto.includes('recibió') || texto.includes('abono')) {
                                const coincidenciaMonto = texto.match(/\$\s?([\d.,]+)/);
                                if (coincidenciaMonto) {
                                    const montoStr = coincidenciaMonto[1].replace(/\./g, '').replace(',', '.');
                                    const montoNum = parseFloat(montoStr);
                                    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

                                    pagoActual = {
                                        confirmado: true,
                                        monto: montoNum,
                                        fecha: horaActual
                                    };

                                    // Guardar en el historial del día
                                    registroVentas.push({
                                        id: Date.now(),
                                        monto: montoNum,
                                        hora: horaActual,
                                        tipo: 'Automática (Bancolombia)',
                                        fechaCompleta: getFechaHoy()
                                    });

                                    console.log(`✅ Transferencia detectada: $${montoNum}`);
                                }
                            }
                        });
                    });
                });
            });
        });
    });

    imap.once('error', (err) => console.error('Error IMAP:', err));
    imap.once('end', () => setTimeout(iniciarEscuchaEmail, 5000));
    imap.connect();
}

iniciarEscuchaEmail();

// RUTAS DE LA API

// 1. Consultar estado del pago actual
app.get('/estado-pago', (req, res) => {
    res.json(pagoActual);
});

// 2. Limpiar aviso de pago actual para la siguiente venta
app.post('/limpiar-pago', (req, res) => {
    pagoActual = { confirmado: false, monto: 0, fecha: null };
    res.json({ status: 'ok' });
});

// 3. Obtener el resumen del día (Total acumulado y lista de transferencias)
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

// 4. Agregar una transferencia o pago manualmente
app.post('/agregar-manual', (req, res) => {
    const { monto, descripcion } = req.body;
    
    if (!monto || isNaN(monto) || monto <= 0) {
        return res.status(400).json({ error: 'Monto inválido' });
    }

    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const nuevaVenta = {
        id: Date.now(),
        monto: parseFloat(monto),
        hora: horaActual,
        tipo: descripcion || 'Manual / Efectivo',
        fechaCompleta: getFechaHoy()
    };

    registroVentas.push(nuevaVenta);
    res.json({ status: 'ok', venta: nuevaVenta });
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});