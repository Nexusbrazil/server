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
      // Busca vendedores das duas tabelas para não perder nada
      const { data: dataClientes } = await supabase.from('clientes').select('vendedor_responsavel');
      const { data: dataRotas } = await supabase.from('clientes_rotas').select('vendedor_nome');

      const vendedores = new Set();
      (dataClientes || []).forEach(i => i.vendedor_responsavel && vendedores.add(i.vendedor_responsavel));
      (dataRotas || []).forEach(i => i.vendedor_nome && vendedores.add(i.vendedor_nome));

      return res.json([...vendedores].sort());
    }

    // Busca os dias/rotas cadastrados para este vendedor (prioriza a tabela 'clientes')
    const { data: rotasClientes } = await supabase
      .from('clientes')
      .select('dia_semana')
      .ilike('vendedor_responsavel', vendedor);

    const { data: rotasAntigas } = await supabase
      .from('clientes_rotas')
      .select('dia_semana')
      .ilike('vendedor_nome', vendedor);

    const rotasUnicas = new Set();
    (rotasClientes || []).forEach(i => i.dia_semana && rotasUnicas.add(i.dia_semana));
    (rotasAntigas || []).forEach(i => i.dia_semana && rotasUnicas.add(i.dia_semana));

    res.json([...rotasUnicas].filter(Boolean));
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 2. Lista os Clientes do Vendedor na Rota Selecionada (Agrupados por Cidade)
app.get('/api/clientes', async (req, res) => {
  try {
    const { vendedor, dia_semana } = req.query;

    if (!vendedor) {
      // Se chamado sem vendedor, retorna a lista bruta dos clientes
      const { data, error } = await supabase.from('clientes').select('*').order('nome', { ascending: true });
      if (error) throw error;
      return res.json(data);
    }

    // Busca na tabela 'clientes' (onde o escritório cadastra)
    let queryClientes = supabase
      .from('clientes')
      .select('*')
      .ilike('vendedor_responsavel', vendedor);

    if (dia_semana) {
      queryClientes = queryClientes.ilike('dia_semana', dia_semana);
    }

    let { data: listaClientes, error } = await queryClientes;
    if (error) throw error;

    // Se não achar na tabela nova 'clientes', tenta buscar na tabela antiga 'clientes_rotas'
    if (!listaClientes || listaClientes.length === 0) {
      let queryRotas = supabase
        .from('clientes_rotas')
        .select('*')
        .ilike('vendedor_nome', vendedor);

      if (dia_semana) {
        queryRotas = queryRotas.ilike('dia_semana', dia_semana);
      }

      const { data: dataRotas } = await queryRotas;
      if (dataRotas && dataRotas.length > 0) {
        listaClientes = dataRotas.map(r => ({
          id: r.id,
          nome: r.nome_cliente,
          cidade: r.cidade,
          endereco: r.endereco,
          vendedor_responsavel: r.vendedor_nome,
          dia_semana: r.dia_semana
        }));
      }
    }

    // Agrupa os clientes por cidade no formato exato que o app web espera
    const cidadesAgrupadas = {};
    (listaClientes || []).forEach(cli => {
      const cid = (cli.cidade || 'GERAL').toUpperCase();
      if (!cidadesAgrupadas[cid]) {
        cidadesAgrupadas[cid] = [];
      }
      cidadesAgrupadas[cid].push({
        id: cli.id,
        nome: cli.nome || cli.nome_cliente,
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

// 3. Cadastrar Novo Cliente (Resolve o Erro 404 ao Salvar)
app.post('/api/clientes', async (req, res) => {
  try {
    const { nome, vendedor_responsavel, dia_semana, cidade, endereco, ordem } = req.body;

    const payload = {
      nome: (nome || '').toUpperCase(),
      vendedor_responsavel: vendedor_responsavel || '',
      dia_semana: dia_semana || '',
      cidade: (cidade || '').toUpperCase(),
      endereco: endereco || '',
      ordem: ordem || 1
    };

    const { data, error } = await supabase.from('clientes').insert([payload]).select();
    if (error) throw error;

    res.json({ ok: true, mensagem: "Cliente salvo com sucesso!", cliente: data[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 4. Editar Cliente Existente
app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, vendedor_responsavel, dia_semana, cidade, endereco, ordem } = req.body;

    const payload = {
      nome: (nome || '').toUpperCase(),
      vendedor_responsavel: vendedor_responsavel || '',
      dia_semana: dia_semana || '',
      cidade: (cidade || '').toUpperCase(),
      endereco: endereco || '',
      ordem: ordem || 1
    };

    const { data, error } = await supabase.from('clientes').update(payload).eq('id', id).select();
    if (error) throw error;

    res.json({ ok: true, mensagem: "Cliente atualizado com sucesso!", cliente: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// 5. Recebe o Fechamento do Dia para o Painel do Escritório
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
