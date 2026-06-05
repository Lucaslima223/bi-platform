/**
 * server.js  –  Backend BI Corporativo
 * Stack: Node.js + Express + pg (node-postgres)
 *
 * Instalação:
 *   npm install express pg cors dotenv
 *
 * .env:
 *   DB_HOST=localhost
 *   DB_PORT=5432
 *   DB_NAME=powerbi_db
 *   DB_USER=postgres
 *   DB_PASS=sua_senha
 *   PORT=3001
 *   JWT_SECRET=troque_por_uma_chave_segura
 *
 * Execução:
 *   node server.js
 *
 * ─── Mapeamento de tabelas (ETL → PostgreSQL) ───────────────
 *  FUNCIONARIOS       → funcionarios
 *  ESTOQUE            → estoque
 *  METAF              → metaf
 *  METAV              → metav
 *  MOVIMENTO          → movimento  +  movimento_itens
 *  MOVIMENTO_COMPRA   → movimento_compra  +  movimento_compra_itens
 *  PEDIDO_VENDA       → pedido_venda  +  pedido_venda_itens
 *  PEDIDO_COMPRA      → pedido_compra  +  pedido_compra_itens
 *  PRODUCAO           → producao  +  producao_itens
 * ────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import express from "express";
import pg from "pg";
import cors from "cors";
import crypto from "crypto";

const { Pool } = pg;

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Pool de conexão PostgreSQL ───────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME     || "powerbi_db",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASS     || "",
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => console.error("Pool error:", err));

// ─── Middlewares ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Helpers ─────────────────────────────────────────────────
const PT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function ptMonth(mesKey) {
  const m = parseInt((mesKey || "").split("-")[1] || "1", 10);
  return PT_MONTHS[m - 1] || mesKey;
}

/** Intervalo padrão: últimos 12 meses */
function defaultRange(req) {
  const today = new Date();
  const dataf = req.query.dataf || today.toISOString().split("T")[0];
  const d12   = new Date(today);
  d12.setFullYear(d12.getFullYear() - 1);
  const datai = req.query.datai || d12.toISOString().split("T")[0];
  return { datai, dataf };
}

/** Mês atual (1º dia até hoje) */
function currentMonth() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    datai: first.toISOString().split("T")[0],
    dataf: today.toISOString().split("T")[0],
  };
}

async function q(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// ─── Auth em memória (use JWT real em produção) ───────────────
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  req.user = sessions.get(token);
  next();
}

// ═══════════════════════════════════════════════════════════════
//  AUTH
//  Fonte: FUNCIONARIOS → funcionarios
//  Campos: cod_funcionario, nome_funcionario (alias nome), cod_filial
// ═══════════════════════════════════════════════════════════════

