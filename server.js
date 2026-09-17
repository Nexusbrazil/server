const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 1. Lista Vendedores e suas Rotas/Dias
app.get('/api/vendedores-cidades', async (req, res) => {
  try {
    const { vendedor } = req.query;

    if (!vendedor) {
      const { data, error } = await supabase.from('clientes_rotas').select('vendedor_nome');
      if (error) throw error;
      const vendedoresUnicos = [...new Set(data.map(item => item.vendedor_nome))];
      return res.json(vendedoresUnicos);
    }

    // Busca os dias/rotas cadastrados para este vendedor
    const { data, error } = await supabase
      .from('clientes_rotas')
      .select('dia_semana')
      .eq('vendedor_nome', vendedor);

    if (error) throw error;

    const rotasUnicas = [...new Set(data.map(item => item.dia_semana))].filter(Boolean);
    res.json(rotasUnicas);
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 2. Lista os Clientes do Vendedor na Rota Selecionada (Agrupados por Cidade)
app.get('/api/clientes', async (req, res) => {
  try {
    const { vendedor, dia_semana } = req.query;

    if (!vendedor || !dia_semana) {
      return res.status(400).json({ ok: false, erro: "Vendedor e Rota/Dia são obrigatórios" });
    }

    const { data, error } = await supabase
      .from('clientes_rotas')
      .select('*')
      .eq('vendedor_nome', vendedor)
      .eq('dia_semana', dia_semana);

    if (error) throw error;

    // Agrupa os clientes por cidade
    const cidadesAgrupadas = {};
    data.forEach(cli => {
      const cid = cli.cidade || 'Outros';
      if (!cidadesAgrupadas[cid]) {
        cidadesAgrupadas[cid] = [];
      }
      cidadesAgrupadas[cid].push({
        id: cli.id,
        nome: cli.nome_cliente,
        endereco: cli.endereco || '',
        status: 'pendente',
        venda: null
      });
    });

    const resultado = Object.keys(cidadesAgrupadas).map(cidade => ({
      cidade: cidade,
      clientes: cidadesAgrupadas[cidade]
    }));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 3. Recebe o Fechamento do Dia para o Painel do Escritório
app.post('/api/finalizar-rota', async (req, res) => {
  try {
    const dadosVenda = req.body;
    console.log("Fechamento recebido para o Painel do Escritório:", JSON.stringify(dadosVenda, null, 2));
    
    res.json({ ok: true, mensagem: "Fechamento registrado com sucesso no painel!" });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
