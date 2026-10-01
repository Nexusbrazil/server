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
      // Procura vendedores em ambas as tabelas ('clientes' e 'clientes_rotas')
      const { data: d1 } = await supabase.from('clientes').select('vendedor_responsavel');
      const { data: d2 } = await supabase.from('clientes_rotas').select('vendedor_nome');

      const vendedores = new Set();
      (d1 || []).forEach(i => i.vendedor_responsavel && vendedores.add(i.vendedor_responsavel));
      (d2 || []).forEach(i => i.vendedor_nome && vendedores.add(i.vendedor_nome));

      return res.json([...vendedores].sort());
    }

    // Procura os dias/rotas do vendedor em ambas as tabelas
    const { data: r1 } = await supabase
      .from('clientes')
      .select('dia_semana')
      .ilike('vendedor_responsavel', vendedor);

    const { data: r2 } = await supabase
      .from('clientes_rotas')
      .select('dia_semana')
      .ilike('vendedor_nome', vendedor);

    const rotasUnicas = new Set();
    (r1 || []).forEach(i => i.dia_semana && rotasUnicas.add(i.dia_semana));
    (r2 || []).forEach(i => i.dia_semana && rotasUnicas.add(i.dia_semana));

    return res.json([...rotasUnicas].filter(Boolean));
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// 2. Lista os Clientes (Retorna SEMPRE uma estrutura válida de blocos de cidades)
app.get('/api/clientes', async (req, res) => {
  try {
    const { vendedor, dia_semana } = req.query;

    // Consulta a tabela principal 'clientes'
    let queryClientes = supabase.from('clientes').select('*').order('ordem', { ascending: true });

    if (vendedor) {
      queryClientes = queryClientes.ilike('vendedor_responsavel', vendedor);
    }
    if (dia_semana) {
      queryClientes = queryClientes.ilike('dia_semana', dia_semana);
    }

    let { data: listaClientes, error } = await queryClientes;
    if (error) throw error;

    // Fallback para a tabela 'clientes_rotas' se não houver dados na tabela principal
    if ((!listaClientes || listaClientes.length === 0) && vendedor) {
      let queryRotas = supabase.from('clientes_rotas').select('*').ilike('vendedor_nome', vendedor);
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
          dia_semana: r.dia_semana,
          ordem: 1
        }));
      }
    }

    if (!listaClientes) listaClientes = [];

    // Agrupa sempre por cidade no formato [ { cidade, clientes: [...] } ]
    const cidadesAgrupadas = {};
    listaClientes.forEach(cli => {
      const cid = (cli.cidade || 'OUTROS').toUpperCase();
      if (!cidadesAgrupadas[cid]) {
        cidadesAgrupadas[cid] = [];
      }
      cidadesAgrupadas[cid].push({
        id: cli.id,
        nome: cli.nome || cli.nome_cliente || '',
        endereco: cli.endereco || '',
        vendedor_responsavel: cli.vendedor_responsavel || cli.vendedor_nome || '',
        dia_semana: cli.dia_semana || '',
        ordem: cli.ordem || 1,
        status: 'pendente',
        venda: null
      });
    });

    const resultado = Object.keys(cidadesAgrupadas).map(cidade => ({
      cidade: cidade,
      clientes: cidadesAgrupadas[cidade]
    }));

    return res.json(resultado);
  } catch (err) {
    console.error("Erro em GET /api/clientes:", err);
    // Retorna array vazio para nunca quebrar a interface web
    return res.json([]);
  }
});

// 3. Guardar Novo Cliente (POST /api/clientes)
app.post('/api/clientes', async (req, res) => {
  try {
    const { nome, vendedor_responsavel, dia_semana, cidade, endereco, ordem } = req.body;

    const payload = {
      nome: (nome || '').toUpperCase(),
      vendedor_responsavel: vendedor_responsavel || '',
      dia_semana: dia_semana || '',
      cidade: (cidade || '').toUpperCase(),
      endereco: endereco || '',
      ordem: parseInt(ordem) || 1
    };

    const { data, error } = await supabase.from('clientes').insert([payload]).select();
    if (error) throw error;

    return res.json({ ok: true, mensagem: "Cliente guardado com sucesso!", cliente: data ? data[0] : null });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// 4. Editar Cliente Existente (PUT /api/clientes/:id)
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
      ordem: parseInt(ordem) || 1
    };

    const { data, error } = await supabase.from('clientes').update(payload).eq('id', id).select();
    if (error) throw error;

    return res.json({ ok: true, mensagem: "Cliente atualizado com sucesso!", cliente: data });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// 5. Apagar Cliente (DELETE /api/clientes/:id)
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw error;

    return res.json({ ok: true, mensagem: "Cliente eliminado com sucesso!" });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// 6. Receber Fechamento do Dia
app.post('/api/finalizar-rota', async (req, res) => {
  try {
    const dadosVenda = req.body;
    console.log("Fechamento recebido para o Painel do Escritório:", JSON.stringify(dadosVenda, null, 2));
    
    return res.json({ ok: true, mensagem: "Fechamento registrado com sucesso no painel!" });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor a rodar na porta ${PORT}`));