app.post("/api/auth/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) {
      return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
    }

    const rows = await q(
      `SELECT cod_funcionario,
              nome   AS nome_funcionario,
              cod_loja_vendedor AS cod_filial,
              loja_vendedor     AS nome_filial,
              cargo,
              inativo
       FROM funcionarios
       WHERE (cod_funcionario = $1 OR LOWER(nome) = LOWER($1))
         AND inativo = false
       LIMIT 1`,
      [usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Usuário não encontrado ou inativo" });
    }

    // ⚠️ Adicione bcrypt para validação real de senha em produção
    const func  = rows[0];
    const token = generateToken();
    sessions.set(token, {
      cod:        func.cod_funcionario,
      nome:       func.nome_funcionario,
      filial:     func.nome_filial || func.cod_filial || "Matriz",
      cod_filial: func.cod_filial,
      cargo:      func.cargo,
    });

    res.json({
      token,
      nome:       func.nome_funcionario,
      filial:     func.nome_filial || func.cod_filial || "Matriz",
      cod_filial: func.cod_filial,
      cargo:      func.cargo,
      perfil:     "usuario",
    });
  } catch (err) {
    console.error("/auth/login:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", authMiddleware, (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  sessions.delete(token);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
//  HOME  –  KPIs resumidos + mini-gráficos
//  Fontes:
//    MOVIMENTO           → faturamento do mês
//    MOVIMENTO_COMPRA    → compras do mês
//    PEDIDO_VENDA        → pedidos em aberto
//    PRODUCAO_ITENS      → ordens em produção
//    ESTOQUE             → saldo por filial (campo: saldo)
//    METAF               → meta vigente por filial
// ═══════════════════════════════════════════════════════════════

app.get("/api/home", async (req, res) => {
  try {
    const { datai, dataf } = defaultRange(req);
    const mes = currentMonth();

    const [
      fatMes, comprasMes,
      pedidosAberto, emProducao,
      estFil, prodStatus, pvStatus,
      vendPeriodo, topVendedores,
    ] = await Promise.all([

      // Faturamento do mês atual
      // MOVIMENTO.data_movimento + MOVIMENTO_ITENS.valor_liquido_total
      q(`SELECT COALESCE(SUM(mi.valor_liquido_total), 0) AS faturamento
         FROM movimento m
         JOIN movimento_itens mi ON mi.cod_operacao = m.cod_operacao
         WHERE m.data_movimento BETWEEN $1 AND $2`, [mes.datai, mes.dataf]),

      // Compras do mês atual
      // MOVIMENTO_COMPRA.data_movimento + MOVIMENTO_COMPRA_ITENS.valor_liquido_total
      q(`SELECT COALESCE(SUM(mi.valor_liquido_total), 0) AS total
         FROM movimento_compra mc
         JOIN movimento_compra_itens mi ON mi.cod_operacao = mc.cod_operacao
         WHERE mc.data_movimento BETWEEN $1 AND $2`, [mes.datai, mes.dataf]),

      // Pedidos de venda em aberto (aprovado mas não efetuado)
      // PEDIDO_VENDA.aprovado / efetuado
      q(`SELECT COUNT(*) AS abertos
         FROM pedido_venda
         WHERE aprovado = true AND efetuado = false`, []),

      // Ordens em produção (soma de qtde_em_producao dos itens)
      // PRODUCAO_ITENS.qtde_em_producao
      q(`SELECT COALESCE(SUM(pi.qtde_em_producao), 0) AS em_producao
         FROM producao p
         JOIN producao_itens pi ON pi.n_ordem = p.n_ordem
         WHERE pi.qtde_em_producao > 0`, []),

      // Estoque por filial — ESTOQUE.filial / saldo
      q(`SELECT filial AS nome_filial,
                COALESCE(SUM(saldo), 0) AS qtde
         FROM estoque
         GROUP BY filial
         ORDER BY qtde DESC`, []),

      // Status produção — PRODUCAO_ITENS.qtde_*
      q(`SELECT
           COALESCE(SUM(pi.qtde_finalizada), 0) AS finalizada,
           COALESCE(SUM(pi.qtde_em_producao), 0) AS em_producao,
           COALESCE(SUM(GREATEST(pi.qtde_inicial - pi.qtde_em_producao - pi.qtde_finalizada, 0)), 0) AS cancelada
         FROM producao p
         JOIN producao_itens pi ON pi.n_ordem = p.n_ordem
         WHERE p.data_inicio BETWEEN $1 AND $2`, [datai, dataf]),

      // Status pedido de venda — PEDIDO_VENDA.aprovado / efetuado
      q(`SELECT
           COUNT(*) FILTER (WHERE aprovado = true  AND efetuado = true)  AS aprovado,
           COUNT(*) FILTER (WHERE aprovado = true  AND efetuado = false) AS a_faturar,
           COUNT(*) FILTER (WHERE aprovado = false)                      AS pendente
         FROM pedido_venda
         WHERE data_emissao BETWEEN $1 AND $2`, [datai, dataf]),

      // Faturamento 12 meses para gráfico de área
      // MOVIMENTO.data_movimento + MOVIMENTO_ITENS.valor_liquido_total
      q(`SELECT TO_CHAR(DATE_TRUNC('month', m.data_movimento), 'YYYY-MM') AS mes_key,
                COALESCE(SUM(mi.valor_liquido_total), 0) AS valor
         FROM movimento m
         JOIN movimento_itens mi ON mi.cod_operacao = m.cod_operacao
         WHERE m.data_movimento BETWEEN $1 AND $2
         GROUP BY mes_key
         ORDER BY mes_key`, [datai, dataf]),

      // Top 5 vendedores — MOVIMENTO.nome_vendedor + MOVIMENTO_ITENS.valor_liquido_total
      q(`SELECT m.nome_vendedor,
                COALESCE(SUM(mi.valor_liquido_total), 0) AS valor_liquido,
                COUNT(DISTINCT m.cod_operacao)            AS operacoes
         FROM movimento m
         JOIN movimento_itens mi ON mi.cod_operacao = m.cod_operacao
         WHERE m.data_movimento BETWEEN $1 AND $2
           AND m.nome_vendedor IS NOT NULL
         GROUP BY m.nome_vendedor
         ORDER BY valor_liquido DESC
         LIMIT 5`, [datai, dataf]),
    ]);

    const ps = prodStatus[0] || {};
    const pv = pvStatus[0]   || {};

    res.json({
      kpis: {
        faturamento:    parseFloat(fatMes[0]?.faturamento   || 0),
        compras:        parseFloat(comprasMes[0]?.total     || 0),
        pedidos_aberto: parseInt(pedidosAberto[0]?.abertos  || 0),
        em_producao:    parseInt(emProducao[0]?.em_producao || 0),
      },
      vendas_periodo: vendPeriodo.map(r => ({
        mes:   ptMonth(r.mes_key),
        valor: parseFloat(r.valor),
      })),
      top_vendedores: topVendedores.map(r => ({
        nome_vendedor: r.nome_vendedor,
        valor_liquido: parseFloat(r.valor_liquido),
        operacoes:     parseInt(r.operacoes),
      })),
      estoque_filial: estFil.map(r => ({
        nome_filial: r.nome_filial,
        qtde:        parseInt(r.qtde || 0),
      })),
      producao_status: [
        { name:"Finalizada",  value: parseInt(ps.finalizada  || 0), color:"#10b981" },
        { name:"Em Produção", value: parseInt(ps.em_producao || 0), color:"#f09b1c" },
        { name:"Cancelada",   value: parseInt(ps.cancelada   || 0), color:"#ef4444" },
      ],
      pedido_venda_status: [
        { name:"Aprovado",  value: parseInt(pv.aprovado  || 0), color:"#10b981" },
        { name:"A Faturar", value: parseInt(pv.a_faturar || 0), color:"#f09b1c" },
        { name:"Pendente",  value: parseInt(pv.pendente  || 0), color:"#ef4444" },
      ],
    });
  } catch (err) {
    console.error("/home:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  VENDAS
//  Fontes:
//    MOVIMENTO           → data_movimento, cod_operacao, cod_vendedor,
//                          nome_vendedor, fantasia_filial
//    MOVIMENTO_ITENS     → valor_liquido_total, quantidade, descricao_grupo
//    METAF               → valor_meta, data_inicial, data_final, cod_filial
//    METAV               → valor_meta, data_inicial, data_final, cod_funcionario
// ═══════════════════════════════════════════════════════════════

app.get("/api/vendas", async (req, res) => {
  try {
    const { datai, dataf } = defaultRange(req);

    const [kpis, metaTotal, periodo, metaPeriodo, vendedores, metaVend, filiais, grupos] =
      await Promise.all([

        // KPIs base — MOVIMENTO + MOVIMENTO_ITENS
        q(`SELECT
             COALESCE(SUM(mi.valor_liquido_total), 0)                                           AS faturamento,
             COUNT(DISTINCT m.cod_operacao)                                                      AS operacoes,
             COALESCE(SUM(mi.valor_liquido_total) / NULLIF(COUNT(DISTINCT m.cod_operacao),0),0) AS ticket_medio
           FROM movimento m
           JOIN movimento_itens mi ON mi.cod_operacao = m.cod_operacao
           WHERE m.data_movimento BETWEEN $1 AND $2`, [datai, dataf]),

        // Meta total no período — METAF.valor_meta (soma de todas as filiais vigentes)
        q(`SELECT COALESCE(SUM(valor_meta), 0) AS meta_total
           FROM metaf
           WHERE data_inicial <= $2 AND data_final >= $1`, [datai, dataf]),

        // Faturamento mês a mês — MOVIMENTO + MOVIMENTO_ITENS
        q(`SELECT TO_CHAR(DATE_TRUNC('month', m.data_movimento), 'YYYY-MM') AS mes_key,
                  COALESCE(SUM(mi.valor_liquido_total), 0) AS valor
           FROM movimento m
           JOIN movimento_itens mi ON mi.cod_operacao = m.cod_operacao
           WHERE m.data_movimento BETWEEN $1 AND $2
           GROUP BY mes_key
           ORDER BY mes_key`, [datai, dataf]),

        // Meta por mês — METAF.valor_meta, data_inicial, data_final
        // Distribui o valor_meta igualmente pelos meses de vigência
        q(`SELECT TO_CHAR(DATE_TRUNC('month', gs.dt), 'YYYY-MM') AS mes_key,
                  COALESCE(SUM(mf.valor_meta / NULLIF(
                    (DATE_PART('year', mf.data_final::date) - DATE_PART('year', mf.data_inicial::date)) * 12 +
                    DATE_PART('month', mf.data_final::date) - DATE_PART('month', mf.data_inicial::date) + 1
                  , 0)), 0) AS meta
           FROM metaf mf,
                generate_series(mf.data_inicial::date, mf.data_final::date, '1 month'::interval) AS gs(dt)
           WHERE gs.dt BETWEEN $1 AND $2
           GROUP BY mes_key
           ORDER BY mes_key`, [datai, dataf]),

        // Ranking vendedores — MOVIMENTO.nome_vendedor + MOVIMENTO_ITENS.valor_liquido_total
        q(`SELECT m.cod_vendedor,
                  m.nome_vendedor,
                  COALESCE(SUM(mi.valor_liquido_total), 0) AS valor_liquido,
                  COUNT(DISTINCT m.cod_operacao)            AS operacoes
           FROM movimento m
           JOIN movimento_itens mi ON mi.cod_operacao = m.cod_operacao
           WHERE m.data_movimento BETWEEN $1 AND $2
             AND m.nome_vendedor IS NOT NULL
           GROUP BY m.cod_vendedor, m.nome_vendedor
           ORDER BY valor_liquido DESC
           LIMIT 10`, [datai, dataf]),

        // Meta por vendedor — METAV.valor_meta, cod_funcionario
        q(`SELECT cod_funcionario,
                  COALESCE(SUM(valor_meta), 0) AS meta_total
           FROM metav
           WHERE data_inicial <= $2 AND data_final >= $1
           GROUP BY cod_funcionario`, [datai, dataf]),

        // Faturamento por filial — MOVIMENTO.fantasia_filial + MOVIMENTO_ITENS
        q(`SELECT m.fantasia_filial AS nome_filial,
                  COALESCE(SUM(mi.valor_liquido_total), 0) AS valor_liquido
           FROM movimento m
           JOIN movimento_itens mi ON mi.cod_operacao = m.cod_operacao
           WHERE m.data_movimento BETWEEN $1 AND $2
           GROUP BY m.fantasia_filial
           ORDER BY valor_liquido DESC`, [datai, dataf]),

        // Mix por grupo — MOVIMENTO_ITENS.descricao_grupo, valor_liquido_total
        q(`SELECT mi.descricao_grupo,
                  COALESCE(SUM(mi.valor_liquido_total), 0) AS valor
           FROM movimento m
           JOIN movimento_itens mi ON mi.cod_operacao = m.cod_operacao
           WHERE m.data_movimento BETWEEN $1 AND $2
             AND mi.descricao_grupo IS NOT NULL
           GROUP BY mi.descricao_grupo
           ORDER BY valor DESC
           LIMIT 6`, [datai, dataf]),
      ]);

    const k        = kpis[0]     || {};
    const fatTotal = parseFloat(k.faturamento || 0);
    const metaT    = parseFloat(metaTotal[0]?.meta_total || 0);

    // Mapeia meta por vendedor para lookup
    const metaVendMap = {};
    for (const mv of metaVend) {
      metaVendMap[mv.cod_funcionario] = parseFloat(mv.meta_total || 0);
    }

    // Mapeia meta mensal para merge com período
    const metaMesMap = {};
    for (const mm of metaPeriodo) {
      metaMesMap[mm.mes_key] = parseFloat(mm.meta || 0);
    }

    // Calcula % de grupo relativo ao total
    const totalGrupo = grupos.reduce((s, g) => s + parseFloat(g.valor), 0) || 1;

    res.json({
      kpis: {
        faturamento:  fatTotal,
        ticket_medio: parseFloat(k.ticket_medio || 0),
        operacoes:    parseInt(k.operacoes      || 0),
        meta_pct:     metaT > 0 ? Math.round((fatTotal / metaT) * 1000) / 10 : null,
      },
      periodo: periodo.map(r => ({
        mes:   ptMonth(r.mes_key),
        valor: parseFloat(r.valor),
        meta:  metaMesMap[r.mes_key] ?? null,
      })),
      vendedores: vendedores.map(r => {
        const fat  = parseFloat(r.valor_liquido);
        const meta = metaVendMap[r.cod_vendedor] || 0;
        return {
          nome_vendedor: r.nome_vendedor,
          valor_liquido: fat,
          operacoes:     parseInt(r.operacoes),
          meta_pct:      meta > 0 ? Math.round((fat / meta) * 1000) / 10 : null,
        };
      }),
      filiais: filiais.map(r => ({
        nome_filial:   r.nome_filial,
        valor_liquido: parseFloat(r.valor_liquido),
      })),
      grupos: grupos.map(g => ({
        descricao_grupo: g.descricao_grupo,
        pct:             Math.round((parseFloat(g.valor) / totalGrupo) * 100),
      })),
    });
  } catch (err) {
    console.error("/vendas:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  COMPRAS
//  Fontes:
//    MOVIMENTO_COMPRA       → cod_operacao, cod_fornecedor, nome_fornecedor,
//                             data_movimento
//    MOVIMENTO_COMPRA_ITENS → valor_liquido_total, descricao_categoria
// ═══════════════════════════════════════════════════════════════

app.get("/api/compras", async (req, res) => {
  try {
    const { datai, dataf } = defaultRange(req);

    const [kpis, periodo, fornecedores, porCategoria] = await Promise.all([

      // KPIs — MOVIMENTO_COMPRA + MOVIMENTO_COMPRA_ITENS
      q(`SELECT
           COALESCE(SUM(mi.valor_liquido_total), 0)                                           AS total,
           COUNT(DISTINCT mc.cod_operacao)                                                     AS operacoes,
           COALESCE(SUM(mi.valor_liquido_total)/NULLIF(COUNT(DISTINCT mc.cod_operacao),0),0)  AS ticket_medio,
           COUNT(DISTINCT mc.cod_fornecedor)                                                   AS fornecedores_ativos
         FROM movimento_compra mc
         JOIN movimento_compra_itens mi ON mi.cod_operacao = mc.cod_operacao
         WHERE mc.data_movimento BETWEEN $1 AND $2`, [datai, dataf]),

      // Compras por mês — MOVIMENTO_COMPRA.data_movimento
      q(`SELECT TO_CHAR(DATE_TRUNC('month', mc.data_movimento), 'YYYY-MM') AS mes_key,
                COALESCE(SUM(mi.valor_liquido_total), 0) AS valor
         FROM movimento_compra mc
         JOIN movimento_compra_itens mi ON mi.cod_operacao = mc.cod_operacao
         WHERE mc.data_movimento BETWEEN $1 AND $2
         GROUP BY mes_key
         ORDER BY mes_key`, [datai, dataf]),

      // Top fornecedores — MOVIMENTO_COMPRA.nome_fornecedor
      q(`SELECT mc.nome_fornecedor,
                COALESCE(SUM(mi.valor_liquido_total), 0) AS valor_liquido,
                COUNT(DISTINCT mc.cod_operacao)           AS operacoes
         FROM movimento_compra mc
         JOIN movimento_compra_itens mi ON mi.cod_operacao = mc.cod_operacao
         WHERE mc.data_movimento BETWEEN $1 AND $2
           AND mc.nome_fornecedor IS NOT NULL
         GROUP BY mc.nome_fornecedor
         ORDER BY valor_liquido DESC
         LIMIT 10`, [datai, dataf]),

      // Compras por categoria — MOVIMENTO_COMPRA_ITENS.descricao_categoria
      q(`SELECT COALESCE(mi.descricao_categoria, 'Outros') AS desc,
                COALESCE(SUM(mi.valor_liquido_total), 0)   AS valor
         FROM movimento_compra mc
         JOIN movimento_compra_itens mi ON mi.cod_operacao = mc.cod_operacao
         WHERE mc.data_movimento BETWEEN $1 AND $2
           AND mi.descricao_categoria IS NOT NULL
         GROUP BY mi.descricao_categoria
         ORDER BY valor DESC
         LIMIT 6`, [datai, dataf]),
    ]);

    const k = kpis[0] || {};
    res.json({
      kpis: {
        total:               parseFloat(k.total               || 0),
        operacoes:           parseInt(k.operacoes             || 0),
        ticket_medio:        parseFloat(k.ticket_medio        || 0),
        fornecedores_ativos: parseInt(k.fornecedores_ativos   || 0),
      },
      periodo:       periodo.map(r => ({ mes: ptMonth(r.mes_key), valor: parseFloat(r.valor) })),
      fornecedores:  fornecedores.map(r => ({
        nome_fornecedor: r.nome_fornecedor,
        valor_liquido:   parseFloat(r.valor_liquido),
        operacoes:       parseInt(r.operacoes),
      })),
      por_categoria: porCategoria.map(r => ({
        desc:  r.desc,
        valor: parseFloat(r.valor),
      })),
    });
  } catch (err) {
    console.error("/compras:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  PRODUÇÃO
//  Fontes:
//    PRODUCAO       → n_ordem, grupo_ordem, tipo_producao,
//                     data_pre_fase, data_inicio, data_previsto, pedidov
//    PRODUCAO_ITENS → qtde_inicial, qtde_em_producao, qtde_finalizada,
//                     descricao_grupo, descricao1 (produto)
// ═══════════════════════════════════════════════════════════════

app.get("/api/producao", async (req, res) => {
  try {
    const { datai, dataf } = defaultRange(req);

    const [kpis, periodo, ordens] = await Promise.all([

      // KPIs — agrupa itens de todas as ordens no período
      q(`SELECT
           COUNT(DISTINCT p.n_ordem)                                                          AS ordens_total,
           COALESCE(SUM(pi.qtde_em_producao), 0)                                             AS em_producao,
           COALESCE(SUM(pi.qtde_finalizada), 0)                                              AS finalizadas,
           COALESCE(SUM(GREATEST(pi.qtde_inicial - pi.qtde_em_producao - pi.qtde_finalizada, 0)), 0) AS canceladas
         FROM producao p
         JOIN producao_itens pi ON pi.n_ordem = p.n_ordem
         WHERE p.data_inicio BETWEEN $1 AND $2`, [datai, dataf]),

      // Produção por mês — PRODUCAO.data_inicio + PRODUCAO_ITENS.qtde_*
      q(`SELECT TO_CHAR(DATE_TRUNC('month', p.data_inicio), 'YYYY-MM') AS mes_key,
                COALESCE(SUM(pi.qtde_inicial), 0)    AS qtde_inicial,
                COALESCE(SUM(pi.qtde_finalizada), 0) AS qtde_finalizada
         FROM producao p
         JOIN producao_itens pi ON pi.n_ordem = p.n_ordem
         WHERE p.data_inicio BETWEEN $1 AND $2
         GROUP BY mes_key
         ORDER BY mes_key`, [datai, dataf]),

      // Ordens recentes — PRODUCAO + PRODUCAO_ITENS (agrupado por ordem)
      q(`SELECT p.n_ordem, p.grupo_ordem, p.tipo_producao, p.data_previsto,
                COALESCE(SUM(pi.qtde_inicial), 0)     AS qtde_inicial,
                COALESCE(SUM(pi.qtde_em_producao), 0) AS qtde_em_producao,
                COALESCE(SUM(pi.qtde_finalizada), 0)  AS qtde_finalizada
         FROM producao p
         JOIN producao_itens pi ON pi.n_ordem = p.n_ordem
         WHERE p.data_inicio BETWEEN $1 AND $2
         GROUP BY p.n_ordem, p.grupo_ordem, p.tipo_producao, p.data_previsto
         ORDER BY p.data_previsto DESC
         LIMIT 20`, [datai, dataf]),
    ]);

    const k    = kpis[0] || {};
    const fin  = parseInt(k.finalizadas  || 0);
    const emp  = parseInt(k.em_producao  || 0);
    const canc = parseInt(k.canceladas   || 0);

    res.json({
      kpis: {
        ordens_total: parseInt(k.ordens_total || 0),
        em_producao:  emp,
        finalizadas:  fin,
        canceladas:   canc,
      },
      status: [
        { name:"Finalizada",  value: fin,  color:"#10b981" },
        { name:"Em Produção", value: emp,  color:"#f09b1c" },
        { name:"Cancelada",   value: canc, color:"#ef4444" },
      ],
      periodo: periodo.map(r => ({
        mes:             ptMonth(r.mes_key),
        qtde_inicial:    parseInt(r.qtde_inicial),
        qtde_finalizada: parseInt(r.qtde_finalizada),
      })),
      ordens: ordens.map(r => ({
        n_ordem:          r.n_ordem,
        grupo_ordem:      r.grupo_ordem,
        tipo_producao:    r.tipo_producao,
        qtde_inicial:     parseInt(r.qtde_inicial     || 0),
        qtde_em_producao: parseInt(r.qtde_em_producao || 0),
        qtde_finalizada:  parseInt(r.qtde_finalizada  || 0),
        data_previsto:    r.data_previsto
          ? new Date(r.data_previsto).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" })
          : "—",
      })),
    });
  } catch (err) {
    console.error("/producao:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  ESTOQUE
//  Fonte: ESTOQUE
//  Campos: filial, cod_filial, produto, cod_produto, descricao1,
//          saldo, empenho, fisico, descricao_grupo, descricao_categoria
// ═══════════════════════════════════════════════════════════════

app.get("/api/estoque", async (req, res) => {
  try {
    const COLORS = ["#3b82f6","#f09b1c","#8b5cf6","#10b981","#64748b"];

    const [kpis, porFilial, topProdutos, porGrupo] = await Promise.all([

      // KPIs — ESTOQUE.saldo, produto, filial
      q(`SELECT
           COUNT(DISTINCT produto)                       AS skus_total,
           COUNT(DISTINCT filial)                        AS filiais,
           COALESCE(SUM(saldo), 0)                       AS total_saldo,
           COALESCE(SUM(empenho), 0)                     AS total_empenho,
           COALESCE(SUM(fisico), 0)                      AS total_fisico
         FROM estoque`),

      // Estoque por filial — ESTOQUE.filial + saldo
      q(`SELECT filial AS nome_filial,
                COALESCE(SUM(saldo), 0)  AS qtde,
                COALESCE(SUM(empenho),0) AS empenho,
                COALESCE(SUM(fisico),0)  AS fisico
         FROM estoque
         GROUP BY filial
         ORDER BY qtde DESC`),

      // Top produtos por saldo — ESTOQUE.produto, descricao1, filial, saldo, empenho, fisico
      q(`SELECT cod_produto,
                MAX(descricao1)      AS descricao1,
                MAX(filial)          AS filial,
                MAX(descricao_grupo) AS descricao_grupo,
                SUM(saldo)           AS saldo,
                SUM(empenho)         AS empenho,
                SUM(fisico)          AS fisico
         FROM estoque
         GROUP BY cod_produto
         ORDER BY saldo DESC
         LIMIT 20`),

      // Distribuição por grupo — ESTOQUE.descricao_grupo + saldo
      q(`SELECT COALESCE(descricao_grupo, 'Outros') AS name,
                SUM(saldo) AS value
         FROM estoque
         GROUP BY descricao_grupo
         ORDER BY value DESC
         LIMIT 5`).catch(() => []),
    ]);

    const k = kpis[0] || {};

    res.json({
      kpis: {
        skus_total:   parseInt(k.skus_total   || 0),
        valor_total:  null,   // requer custo_unitario; calcule externamente
        filiais:      parseInt(k.filiais      || 0),
        giro_medio:   null,   // requer histórico de saídas
        total_saldo:  parseInt(k.total_saldo  || 0),
        total_empenho:parseInt(k.total_empenho|| 0),
        total_fisico: parseInt(k.total_fisico || 0),
      },
      por_filial: porFilial.map(r => ({
        nome_filial: r.nome_filial,
        qtde:        parseInt(r.qtde    || 0),
        empenho:     parseInt(r.empenho || 0),
        fisico:      parseInt(r.fisico  || 0),
      })),
      top_produtos: topProdutos.map(r => ({
        cod_produto:     r.cod_produto,
        descricao1:      r.descricao1,
        filial:          r.filial,
        descricao_grupo: r.descricao_grupo,
        saldo:           parseInt(r.saldo   || 0),
        empenho:         parseInt(r.empenho || 0),
        fisico:          parseInt(r.fisico  || 0),
        quantidade:      parseInt(r.saldo   || 0), // alias para compatibilidade frontend
      })),
      por_grupo: porGrupo.map((r, i) => ({
        name:  r.name,
        value: parseInt(r.value || 0),
        color: COLORS[i] || COLORS[4],
      })),
    });
  } catch (err) {
    console.error("/estoque:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  PEDIDO DE VENDA
//  Fonte: PEDIDO_VENDA
//  Campos: pedidov, cod_pedidov, cod_filial, nome_filial,
//    data_emissao, data_aprovacao, data_entrega, aprovado, efetuado,
//    status_workflow_pedido, tipo_pedido_venda, cliente, cod_vendedor,
//    nome_vendedor, quantidade_pedido, valor_bruto_pedido,
//    desconto_pedido, frete_pedido, valor_liquido_pedido
//  Itens (pedido_venda_itens): qtde_item_afaturar, qtde_item_faturada,
//    qtde_item_cancelada, qtde_item_reservado, qtde_item_entregue
// ═══════════════════════════════════════════════════════════════

app.get("/api/pedido_venda", async (req, res) => {
  try {
    const { datai, dataf } = defaultRange(req);

    const [kpis, porStatus, periodo, pedidos] = await Promise.all([

      // KPIs — PEDIDO_VENDA + soma de itens
      q(`SELECT
           COUNT(*)                                                        AS total,
           COUNT(*) FILTER (WHERE aprovado = true)                        AS aprovados,
           COUNT(*) FILTER (WHERE aprovado = true AND efetuado = false)   AS a_faturar,
           COALESCE(SUM(valor_liquido_pedido), 0)                         AS valor_total
         FROM pedido_venda
         WHERE data_emissao BETWEEN $1 AND $2`, [datai, dataf]),

      // Status — PEDIDO_VENDA.aprovado / efetuado
      q(`SELECT
           COUNT(*) FILTER (WHERE aprovado = true  AND efetuado = true)  AS aprovado,
           COUNT(*) FILTER (WHERE aprovado = true  AND efetuado = false) AS a_faturar,
           COUNT(*) FILTER (WHERE aprovado = false)                      AS pendente
         FROM pedido_venda
         WHERE data_emissao BETWEEN $1 AND $2`, [datai, dataf]),

      // Pedidos e valor por mês — PEDIDO_VENDA.data_emissao
      q(`SELECT TO_CHAR(DATE_TRUNC('month', data_emissao), 'YYYY-MM') AS mes_key,
                COUNT(*)                              AS total,
                COALESCE(SUM(valor_liquido_pedido),0) AS valor
         FROM pedido_venda
         WHERE data_emissao BETWEEN $1 AND $2
         GROUP BY mes_key
         ORDER BY mes_key`, [datai, dataf]),

      // Pedidos recentes — todos os campos relevantes
      q(`SELECT pedidov, cod_pedidov, cod_filial, nome_filial,
                cliente, nome_vendedor, cod_vendedor,
                data_emissao, data_entrega,
                valor_bruto_pedido, desconto_pedido, frete_pedido, valor_liquido_pedido,
                aprovado, efetuado,
                status_workflow_pedido, tipo_pedido_venda,
                quantidade_pedido
         FROM pedido_venda
         WHERE data_emissao BETWEEN $1 AND $2
         ORDER BY data_emissao DESC
         LIMIT 30`, [datai, dataf]),
    ]);

    const k  = kpis[0]      || {};
    const ps = porStatus[0] || {};

    res.json({
      kpis: {
        total:       parseInt(k.total       || 0),
        aprovados:   parseInt(k.aprovados   || 0),
        a_faturar:   parseInt(k.a_faturar   || 0),
        valor_total: parseFloat(k.valor_total || 0),
      },
      por_status: [
        { name:"Aprovado",  value: parseInt(ps.aprovado  || 0), color:"#10b981" },
        { name:"A Faturar", value: parseInt(ps.a_faturar || 0), color:"#f09b1c" },
        { name:"Pendente",  value: parseInt(ps.pendente  || 0), color:"#ef4444" },
      ],
      periodo: periodo.map(r => ({
        mes:   ptMonth(r.mes_key),
        total: parseInt(r.total),
        valor: parseFloat(r.valor),
      })),
      pedidos: pedidos.map(r => ({
        pedidov:               r.pedidov,
        cod_pedidov:           r.cod_pedidov,
        cod_filial:            r.cod_filial,
        nome_filial:           r.nome_filial,
        cliente:               r.cliente,
        nome_vendedor:         r.nome_vendedor,
        quantidade_pedido:     parseInt(r.quantidade_pedido || 0),
        valor_bruto_pedido:    parseFloat(r.valor_bruto_pedido    || 0),
        desconto_pedido:       parseFloat(r.desconto_pedido       || 0),
        frete_pedido:          parseFloat(r.frete_pedido          || 0),
        valor_liquido_pedido:  parseFloat(r.valor_liquido_pedido  || 0),
        aprovado:              r.aprovado,
        efetuado:              r.efetuado,
        status_workflow_pedido:r.status_workflow_pedido,
        tipo_pedido_venda:     r.tipo_pedido_venda,
        data_emissao: r.data_emissao
          ? new Date(r.data_emissao).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" })
          : "—",
        data_entrega: r.data_entrega
          ? new Date(r.data_entrega).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" })
          : "—",
      })),
    });
  } catch (err) {
    console.error("/pedido_venda:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  PEDIDO DE COMPRA
//  Fonte: PEDIDO_COMPRA
//  Campos: pedidoc, cod_pedidoc, cod_filial, nome_filial,
//    id_fornecedor, cod_fornecedor, nome_fornecedor, fantasia_fornecedor,
//    cod_comprador, nome_comprador, data_emissao, data_aprovacao,
//    data_entrega, aprovado, efetuado, status_workflow_pedido,
//    tipo_pedido_compra, quantidade_pedido, valor_bruto_pedido,
//    desconto_pedido, cortesia_pedido, frete_pedido, valor_liquido_pedido
// ═══════════════════════════════════════════════════════════════

app.get("/api/pedido_compra", async (req, res) => {
  try {
    const { datai, dataf } = defaultRange(req);

    const [kpis, periodo, pedidos] = await Promise.all([

      // KPIs — PEDIDO_COMPRA
      q(`SELECT
           COUNT(*)                                    AS total,
           COUNT(*) FILTER (WHERE aprovado = true)     AS aprovados,
           COALESCE(SUM(valor_liquido_pedido), 0)      AS valor_total,
           COALESCE(SUM(valor_liquido_pedido) / NULLIF(COUNT(*), 0), 0) AS ticket_medio
         FROM pedido_compra
         WHERE data_emissao BETWEEN $1 AND $2`, [datai, dataf]),

      // Pedidos por mês — PEDIDO_COMPRA.data_emissao
      q(`SELECT TO_CHAR(DATE_TRUNC('month', data_emissao), 'YYYY-MM') AS mes_key,
                COUNT(*)                              AS total,
                COALESCE(SUM(valor_liquido_pedido),0) AS valor
         FROM pedido_compra
         WHERE data_emissao BETWEEN $1 AND $2
         GROUP BY mes_key
         ORDER BY mes_key`, [datai, dataf]),

      // Pedidos recentes — todos os campos relevantes
      q(`SELECT pedidoc, cod_pedidoc, cod_filial, nome_filial,
                cod_fornecedor, nome_fornecedor, fantasia_fornecedor,
                cod_comprador, nome_comprador,
                data_emissao, data_entrega, data_aprovacao,
                quantidade_pedido,
                valor_bruto_pedido, desconto_pedido, cortesia_pedido,
                frete_pedido, valor_liquido_pedido,
                aprovado, efetuado,
                status_workflow_pedido, tipo_pedido_compra
         FROM pedido_compra
         WHERE data_emissao BETWEEN $1 AND $2
         ORDER BY data_emissao DESC
         LIMIT 30`, [datai, dataf]),
    ]);

    const k = kpis[0] || {};
    res.json({
      kpis: {
        total:        parseInt(k.total        || 0),
        aprovados:    parseInt(k.aprovados    || 0),
        valor_total:  parseFloat(k.valor_total  || 0),
        ticket_medio: parseFloat(k.ticket_medio || 0),
      },
      periodo: periodo.map(r => ({
        mes:   ptMonth(r.mes_key),
        total: parseInt(r.total),
        valor: parseFloat(r.valor),
      })),
      pedidos: pedidos.map(r => ({
        pedidoc:               r.pedidoc,
        cod_pedidoc:           r.cod_pedidoc,
        cod_filial:            r.cod_filial,
        nome_filial:           r.nome_filial,
        cod_fornecedor:        r.cod_fornecedor,
        nome_fornecedor:       r.nome_fornecedor,
        fantasia_fornecedor:   r.fantasia_fornecedor,
        nome_comprador:        r.nome_comprador,
        quantidade_pedido:     parseInt(r.quantidade_pedido || 0),
        valor_bruto_pedido:    parseFloat(r.valor_bruto_pedido   || 0),
        desconto_pedido:       parseFloat(r.desconto_pedido      || 0),
        frete_pedido:          parseFloat(r.frete_pedido         || 0),
        valor_liquido_pedido:  parseFloat(r.valor_liquido_pedido || 0),
        aprovado:              r.aprovado,
        efetuado:              r.efetuado,
        status_workflow_pedido:r.status_workflow_pedido,
        tipo_pedido_compra:    r.tipo_pedido_compra,
        data_emissao: r.data_emissao
          ? new Date(r.data_emissao).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" })
          : "—",
        data_entrega: r.data_entrega
          ? new Date(r.data_entrega).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" })
          : "—",
      })),
    });
  } catch (err) {
    console.error("/pedido_compra:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (e) {
    res.status(503).json({ ok: false, db: e.message });
  }
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Servidor BI rodando em http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});