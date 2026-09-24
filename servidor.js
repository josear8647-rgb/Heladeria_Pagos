const express = require('express');
const cors = require('cors');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

let ultimoPago = {
    monto: 0,
    estado: 'esperando',
    fecha: null
};

// Configuración de credenciales de Gmail
const configGmail = {
    imap: {
        user: 'josear8647@gmail.com', // 👈 Pon tu correo
        password: 'znipmuntqwnculhf', // 👈 Pon tu clave de aplicación de 16 letras
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

let revisando = false;

async function revisarCorreos() {
    if (revisando) return; // Evita acumular tareas si una revisión tarda
    revisando = true;

    let connection;
    try {
        connection = await imaps.connect(configGmail);
        await connection.openBox('INBOX');

        // Solo busca correos NO leídos
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };

        const messages = await connection.search(searchCriteria, fetchOptions);

        for (let item of messages) {
            const textPart = item.parts.find(part => part.which === 'TEXT');
            const headerPart = item.parts.find(part => part.which === 'HEADER');

            const asunto = headerPart?.body?.subject?.[0] || '';
            const texto = textPart?.body || '';

            console.log('📬 Correo no leído detectado:', asunto);

            const esBancolombiaONequi = 
                asunto.toLowerCase().includes('transferencia') || 
                asunto.toLowerCase().includes('recibiste') || 
                texto.toLowerCase().includes('bancolombia') || 
                texto.toLowerCase().includes('nequi');

            if (esBancolombiaONequi) {
                const coincidenciaMonto = texto.match(/\$\s?([0-9.,]+)/) || texto.match(/([0-9.,]+)\s?COP/);
                let montoDetectado = coincidenciaMonto ? coincidenciaMonto[0] : 'Confirmado';

                console.log(`✅ ¡Pago detectado!: ${montoDetectado}`);

                ultimoPago = {
                    monto: montoDetectado,
                    estado: 'pagado',
                    fecha: new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })
                };
            }
        }
    } catch (error) {
        console.error('Error al revisar correo:', error.message);
    } finally {
        if (connection) {
            try { connection.end(); } catch(e) {}
        }
        revisando = false;
    }
}

// Revisa cada 20 segundos para ahorrar memoria RAM en Render
setInterval(revisarCorreos, 10000);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/estado-pago', (req, res) => {
    res.json(ultimoPago);
});

app.post('/reiniciar', (req, res) => {
    ultimoPago = { monto: 0, estado: 'esperando', fecha: null };
    res.json({ mensaje: 'Caja reiniciada' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en puerto ${PORT}`);
});