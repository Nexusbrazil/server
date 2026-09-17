const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Conexao Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: SUPABASE_URL ou SUPABASE_KEY nao configuradas!");
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
);

// 1. Rota para listar vendedores e suas cidades
app.get('/api/vendedores-cidades', async (req, res) => {
  try {
    const { vendedor } = req.query;

    if (!vendedor) {
      // Retorna lista de vendedores unicos
      const { data, error } = await supabase
        .from('clientes_rotas')
        .select('vendedor_nome');

      if (error) throw error;

      const vendedoresUnicos = [...new Set(data.map(item => item.vendedor_nome))];
      return res.json(vendedoresUnicos);
    }

    // Retorna cidades unicas do vendedor selecionado
    const { data, error } = await supabase
      .from('clientes_rotas')
      .select('cidade')
      .eq('vendedor_nome', vendedor);

    if (error) throw error;

    const cidadesUnicas = [...new Set(data.map(item => item.cidade))];
    res.json(cidadesUnicas);
  } catch (err) {
    console.error("Erro em /api/vendedores-cidades:", err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 2. Rota para listar clientes de um Vendedor e Cidade (A QUE FALTAVA)
app.get('/api/clientes', async (req, res) => {
  try {
    const { vendedor, cidade } = req.query;

    if (!vendedor) {
      return res.status(400).json({ ok: false, erro: "Vendedor é obrigatório" });
    }

    let query = supabase
      .from('clientes_rotas')
      .select('*')
      .eq('vendedor_nome', vendedor);

    // Se informou a cidade e não for "TODAS", filtra por cidade
    if (cidade && cidade !== 'TODAS') {
      query = query.eq('cidade', cidade);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Erro em /api/clientes:", err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 3. Rota para receber o fechamento da rota
app.post('/api/finalizar-rota', async (req, res) => {
  try {
    const dadosVenda = req.body;
    console.log("Rota recebida:", dadosVenda);

    res.json({ ok: true, mensagem: "Rota recebida com sucesso!" });
  } catch (err) {
    console.error("Erro em /api/finalizar-rota:", err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
