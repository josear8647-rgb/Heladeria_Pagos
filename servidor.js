const express = require('express');
const cors = require('cors');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');

const app = express();
app.use(cors());
app.use(express.json());

// Guardamos el estado del último pago
let ultimoPago = {
    confirmado: false,
    monto: 0,
    fecha: null
};

// Configuración de Gmail
// (Reemplaza con el correo de la heladería y la contraseña de 16 letras de Google)
const configImap = {
    user: 'josear8647@gmail.com',
    password: 'ucqx fdqp hfmm czvd',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

function revisarCorreos() {
    const imap = new Imap(configImap);

    imap.once('ready', function() {
        imap.openBox('INBOX', false, function(err, box) {
            if (err) return;

            // Buscamos correos NO LEÍDOS recibidos de Bancolombia
            imap.search(['UNSEEN', ['HEADER', 'FROM', 'bancolombia']], function(err, results) {
                if (err || !results.length) {
                    imap.end();
                    return;
                }

                const f = imap.fetch(results, { bodies: '' });
                f.on('message', function(msg) {
                    msg.on('body', function(stream) {
                        simpleParser(stream, async (err, parsed) => {
                            const texto = parsed.text || '';
                            
                            // Buscamos si el correo habla de una transferencia o recibo de dinero
                            if (texto.includes('recibió') || texto.includes('transferencia') || texto.includes('Abono')) {
                                console.log('¡Nuevo pago detectado desde Bancolombia!');
                                
                                // Extraer el monto si es posible
                                const coincidenciaMonto = texto.match(/\$\s*([\d\.,]+)/);
                                const monto = coincidenciaMonto ? coincidenciaMonto[1] : 'Confirmado';

                                ultimoPago = {
                                    confirmado: true,
                                    monto: monto,
                                    fecha: new Date().toLocaleTimeString()
                                };
                            }
                        });
                    });
                });

                f.once('end', function() {
                    imap.end();
                });
            });
        });
    });

    imap.once('error', function(err) {
        console.log('Error en IMAP:', err.message);
    });

    imap.connect();
}

// Revisar correos automáticamente cada 5 segundos
setInterval(revisarCorreos, 5000);

// Endpoint que la pantalla del cajero consulta constantemente
app.get('/estado-pago', (req, res) => {
    res.json(ultimoPago);
});

// Endpoint para reiniciar la pantalla para la siguiente venta
app.post('/limpiar-pago', (req, res) => {
    ultimoPago = { confirmado: false, monto: 0, fecha: null };
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de la heladería corriendo en el puerto ${PORT}`);
});