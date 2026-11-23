import express from 'express';
import dotenv from 'dotenv';
import { pool } from './config/database.js';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// ROTA RAIZ DE VERIFICAÇÃO / STATUS
// ==========================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    projeto: 'LU EXPORT / FRIMESA (TCC)',
    banco: 'MySQL',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// ROTA PARA CADASTRAR USUÁRIO
// ==========================================
app.post('/usuarios', async (req, res) => {
  const { nome, email, senha, telefone } = req.body;

  // 1. Validação básica de entrada
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  }

  try {
    // 2. Garante que a tabela de usuários existe (com TELEFONE)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`criar conta\` (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        NOME VARCHAR(255) NOT NULL,
        EMAIL VARCHAR(255) NOT NULL UNIQUE,
        SENHA VARCHAR(255) NOT NULL,
        TELEFONE VARCHAR(20),
        DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Verifica se o e-mail já está em uso
    const [emailExistente] = await pool.query(
      'SELECT ID FROM `criar conta` WHERE EMAIL = ?',
      [email]
    );

    if (Array.isArray(emailExistente) && emailExistente.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }

    // 4. Salva o usuário no banco (usando null caso telefone venha vazio)
    const queryInsercao = 'INSERT INTO `criar conta` (NOME, EMAIL, SENHA, TELEFONE) VALUES (?, ?, ?, ?)';
    const [result] = await pool.query(queryInsercao, [nome, email, senha, telefone || null]);

    // Retorna 201 Created sem expor a senha
    res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso!',
      usuario: {
        id: result.insertId,
        nome,
        email,
      },
    });
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ error: 'Erro interno ao salvar o usuário.' });
  }
});

// ==========================================
// ROTA DE LOGIN
// ==========================================
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT ID, NOME, EMAIL, TELEFONE FROM `criar conta` WHERE EMAIL = ? AND SENHA = ?',
      [email, senha]
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const user = rows[0];
      return res.json({
        mensagem: 'Login realizado com sucesso!',
        usuario: {
          id: user.ID,
          nome: user.NOME,
          email: user.EMAIL,
          telefone: user.TELEFONE,
        },
      });
    }

    res.status(401).json({ error: 'Email ou senha inválidos.' });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro interno ao autenticar usuário.' });
  }
});

// ==========================================
// ROTA PARA INSERIR PRODUTO
// ==========================================
app.post('/produtos', async (req, res) => {
  const { nome, preco } = req.body;

  // Validação simples
  if (!nome || !preco) {
    return res.status(400).json({ error: 'Nome e preço são obrigatórios.' });
  }

  try {
    // 1. Cria a tabela 'produtos-vini' se ela ainda não existir no banco
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`produtos-vini\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        preco DECIMAL(10, 2) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Insere o produto digitado pelo usuário
    const queryCadastro = `INSERT INTO \`produtos-vini\` (nome, preco) VALUES (?, ?)`;
    await pool.query(queryCadastro, [nome, preco]);

    res.status(201).json({ mensagem: 'Produto inserido com sucesso!' });
  } catch (error) {
    console.error('Erro ao inserir produto:', error);
    res.status(500).json({ error: 'Erro interno ao salvar o produto.' });
  }
});

// ==========================================
// ROTA PARA VISUALIZAR OS PRODUTOS DO CATÁLOGO
// ==========================================
app.get('/produtos', async (req, res) => {
  try {
    const [tabelas] = await pool.query("SHOW TABLES LIKE 'produtos'");

    if (Array.isArray(tabelas) && tabelas.length === 0) {
      return res.json([]);
    }

    const [rows] = await pool.query('SELECT * FROM `produtos` ORDER BY `CODIGO DO PRODUTO` DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar os produtos.' });
  }
});

