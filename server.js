const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Conexao com o Supabase usando as variaveis do Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Rota para o vendedor enviar o fechamento da rota
app.post('/api/fechamento', async (req, res) => {
  try {
    const { vendedor, rota, dataHora, dados } = req.body;

    const { data, error } = await supabase
      .from('fechamentos')
      .insert([{ vendedor, rota, data_hora: dataHora, dados }]);

    if (error) throw error;

    res.json({ ok: true, mensagem: "Fechamento registrado no Supabase!" });
  } catch (err) {
    console.error("Erro ao salvar no Supabase:", err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 2. Rota para o escritorio buscar o historico de fechamentos
app.get('/api/fechamentos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fechamentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Erro ao buscar do Supabase:", err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 3. Rota para buscar os vendedores e suas cidades da base de dados
app.get('/api/vendedores-cidades', async (req, res) => {
  try {
    const { vendedor } = req.query;

    if (vendedor) {
      // Retorna apenas as cidades do vendedor selecionado
      const { data, error } = await supabase
        .from('vendedores_cidades')
        .select('cidade')
        .eq('vendedor_nome', vendedor);

      if (error) throw error;
      return res.json(data.map(item => item.cidade));
    }

    // Retorna a lista de vendedores sem duplicar nomes
    const { data, error } = await supabase
      .from('vendedores_cidades')
      .select('vendedor_nome');

    if (error) throw error;

    const vendedoresUnicos = [...new Set(data.map(item => item.vendedor_nome))];
    res.json(vendedoresUnicos);
  } catch (err) {
    console.error('Erro ao buscar vendedores/cidades:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
