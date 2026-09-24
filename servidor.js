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

// Configuración de conexión con tu cuenta de Gmail
const configGmail = {
    imap: {
        user: 'TU_CORREO_AQUI@gmail.com', // 👈 Reemplaza por tu correo de Gmail
        password: 'xxxx xxxx xxxx xxxx', // 👈 Reemplaza por tu contraseña de aplicación de 16 letras
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

// Función que revisa los correos no leídos en búsqueda de transferencias
async function revisarCorreos() {
    try {
        const connection = await imaps.connect(configGmail);
        await connection.openBox('INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: true };

        const messages = await connection.search(searchCriteria, fetchOptions);

        for (let item of messages) {
            const all = item.parts.find(part => part.which === '');
            const parsed = await simpleParser(all.body);

            const asunto = parsed.subject || '';
            const texto = parsed.text || '';

            console.log('📬 Nuevo correo detectado:', asunto);

            // Verificación de mensajes provenientes de Bancolombia o Nequi
            if (asunto.includes('Transferencia') || asunto.includes('Recibiste') || texto.includes('Bancolombia') || texto.includes('Nequi')) {
                const coincidenciaMonto = texto.match(/\$\s?([0-9.,]+)/) || texto.match(/([0-9.,]+)\s?COP/);

                let montoDetectado = 'Confirmado';
                if (coincidenciaMonto) {
                    montoDetectado = coincidenciaMonto[0];
                }

                console.log(`✅ ¡Pago confirmado! Monto: ${montoDetectado}`);

                ultimoPago = {
                    monto: montoDetectado,
                    estado: 'pagado',
                    fecha: new Date().toLocaleTimeString()
                };
            }
        }

        connection.end();
    } catch (error) {
        console.error('Error al consultar el correo:', error.message);
    }
}

// Ejecuta la revisión automática cada 10 segundos
setInterval(revisarCorreos, 10000);

// Ruta principal para servir el archivo index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta API para obtener el estado actual del pago
app.get('/estado-pago', (req, res) => {
    res.json(ultimoPago);
});

// Ruta API para reiniciar la caja para el siguiente cliente
app.post('/reiniciar', (req, res) => {
    ultimoPago = { monto: 0, estado: 'esperando', fecha: null };
    res.json({ mensaje: 'Caja reiniciada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en el puerto ${PORT}`);
});