// ==========================================
// FUNÇÃO AUXILIAR: GARANTIR TABELA DE PEDIDOS
// ==========================================
async function garantirTabelaPedidos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`pedidos\` (
      id VARCHAR(100) PRIMARY KEY,
      customer_name VARCHAR(255) NOT NULL,
      customer_type VARCHAR(20) DEFAULT 'PJ',
      document VARCHAR(100),
      email VARCHAR(255),
      phone VARCHAR(100),
      order_date VARCHAR(100),
      status VARCHAR(50) DEFAULT 'Pendente',
      subtotal DECIMAL(12, 2) DEFAULT 0.00,
      freight DECIMAL(12, 2) DEFAULT 0.00,
      total DECIMAL(12, 2) DEFAULT 0.00,
      currency VARCHAR(100) DEFAULT 'BRL - Real Brasileiro',
      payment_method VARCHAR(150),
      payment_status VARCHAR(50) DEFAULT 'Pendente',
      incoterm VARCHAR(150),
      pickup_location VARCHAR(255),
      carrier VARCHAR(255),
      tracking_code VARCHAR(150),
      current_location VARCHAR(255),
      delivery_forecast VARCHAR(100),
      destination_city VARCHAR(150),
      destination_state VARCHAR(100),
      destination_country VARCHAR(150) DEFAULT 'Brasil',
      notes TEXT,
      items LONGTEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ==========================================
// PEDIDOS DEMONSTRATIVOS PARA O PRIMEIRO ACESSO
// ==========================================
const DEMO_SEEDS = [
  {
    id: 'PED-940218',
    customerName: 'Al-Madina Food Trading LLC',
    customerType: 'PJ',
    document: 'AE-992834-X',
    email: 'import@almadina-trading.ae',
    phone: '+971 4 398 2210',
    orderDate: '2026-11-20T14:30:00Z',
    status: 'Em preparo',
    items: [
      { id: '1', name: 'Peito de Frango Congelado (Boneless)', quantity: 5000, price: 18.9, unit: 'kg' },
      { id: '2', name: 'Sobrecoxa de Frango Desossada', quantity: 3200, price: 14.5, unit: 'kg' },
      { id: '3', name: 'Coxinha da Asa (Drumette)', quantity: 2000, price: 13.8, unit: 'kg' },
    ],
    subtotal: 168500.0,
    freight: 12500.0,
    total: 181000.0,
    currency: 'USD - Dólar Americano',
    paymentMethod: 'Carta de Crédito (L/C)',
    paymentStatus: 'Aprovado',
    incoterm: 'CIF - Cost, Insurance and Freight',
    pickupLocation: 'Porto de Paranaguá - PR',
    carrier: 'Maersk Line Brasil',
    trackingCode: 'MSK-BR-992140',
    currentLocation: 'Câmara Fria - Terminal Portuário',
    deliveryForecast: '15/12/2026',
    destinationCity: 'Dubai',
    destinationState: 'Dubai',
    destinationCountry: 'Emirados Árabes Unidos',
    notes: 'Certificação Halal requerida com laudo de embarque anexo.',
  },
  {
    id: 'PED-883192',
    customerName: 'Comercializadora Andina SpA',
    customerType: 'PJ',
    document: 'CL-76.332.901-4',
    email: 'compras@andinachile.cl',
    phone: '+56 9 8721 3490',
    orderDate: '2026-11-21T09:15:00Z',
    status: 'Em trânsito',
    items: [
      { id: '4', name: 'Costela Suína Especial Congelada', quantity: 2500, price: 23.4, unit: 'kg' },
      { id: '5', name: 'Lombo Suíno Congelado', quantity: 1800, price: 21.0, unit: 'kg' },
    ],
    subtotal: 96300.0,
    freight: 8200.0,
    total: 104500.0,
    currency: 'USD - Dólar Americano',
    paymentMethod: 'Transferência SWIFT',
    paymentStatus: 'Aprovado',
    incoterm: 'FOB - Free on Board',
    pickupLocation: 'Frigorífico Matriz Medianeira - PR',
    carrier: 'Transportes Rodoviários Andinos',
    trackingCode: 'ROD-CL-48192',
    currentLocation: 'Foz do Iguaçu - Aduana',
    deliveryForecast: '28/11/2026',
    destinationCity: 'Santiago',
    destinationState: 'RM',
    destinationCountry: 'Chile',
    notes: 'Transporte refrigerado mantido a -18°C.',
  },
  {
    id: 'PED-721054',
    customerName: 'Rede Central de Supermercados S/A',
    customerType: 'PJ',
    document: '14.283.910/0001-55',
    email: 'suprimentos@centralmercados.com.br',
    phone: '+55 11 3290-8800',
    orderDate: '2026-11-22T16:45:00Z',
    status: 'Pendente',
    items: [
      { id: '1', name: 'Peito de Frango Congelado (Boneless)', quantity: 1200, price: 18.9, unit: 'kg' },
      { id: '6', name: 'Meio da Asa (Tulipa)', quantity: 800, price: 17.5, unit: 'kg' },
      { id: '7', name: 'Pernil Suíno Desossado Congelado', quantity: 1500, price: 19.8, unit: 'kg' },
    ],
    subtotal: 66380.0,
    freight: 3400.0,
    total: 69780.0,
    currency: 'BRL - Real Brasileiro',
    paymentMethod: 'PIX (simulado)',
    paymentStatus: 'Pendente',
    incoterm: 'FOB - Free on Board',
    pickupLocation: 'Ponto de retirada - Fronteira do Rio',
    carrier: 'Expresso Frigorífico Brasil',
    trackingCode: 'BR-EXP-33019',
    currentLocation: 'Aguardando Coleta',
    deliveryForecast: '26/11/2026',
    destinationCity: 'São Paulo',
    destinationState: 'SP',
    destinationCountry: 'Brasil',
    notes: 'Aguardando validação do pagamento demonstrativo.',
  },
];

// ==========================================
// ROTA: BUSCAR TODOS OS PEDIDOS (PAINEL DE GESTÃO)
// ==========================================
app.get('/pedidos', async (req, res) => {
  try {
    await garantirTabelaPedidos();

    const [rows] = await pool.query(`
      SELECT 
        id,
        customer_name AS customerName,
        customer_type AS customerType,
        document,
        email,
        phone,
        order_date AS orderDate,
        status,
        subtotal,
        freight,
        total,
        currency,
        payment_method AS paymentMethod,
        payment_status AS paymentStatus,
        incoterm,
        pickup_location AS pickupLocation,
        carrier,
        tracking_code AS trackingCode,
        current_location AS currentLocation,
        delivery_forecast AS deliveryForecast,
        destination_city AS destinationCity,
        destination_state AS destinationState,
        destination_country AS destinationCountry,
        notes,
        items,
        criado_em AS criadoEm
      FROM \`pedidos\`
      ORDER BY criado_em DESC
    `);

    // Se o banco estiver vazio, insere pedidos demonstrativos
    if (Array.isArray(rows) && rows.length === 0) {
      for (const demo of DEMO_SEEDS) {
        await pool.query(`
          INSERT INTO \`pedidos\` (
            id, customer_name, customer_type, document, email, phone, order_date, status,
            subtotal, freight, total, currency, payment_method, payment_status, incoterm,
            pickup_location, carrier, tracking_code, current_location, delivery_forecast,
            destination_city, destination_state, destination_country, notes, items
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          demo.id, demo.customerName, demo.customerType, demo.document, demo.email, demo.phone,
          demo.orderDate, demo.status, demo.subtotal, demo.freight, demo.total, demo.currency,
          demo.paymentMethod, demo.paymentStatus, demo.incoterm, demo.pickupLocation, demo.carrier,
          demo.trackingCode, demo.currentLocation, demo.deliveryForecast, demo.destinationCity,
          demo.destinationState, demo.destinationCountry, demo.notes, JSON.stringify(demo.items)
        ]);
      }
      return res.json(DEMO_SEEDS);
    }

    // Faz o parse do JSON dos itens de cada pedido para o frontend
    const pedidosFormatados = rows.map((p) => ({
      ...p,
      subtotal: Number(p.subtotal) || 0,
      freight: Number(p.freight) || 0,
      total: Number(p.total) || 0,
      items: typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []),
    }));

    res.json(pedidosFormatados);
  } catch (error) {
    console.error('Erro ao buscar pedidos no MySQL:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos do banco de dados.' });
  }
});

// ==========================================
// ROTA: BUSCAR UM PEDIDO POR ID
// ==========================================
app.get('/pedidos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await garantirTabelaPedidos();

    const [rows] = await pool.query(`
      SELECT 
        id,
        customer_name AS customerName,
        customer_type AS customerType,
        document,
        email,
        phone,
        order_date AS orderDate,
        status,
        subtotal,
        freight,
        total,
        currency,
        payment_method AS paymentMethod,
        payment_status AS paymentStatus,
        incoterm,
        pickup_location AS pickupLocation,
        carrier,
        tracking_code AS trackingCode,
        current_location AS currentLocation,
        delivery_forecast AS deliveryForecast,
        destination_city AS destinationCity,
        destination_state AS destinationState,
        destination_country AS destinationCountry,
        notes,
        items
      FROM \`pedidos\`
      WHERE id = ?
    `, [id]);

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const p = rows[0];
    res.json({
      ...p,
      subtotal: Number(p.subtotal) || 0,
      freight: Number(p.freight) || 0,
      total: Number(p.total) || 0,
      items: typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []),
    });
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ error: 'Erro interno ao consultar pedido.' });
  }
});

