const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const ARQUIVO_DADOS = 'fechamentos.json';

// 1. Recebe do App do Vendedor
app.post('/api/fechamento', (req, res) => {
  const novoFechamento = req.body;
  let historico = fs.existsSync(ARQUIVO_DADOS) ? JSON.parse(fs.readFileSync(ARQUIVO_DADOS)) : [];
  
  historico.unshift(novoFechamento); // O mais recente fica no topo
  fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(historico, null, 2));
  
  res.status(200).json({ ok: true, mensagem: 'Fechamento registrado com sucesso!' });
});

// 2. Entrega para o Painel do Escritório
app.get('/api/fechamentos', (req, res) => {
  let historico = fs.existsSync(ARQUIVO_DADOS) ? JSON.parse(fs.readFileSync(ARQUIVO_DADOS)) : [];
  res.json(historico);
});

app.listen(3000, () => console.log('🚀 Servidor rodando na porta 3000...'));
