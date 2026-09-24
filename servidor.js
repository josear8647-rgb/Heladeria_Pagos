const express = require('express');
const cors = require('cors');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Estado en memoria de la última transferencia recibida
let ultimoPago = {
    monto: 0,
    estado: 'esperando',
    fecha: null
};

// Configuración de credenciales de Gmail
const configGmail = {
    imap: {
        user: 'josear8647@gmail.com', // 👈 Reemplaza por tu correo de Gmail
        password: 'ucqx fdqp hfmm czvd', // 👈 Reemplaza por tu clave de aplicación de 16 letras de Google
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

// Función principal para escanear correos no leídos
async function revisarCorreos() {
    try {
        const connection = await imaps.connect(configGmail);
        await connection.openBox('INBOX');

        // Busca solo correos no leídos (UNSEEN)
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: true };

        const messages = await connection.search(searchCriteria, fetchOptions);

        for (let item of messages) {
            const all = item.parts.find(part => part.which === '');
            const parsed = await simpleParser(all.body);

            const asunto = parsed.subject || '';
            const texto = parsed.text || '';

            console.log('📬 Nuevo correo detectado:', asunto);

            // Verificación si proviene de alertas de Bancolombia o Nequi
            const esBancolombiaONequi = 
                asunto.toLowerCase().includes('transferencia') || 
                asunto.toLowerCase().includes('recibiste') || 
                texto.toLowerCase().includes('bancolombia') || 
                texto.toLowerCase().includes('nequi');

            if (esBancolombiaONequi) {
                // Expresión regular para extraer montos (ej: $12.000, $12000, 12.000 COP)
                const coincidenciaMonto = texto.match(/\$\s?([0-9.,]+)/) || texto.match(/([0-9.,]+)\s?COP/);

                let montoDetectado = 'Confirmado';
                if (coincidenciaMonto) {
                    montoDetectado = coincidenciaMonto[0];
                }

                console.log(`✅ ¡Pago confirmado! Monto: ${montoDetectado}`);

                ultimoPago = {
                    monto: montoDetectado,
                    estado: 'pagado',
                    fecha: new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })
                };
            }
        }

        connection.end();
    } catch (error) {
        console.error('Error en la conexión o lectura de Gmail:', error.message);
    }
}

// Revisa la bandeja de entrada automáticamente cada 10 segundos
setInterval(revisarCorreos, 10000);

// Ruta para cargar la página web principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint que consulta la pantalla del cajero en tiempo real
app.get('/estado-pago', (req, res) => {
    res.json(ultimoPago);
});

// Endpoint para reiniciar la caja a "Esperando"
app.post('/reiniciar', (req, res) => {
    ultimoPago = { monto: 0, estado: 'esperando', fecha: null };
    res.json({ mensaje: 'Caja reiniciada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor de la Heladería escuchando en el puerto ${PORT}`);
});