// ==========================================
// ROTA: SALVAR/CRIAR NOVO PEDIDO (VEM DO APP)
// ==========================================
app.post('/pedidos', async (req, res) => {
  const pedido = req.body;

  if (!pedido || !pedido.id || !pedido.customerName) {
    return res.status(400).json({ error: 'Dados obrigatórios do pedido ausentes (id, customerName).' });
  }

  try {
    await garantirTabelaPedidos();

    const itemsJson = JSON.stringify(pedido.items || []);

    const sql = `
      INSERT INTO \`pedidos\` (
        id, customer_name, customer_type, document, email, phone, order_date, status,
        subtotal, freight, total, currency, payment_method, payment_status, incoterm,
        pickup_location, carrier, tracking_code, current_location, delivery_forecast,
        destination_city, destination_state, destination_country, notes, items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_name = VALUES(customer_name),
        customer_type = VALUES(customer_type),
        document = VALUES(document),
        email = VALUES(email),
        phone = VALUES(phone),
        order_date = VALUES(order_date),
        status = VALUES(status),
        subtotal = VALUES(subtotal),
        freight = VALUES(freight),
        total = VALUES(total),
        currency = VALUES(currency),
        payment_method = VALUES(payment_method),
        payment_status = VALUES(payment_status),
        incoterm = VALUES(incoterm),
        pickup_location = VALUES(pickup_location),
        carrier = VALUES(carrier),
        tracking_code = VALUES(tracking_code),
        current_location = VALUES(current_location),
        delivery_forecast = VALUES(delivery_forecast),
        destination_city = VALUES(destination_city),
        destination_state = VALUES(destination_state),
        destination_country = VALUES(destination_country),
        notes = VALUES(notes),
        items = VALUES(items)
    `;

    await pool.query(sql, [
      pedido.id,
      pedido.customerName,
      pedido.customerType || 'PJ',
      pedido.document || null,
      pedido.email || null,
      pedido.phone || null,
      pedido.orderDate || new Date().toISOString(),
      pedido.status || 'Pendente',
      pedido.subtotal || 0,
      pedido.freight || 0,
      pedido.total || 0,
      pedido.currency || 'BRL - Real Brasileiro',
      pedido.paymentMethod || null,
      pedido.paymentStatus || 'Pendente',
      pedido.incoterm || 'FOB - Free on Board',
      pedido.pickupLocation || null,
      pedido.carrier || null,
      pedido.trackingCode || null,
      pedido.currentLocation || null,
      pedido.deliveryForecast || null,
      pedido.destinationCity || null,
      pedido.destinationState || null,
      pedido.destinationCountry || 'Brasil',
      pedido.notes || null,
      itemsJson,
    ]);

    res.status(201).json({
      mensagem: 'Pedido registrado com sucesso no banco de dados!',
      id: pedido.id,
    });
  } catch (error) {
    console.error('Erro ao salvar pedido no MySQL:', error);
    res.status(500).json({ error: 'Erro interno ao salvar pedido no banco de dados.' });
  }
});

