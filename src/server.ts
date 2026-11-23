import express, { Request, Response } from 'express';
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
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    projeto: 'LU EXPORT / FRIMESA (TCC)',
    banco: 'MySQL',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// ROTA PARA CADASTRAR USUÁRIO (SUA ROTA ORIGINAL)
// ==========================================
app.post('/usuarios', async (req: Request, res: Response) => {
  const { nome, email, senha, telefone } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  }

  try {
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

    const [emailExistente]: any = await pool.query(
      'SELECT ID FROM `criar conta` WHERE EMAIL = ?',
      [email]
    );

    if (emailExistente && emailExistente.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const queryInsercao = 'INSERT INTO `criar conta` (NOME, EMAIL, SENHA, TELEFONE) VALUES (?, ?, ?, ?)';
    const [result]: any = await pool.query(queryInsercao, [nome, email, senha, telefone || null]);

    res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso!',
      usuario: {
        id: result.insertId,
        nome,
        email,
      },
    });
  } catch (error: any) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ error: 'Erro interno ao salvar o usuário.' });
  }
});

// ==========================================
// ROTA DE LOGIN
// ==========================================
app.post('/login', async (req: Request, res: Response) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const [rows]: any = await pool.query(
      'SELECT ID, NOME, EMAIL, TELEFONE FROM `criar conta` WHERE EMAIL = ? AND SENHA = ?',
      [email, senha]
    );

    if (rows && rows.length > 0) {
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
  } catch (error: any) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro interno ao autenticar usuário.' });
  }
});

// ==========================================
// ROTA PARA INSERIR PRODUTO NO CATÁLOGO (SUA ROTA ORIGINAL)
// ==========================================
app.post('/produtos', async (req: Request, res: Response) => {
  const { nome, preco } = req.body;

  if (!nome || !preco) {
    return res.status(400).json({ error: 'Nome e preço são obrigatórios.' });
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`produtos-vini\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        preco DECIMAL(10, 2) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const queryCadastro = `INSERT INTO \`produtos-vini\` (nome, preco) VALUES (?, ?)`;
    await pool.query(queryCadastro, [nome, preco]);

    res.status(201).json({ mensagem: 'Produto inserido com sucesso!' });
  } catch (error: any) {
    console.error('Erro ao inserir produto:', error);
    res.status(500).json({ error: 'Erro interno ao salvar o produto.' });
  }
});

// ==========================================
// ROTA PARA VISUALIZAR OS PRODUTOS (SUA ROTA ORIGINAL)
// ==========================================
app.get('/produtos', async (req: Request, res: Response) => {
  try {
    const [tabelas]: any = await pool.query("SHOW TABLES LIKE 'produtos'");

    if (tabelas && tabelas.length === 0) {
      return res.json([]);
    }

    const [rows]: any = await pool.query('SELECT * FROM `produtos` ORDER BY `CODIGO DO PRODUTO` DESC');
    res.json(rows);
  } catch (error: any) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar os produtos.' });
  }
});

// ==========================================
// GARANTIR TABELA DE PEDIDOS
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
// ROTA: BUSCAR TODOS OS PEDIDOS (PAINEL DE GESTÃO)
// ==========================================
app.get('/pedidos', async (req: Request, res: Response) => {
  try {
    await garantirTabelaPedidos();

    const [rows]: any = await pool.query(`
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

    // Faz o parse dos produtos pedidos (JSON) para array
    const pedidosFormatados = rows.map((p: any) => ({
      ...p,
      subtotal: Number(p.subtotal) || 0,
      freight: Number(p.freight) || 0,
      total: Number(p.total) || 0,
      items: typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []),
    }));

    res.json(pedidosFormatados);
  } catch (error: any) {
    console.error('Erro ao buscar pedidos no MySQL:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos do banco de dados.' });
  }
});

// ==========================================
// ROTA: REGISTRAR NOVO PEDIDO (FEITO PELO APP)
// ==========================================
app.post('/pedidos', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('Erro ao salvar pedido no MySQL:', error);
    res.status(500).json({ error: 'Erro interno ao salvar pedido no banco de dados.' });
  }
});

// ==========================================
// ROTA: ATUALIZAR STATUS DO PEDIDO (PAINEL GESTÃO)
// ==========================================
app.patch('/pedidos/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'O novo status é obrigatório.' });
  }

  try {
    await garantirTabelaPedidos();

    const [result]: any = await pool.query(
      'UPDATE `pedidos` SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    res.json({ mensagem: 'Status do pedido atualizado com sucesso!', id, status });
  } catch (error: any) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status do pedido.' });
  }
});

// ==========================================
// ROTA: EXCLUIR PEDIDO (PAINEL GESTÃO)
// ==========================================
app.delete('/pedidos/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await garantirTabelaPedidos();

    const [result]: any = await pool.query('DELETE FROM `pedidos` WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    res.json({ mensagem: `Pedido ${id} removido com sucesso.` });
  } catch (error: any) {
    console.error('Erro ao excluir pedido:', error);
    res.status(500).json({ error: 'Erro ao excluir pedido do banco.' });
  }
});

// ==========================================
// ROTA PARA DESCOBRIR TABELAS DO BANCO (SUA ROTA ORIGINAL)
// ==========================================
app.get('/descobrir-tabelas', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SHOW TABLES');
    const tabelas = rows.map((row: any) => Object.values(row)[0]);
    res.json({ tabelas });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao listar tabelas' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);

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
