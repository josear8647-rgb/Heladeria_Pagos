const express = require('express');
const cors = require('cors');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Configuración IMAP para Gmail
const configImap = {
    user: 'josear8647@gmail.com', // <--- Reemplaza con tu correo
    password: 'eboosegtciponszm', // <--- Reemplaza con tu contraseña de 16 letras
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

// Base de datos en memoria
let pagoActual = { confirmado: false, monto: 0, fecha: null };
let registroVentas = [];

function getFechaHoy() {
    return new Date().toISOString().split('T')[0];
}

// Lógica de lectura automática de correos Bancolombia
function iniciarEscuchaEmail() {
    const imap = new Imap(configImap);

    imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
            if (err) return console.error('Error al abrir buzón:', err);
            console.log('📬 Servidor escuchando transferencias de Bancolombia...');

            imap.on('mail', () => {
                const fetch = imap.seq.fetch(box.messages.total + ':*', { bodies: '' });
                fetch.on('message', (msg) => {
                    msg.on('body', (stream) => {
                        simpleParser(stream, async (err, parsed) => {
                            if (err) return;

                            const texto = (parsed.text || '').toLowerCase();
                            const asunto = (parsed.subject || '').toLowerCase();
                            const contenidoCompleto = asunto + " " + texto;

                            // Verifica si es un correo de entrada de dinero de Bancolombia
                            if (contenidoCompleto.includes('recibiste') || contenidoCompleto.includes('transferencia') || contenidoCompleto.includes('consignacion')) {
                                
                                // Expresión regular ajustada para capturar montos como $3,000.00 o $200,000.00
                                const coincidenciaMonto = parsed.text.match(/\$\s?([\d.,]+)/);
                                if (coincidenciaMonto) {
                                    let montoLimpio = coincidenciaMonto[1];
                                    
                                    // Manejo de formato numérico colombiano (100,000.00 o 100.000,00)
                                    if (montoLimpio.includes('.') && montoLimpio.includes(',')) {
                                        montoLimpio = montoLimpio.replace(/,/g, '');
                                    } else if (montoLimpio.includes(',')) {
                                        montoLimpio = montoLimpio.replace(/,/g, '');
                                    }

                                    const montoNum = parseFloat(montoLimpio);
                                    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

                                    if (!isNaN(montoNum) && montoNum > 0) {
                                        pagoActual = {
                                            confirmado: true,
                                            monto: montoNum,
                                            fecha: horaActual
                                        };

                                        registroVentas.push({
                                            id: Date.now(),
                                            monto: montoNum,
                                            hora: horaActual,
                                            tipo: 'Automática (Bancolombia)',
                                            fechaCompleta: getFechaHoy()
                                        });

                                        console.log(`✅ Transferencia detectada de Bancolombia: $${montoNum}`);
                                    }
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

app.get('/estado-pago', (req, res) => res.json(pagoActual));

app.post('/limpiar-pago', (req, res) => {
    pagoActual = { confirmado: false, monto: 0, fecha: null };
    res.json({ status: 'ok' });
});

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

app.post('/agregar-manual', (req, res) => {
    const { monto, descripcion } = req.body;
    if (!monto || isNaN(monto) || monto <= 0) return res.status(400).json({ error: 'Monto inválido' });

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

// INTERFAZ WEB COMPLETA EN LA RUTA PRINCIPAL (/)
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Caja Heladería - Control de Pagos</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eef2f5; text-align: center; padding: 20px; }
        .card { background: white; max-width: 500px; margin: 0 auto 20px auto; padding: 25px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
        h2 { color: #333; margin-bottom: 5px; }
        .status { padding: 20px; font-size: 20px; font-weight: bold; border-radius: 12px; margin: 20px 0; transition: all 0.3s ease; }
        .esperando { background-color: #fff8e1; color: #b78103; border: 2px solid #ffe082; }
        .pagado { background-color: #d4edda; color: #155724; border: 2px solid #c3e6cb; animation: pulse 1s infinite alternate; }
        button { background-color: #0d6efd; color: white; border: none; padding: 10px 18px; font-size: 15px; border-radius: 8px; cursor: pointer; font-weight: bold; margin: 5px; }
        button:hover { background-color: #0b5ed7; }
        .btn-manual { background-color: #198754; }
        .btn-manual:hover { background-color: #157347; }
        .resumen-box { background: #e7f1ff; border: 1px solid #b6d4fe; border-radius: 12px; padding: 15px; margin-top: 15px; text-align: left; }
        .resumen-box h3 { margin: 0 0 10px 0; color: #084298; text-align: center; font-size: 18px; }
        .monto-total { font-size: 28px; font-weight: bold; color: #0a58ca; text-align: center; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #cfe2ff; color: #084298; }
        input[type="number"], input[type="text"] { padding: 8px; border: 1px solid #ccc; border-radius: 6px; margin: 4px 0; width: 90%; font-size: 14px; }
        @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.02); } }
    </style>
</head>
<body>
    <div class="card">
        <h2>🍦 Heladería - Control de Caja</h2>
        <p style="color: #666; margin-top: 0;">Verificación de Transferencias Bancolombia</p>
        <div id="estadoPago" class="status esperando">⏳ Esperando transferencia...</div>
        <button id="btnLimpiar" style="display:none;" onclick="limpiarPantalla()">🔄 Confirmar y Siguiente Pago</button>
    </div>

    <div class="card">
        <h3>➕ Registrar Pago Manual</h3>
        <input type="number" id="montoManual" placeholder="Monto (Ej: 12000)" />
        <input type="text" id="descManual" placeholder="Descripción (Ej: Nequi / Efectivo)" />
        <br>
        <button class="btn-manual" onclick="agregarManual()">💾 Guardar Pago</button>
    </div>

    <div class="card">
        <div class="resumen-box">
            <h3>📊 Resumen de Ventas de Hoy</h3>
            <div class="monto-total" id="txtTotalDia">$0</div>
            <p style="text-align: center; margin: 0; color: #555; font-size: 13px;" id="txtCantVentas">0 pagos registrados</p>
            <table>
                <thead>
                    <tr><th>Hora</th><th>Tipo</th><th>Monto</th></tr>
                </thead>
                <tbody id="cuerpoTabla">
                    <tr><td colspan="3" style="text-align: center;">No hay registros hoy.</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const URL_SERVIDOR = window.location.origin;

        async function consultarPago() {
            try {
                const res = await fetch(\`\${URL_SERVIDOR}/estado-pago\`);
                const data = await res.json();
                if (data.confirmado) {
                    const caja = document.getElementById("estadoPago");
                    caja.className = "status pagado";
                    caja.innerHTML = \`✅ ¡PAGO CONFIRMADO!<br><br><span style="font-size: 30px;">$\${data.monto.toLocaleString('es-CO')}</span><br><small style="font-size: 13px; font-weight: normal;">Hora: \${data.fecha}</small>\`;
                    document.getElementById("btnLimpiar").style.display = "inline-block";
                    cargarVentasDia();
                }
            } catch (err) {}
        }

        async function limpiarPantalla() {
            await fetch(\`\${URL_SERVIDOR}/limpiar-pago\`, { method: 'POST' });
            const caja = document.getElementById("estadoPago");
            caja.className = "status esperando";
            caja.innerHTML = "⏳ Esperando transferencia...";
            document.getElementById("btnLimpiar").style.display = "none";
        }

        async function cargarVentasDia() {
            try {
                const res = await fetch(\`\${URL_SERVIDOR}/ventas-dia\`);
                const data = await res.json();
                document.getElementById("txtTotalDia").innerText = \`$\${data.total.toLocaleString('es-CO')}\`;
                document.getElementById("txtCantVentas").innerText = \`\${data.cantidad} pago(s) registrado(s) hoy\`;
                const tbody = document.getElementById("cuerpoTabla");
                tbody.innerHTML = "";
                if (data.ventas.length === 0) {
                    tbody.innerHTML = \`<tr><td colspan="3" style="text-align: center;">No hay registros hoy.</td></tr>\`;
                    return;
                }
                data.ventas.slice().reverse().forEach(v => {
                    tbody.innerHTML += \`<tr><td>\${v.hora}</td><td>\${v.tipo}</td><td><b>$\${v.monto.toLocaleString('es-CO')}</b></td></tr>\`;
                });
            } catch (err) {}
        }

        async function agregarManual() {
            const monto = document.getElementById("montoManual").value;
            const descripcion = document.getElementById("descManual").value;
            if (!monto || monto <= 0) return alert("Ingresa un monto válido.");
            await fetch(\`\${URL_SERVIDOR}/agregar-manual\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto, descripcion })
            });
            document.getElementById("montoManual").value = "";
            document.getElementById("descManual").value = "";
            cargarVentasDia();
        }

        setInterval(consultarPago, 3000);
        cargarVentasDia();
    </script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});