// ==========================================
// ROTA: ATUALIZAR STATUS DO PEDIDO (PAINEL GESTÃO)
// ==========================================
app.patch('/pedidos/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'O novo status é obrigatório.' });
  }

  try {
    await garantirTabelaPedidos();

    const [result] = await pool.query(
      'UPDATE `pedidos` SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    res.json({ mensagem: 'Status do pedido atualizado com sucesso!', id, status });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status do pedido.' });
  }
});

// ==========================================
// ROTA: EXCLUIR PEDIDO (PAINEL GESTÃO)
// ==========================================
app.delete('/pedidos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await garantirTabelaPedidos();

    const [result] = await pool.query('DELETE FROM `pedidos` WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    res.json({ mensagem: `Pedido ${id} removido com sucesso.` });
  } catch (error) {
    console.error('Erro ao excluir pedido:', error);
    res.status(500).json({ error: 'Erro ao excluir pedido do banco.' });
  }
});

// ==========================================
// ROTA PARA DESCOBRIR TABELAS DO BANCO
// ==========================================
app.get('/descobrir-tabelas', async (req, res) => {
  try {
    const [rows] = await pool.query('SHOW TABLES');
    const tabelas = rows.map((row) => Object.values(row)[0]);
    res.json({ tabelas });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar tabelas' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);

  // Teste de conexão direta com o banco MySQL
  pool.getConnection()
    .then((connection) => {
      console.log('✅ SUCESSO: O Node.js conseguiu conectar no banco MySQL!');
      connection.release();
    })
    .catch((error) => {
      console.log('\n❌ ERRO CRÍTICO NO BANCO DE DADOS:');
      console.log(error.message);
      console.log('Verifique a senha, o usuário ou se o host está liberado para conexões externas.\n');
    });
});
