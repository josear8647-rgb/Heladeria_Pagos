const express = require('express');
const cors = require('cors');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

const app = express();
app.use(cors());
app.use(express.json());

// Sirve los archivos estáticos (tu página web)
app.use(express.static('public'));

let ultimoPago = {
    monto: 0,
    estado: 'esperando',
    fecha: null
};

// Configuración para conectarse a tu Gmail
const configGmail = {
    imap: {
        user: 'TU_CORREO_AQUI@gmail.com', // 👈 Escribe aquí tu correo de Gmail
        password: 'xxxx xxxx xxxx xxxx', // 👈 Pega aquí la clave de 16 letras
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

// Función para revisar los correos de Bancolombia / Nequi
async function revisarCorreos() {
    try {
        const connection = await imaps.connect(configGmail);
        await connection.openBox('INBOX');

        // Busca correos no leídos que contengan palabras de transferencia
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: true };

        const messages = await connection.search(searchCriteria, fetchOptions);

        for (let item of messages) {
            const all = item.parts.find(part => part.which === '');
            const parsed = await simpleParser(all.body);

            const asunto = parsed.subject || '';
            const texto = parsed.text || '';

            console.log('📬 Nuevo correo recibido:', asunto);

            // Filtramos si el correo viene de Bancolombia o Nequi
            if (asunto.includes('Transferencia') || asunto.includes('Recibiste') || texto.includes('Bancolombia') || texto.includes('Nequi')) {
                // Buscamos un monto de dinero dentro del texto (ej: $12.000 o 12000)
                const coincidenciaMonto = texto.match(/\$\s?([0-9.,]+)/) || texto.match(/([0-9.,]+)\s?COP/);

                let montoDetectado = 'Confirmado';
                if (coincidenciaMonto) {
                    montoDetectado = coincidenciaMonto[0];
                }

                console.log(`✅ ¡Pago detectado! Monto: ${montoDetectado}`);

                ultimoPago = {
                    monto: montoDetectado,
                    estado: 'pagado',
                    fecha: new Date().toLocaleTimeString()
                };
            }
        }

        connection.end();
    } catch (error) {
        console.error('Error al revisar el correo:', error.message);
    }
}

// Revisa el correo automáticamente cada 10 segundos
setInterval(revisarCorreos, 10000);

// Ruta para que la página de la caja consulte el estado del pago
app.get('/estado-pago', (req, res) => {
    res.json(ultimoPago);
});

// Ruta para reiniciar el estado de la caja a "Esperando"
app.post('/reiniciar', (req, res) => {
    ultimoPago = { monto: 0, estado: 'esperando', fecha: null };
    res.json({ mensaje: 'Caja reiniciada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});