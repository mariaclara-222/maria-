import express from 'express';
import dotenv from 'dotenv';
import { pool } from './config/database.js';
import cors from 'cors'; 

dotenv.config();

const app = express();
app.use(express.json());

app.use(cors()); 
app.use(express.json())








// ================= ROTA PARA CADASTRAR USUÁRIO =================
app.post('/usuarios', async (req, res) => {
  const { nome, email, senha, telefone } = req.body;

  // 1. Validação básica de entrada
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  }

  try {
    // 2. Garante que a tabela de usuários existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`criar conta\` (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        NOME VARCHAR(255) NOT NULL,
        EMAIL VARCHAR(255) NOT NULL UNIQUE,
        SENHA VARCHAR(255) NOT NULL,
        DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // 3. Verifica se o e-mail já está em uso
      const [emailExistente]: any = await pool.query(
        'SELECT ID FROM `criar conta` WHERE EMAIL = ?',
        [email]
      );
     
      if (emailExistente.length > 0) {
        return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      }
     
      // 3.1 Verifica se o CPF já está em uso (Evita quebra por Primary Key)
      const [cpfExistente]: any = await pool.query(
        'SELECT ID FROM `criar conta` WHERE ID = ?',
        [cpf]
      );
     
      if (cpfExistente.length > 0) {
        return res.status(409).json({ error: 'Este ID já está cadastrado.' });
      }
   
    // 5. Salva o usuário no banco
    const queryInsercao = 'INSERT INTO `criar conta` (NOME, EMAIL, SENHA, TELEFONE) VALUES (?, ?, ?, ?)';
    const [result]: any = await pool.query(queryInsercao, [nome, email, senha, TELEFONE]);

    // Retorna 201 Created sem expor a senha
    res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso!',
      usuario: {
        id: result.insertId,
        nome,
        email
      }
    });
  } catch (error: any) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ error: 'Erro interno ao salvar o usuário.' });
  }
});

// ================= ROTA PARA INSERIR PRODUTO (E CRIAR A TABELA SE NÃO EXISTIR) =================
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
  } catch (error: any) {
    console.error('Erro ao inserir produto:', error);
    res.status(500).json({ error: 'Erro interno ao salvar o produto.' });
  }
});

// ================= ROTA PARA VISUALIZAR OS PRODUTOS =================
app.get('/produtos', async (req, res) => {
  try {
    // Verifica se a tabela existe antes de ler para evitar erro de tabela fantasma
    const [tabelas]: any = await pool.query("SHOW TABLES LIKE 'produtos'");
    
    if (tabelas.length === 0) {
      // Se a tabela não existe, significa que nenhum produto foi cadastrado ainda
      return res.json([]);
    }

    const [rows] = await pool.query('SELECT * FROM `produtos` ORDER BY `CODIGO DO PRODUTO` DESC');
    res.json(rows);
  } catch (error: any) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar os produtos.' });
  }
});

// Suas rotas antigas continuam aqui...
app.get('/descobrir-tabelas', async (req, res) => {
  try {
    const [rows]: any = await pool.query('SHOW TABLES');
    const tabelas = rows.map((row: any) => Object.values(row)[0]);
    res.json({ tabelas });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);
  
  // === NOVO TESTE DE CONEXÃO DIRETA COM O BANCO ===
  pool.getConnection()
    .then((connection) => {
      console.log('✅ SUCESSO: O Node.js conseguiu conectar no banco MySQL!');
      connection.release();
    })
    .catch((error) => {
      console.log('\n❌ ERRO CRÍTICO NO BANCO DE DADOS:');
      console.log(error.message);
      console.log('Verifique a senha, o usuário ou se o servidor robb0253.publiccloud.com.br está bloqueando conexões externas.\n');
    });
});
