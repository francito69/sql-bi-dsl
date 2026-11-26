let editor;
let dbSchema = {};
let lastResult = { columns: [], rows: [] };
let activeTemplateParams = [];

const DEFAULT_SQL = `SELECT c.nombre AS canal, COUNT(v.id) AS ordenes, SUM(v.total) AS ingresos
FROM ventas v
JOIN canales c ON c.id = v.canal_id
WHERE v.estado = 'completada'
GROUP BY c.nombre
ORDER BY ingresos DESC;`;

// Inicializar Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs' } });
require(['vs/editor/editor.main'], async () => {
  await loadSchema();

  monaco.languages.registerCompletionItemProvider('sql', {
    provideCompletionItems: () => {
      const suggestions = [];
      const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'AS', 'AND', 'OR', 'COUNT', 'SUM', 'AVG', 'ROUND', 'DATE_TRUNC'];
      keywords.forEach((kw) => {
        suggestions.push({ label: kw, kind: monaco.languages.CompletionItemKind.Keyword, insertText: kw });
      });
      Object.entries(dbSchema).forEach(([table, cols]) => {
        suggestions.push({ label: table, kind: monaco.languages.CompletionItemKind.Class, insertText: table, detail: 'Tabla' });
        cols.forEach((col) => {
          suggestions.push({ label: `${table}.${col.name}`, kind: monaco.languages.CompletionItemKind.Field, insertText: col.name, detail: `${table} (${col.type})` });
        });
      });
      return { suggestions };
    },
  });

  editor = monaco.editor.create(document.getElementById('monaco-container'), {
    value: DEFAULT_SQL,
    language: 'sql',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
  });

  editor.onDidChangeModelContent(() => validateCurrentSQL());
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, executeQuery);

  loadTemplates();
  loadQueries();
  loadAlerts();
  executeQuery();
});

async function loadSchema() {
  const res = await fetch('/api/schema');
  const data = await res.json();
  dbSchema = data.schema || {};
  const tree = document.getElementById('schema-tree');
  tree.innerHTML = Object.entries(dbSchema)
    .map(([t, cols]) => `<div class="list-item"><strong>${t}</strong><br><span class="meta-text">${cols.map(c => c.name).join(', ')}</span></div>`)
    .join('');
}

async function validateCurrentSQL() {
  const sql = editor.getValue();
  const params = getTemplateParams();
  const res = await fetch('/api/query/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  const bar = document.getElementById('validation-bar');
  if (data.valid) {
    bar.className = 'validation-bar valid';
    bar.textContent = 'Sintaxis SQL válida (Solo Lectura)';
  } else {
    bar.className = 'validation-bar invalid';
    bar.textContent = data.error;
  }
}

function getTemplateParams() {
  const params = {};
  activeTemplateParams.forEach((p) => {
    const el = document.getElementById(`param-${p.name}`);
    if (el) params[p.name] = el.value;
  });
  return params;
}

function showError(msg) {
  const banner = document.getElementById('error-banner');
  if (!msg) {
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }
  banner.textContent = msg;
  banner.classList.remove('hidden');
}

async function executeQuery() {
  showError(null);
  const sql = editor.getValue();
  const params = getTemplateParams();
  const res = await fetch('/api/query/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!res.ok) {
    showError(data.error);
    return;
  }
  lastResult = data;
  document.getElementById('exec-time').textContent = `${data.executionTimeMs} ms`;
  document.getElementById('row-count').textContent = `${data.rowCount} filas`;
  renderKPIs(data.columns, data.rows);
  renderTable(data.columns, data.rows);
  renderD3Chart();
}

function renderKPIs(columns, rows) {
  const kpiBox = document.getElementById('kpi-cards');
  if (!rows.length) {
    kpiBox.classList.add('hidden');
    return;
  }
  const numCol = columns.find(c => !isNaN(Number(rows[0][c])));
  if (!numCol) {
    kpiBox.classList.add('hidden');
    return;
  }
  const vals = rows.map(r => Number(r[numCol]) || 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  const avg = sum / vals.length;
  const max = Math.max(...vals);
  const fmt = (n) => n.toLocaleString('es-PE', { maximumFractionDigits: 2 });

  kpiBox.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Registros</div><div class="kpi-value">${rows.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Suma (${numCol})</div><div class="kpi-value">${fmt(sum)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Promedio (${numCol})</div><div class="kpi-value">${fmt(avg)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Máximo (${numCol})</div><div class="kpi-value">${fmt(max)}</div></div>
  `;
  kpiBox.classList.remove('hidden');
}

function renderTable(columns, rows) {
  const container = document.getElementById('table-container');
  if (!rows.length) {
    container.innerHTML = '<p class="placeholder">La consulta no devolvió filas.</p>';
    return;
  }
  const thead = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
  const tbody = rows.map(r => `<tr>${columns.map(c => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('');
  container.innerHTML = `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function renderD3Chart() {
  const container = document.getElementById('d3-chart');
  container.innerHTML = '';
  const { columns, rows } = lastResult;
  if (!rows.length || columns.length < 2) return;

  const labelCol = columns[0];
  const valueCol = columns.find(c => !isNaN(Number(rows[0][c]))) || columns[1];
  const chartType = document.getElementById('chart-type').value;

  const width = container.clientWidth || 700;
  const height = 280;
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };

  const svg = d3.select('#d3-chart').append('svg').attr('width', width).attr('height', height);
  const x = d3.scaleBand().domain(rows.map(d => String(d[labelCol]))).range([margin.left, width - margin.right]).padding(0.25);
  const y = d3.scaleLinear().domain([0, d3.max(rows, d => Number(d[valueCol])) || 1]).nice().range([height - margin.bottom, margin.top]);

  svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x)).selectAll('text').attr('fill', '#cbd5e1');
  svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y)).selectAll('text').attr('fill', '#cbd5e1');

  const tooltip = d3.select('#d3-tooltip');

  if (chartType === 'bar') {
    svg.selectAll('rect').data(rows).enter().append('rect')
      .attr('x', d => x(String(d[labelCol])))
      .attr('y', d => y(Number(d[valueCol])))
      .attr('width', x.bandwidth())
      .attr('height', d => height - margin.bottom - y(Number(d[valueCol])))
      .attr('fill', '#3b82f6')
      .on('mousemove', (event, d) => {
        tooltip.classed('hidden', false)
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 28}px`)
          .html(`<strong>${d[labelCol]}</strong><br>${valueCol}: ${Number(d[valueCol]).toLocaleString('es-PE')}`);
      })
      .on('mouseleave', () => tooltip.classed('hidden', true));
  } else {
    const line = d3.line().x(d => x(String(d[labelCol])) + x.bandwidth() / 2).y(d => y(Number(d[valueCol])));
    svg.append('path').datum(rows).attr('fill', 'none').attr('stroke', '#10b981').attr('stroke-width', 2.5).attr('d', line);
    svg.selectAll('circle').data(rows).enter().append('circle')
      .attr('cx', d => x(String(d[labelCol])) + x.bandwidth() / 2)
      .attr('cy', d => y(Number(d[valueCol])))
      .attr('r', 4.5)
      .attr('fill', '#10b981')
      .on('mousemove', (event, d) => {
        tooltip.classed('hidden', false)
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 28}px`)
          .html(`<strong>${d[labelCol]}</strong><br>${valueCol}: ${Number(d[valueCol]).toLocaleString('es-PE')}`);
      })
      .on('mouseleave', () => tooltip.classed('hidden', true));
  }
}

async function loadTemplates() {
  const res = await fetch('/api/templates');
  const data = await res.json();
  const list = document.getElementById('templates-list');
  list.innerHTML = '';
  (data.templates || []).forEach((t) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<strong>${t.nombre}</strong><br><span class="meta-text">${t.descripcion || ''}</span>`;
    div.onclick = () => {
      document.querySelectorAll('#templates-list .list-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      editor.setValue(t.sql_template);
      activeTemplateParams = t.parametros_json || [];
      const pBox = document.getElementById('template-params');
      pBox.innerHTML = activeTemplateParams
        .map(p => `<div><label>${p.name}</label><input id="param-${p.name}" value="${p.default || ''}" placeholder="${p.name}" /></div>`)
        .join('');
      executeQuery();
    };
    list.appendChild(div);
  });
}

async function loadQueries() {
  const res = await fetch('/api/queries');
  const data = await res.json();
  const list = document.getElementById('queries-list');
  list.innerHTML = '';
  (data.queries || []).forEach((q) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<strong>${q.nombre}</strong> <span class="meta-text">(v${q.version_actual})</span>`;
    div.onclick = () => openVersionsModal(q);
    list.appendChild(div);
  });
}

async function openVersionsModal(q) {
  document.getElementById('modal-versions-title').textContent = `Versiones: ${q.nombre}`;
  const res = await fetch(`/api/queries/${q.id}/versions`);
  const data = await res.json();
  const list = document.getElementById('versions-list');
  list.innerHTML = (data.versions || []).map(v => `
    <div class="version-card">
      <strong>v${v.version}</strong> — ${v.comentario || ''}
      <pre>${v.sql_texto}</pre>
      <button class="btn btn-small" onclick="rollbackQuery(${q.id}, ${v.version})">Restaurar v${v.version}</button>
    </div>
  `).join('');
  document.getElementById('modal-versions').classList.remove('hidden');
}

window.rollbackQuery = async (id, version) => {
  const res = await fetch(`/api/queries/${id}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  });
  const data = await res.json();
  if (res.ok) {
    editor.setValue(data.restoredSql);
    document.getElementById('modal-versions').classList.add('hidden');
    loadQueries();
  }
};

async function loadAlerts() {
  const res = await fetch('/api/alerts');
  const data = await res.json();
  const list = document.getElementById('alerts-list');
  list.innerHTML = '';
  (data.alerts || []).forEach((a) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<strong>${a.nombre}</strong> (${a.operador} ${a.umbral})<br><span class="meta-text">Último valor: ${a.ultimo_valor ?? 'N/A'}</span>`;
    div.onclick = async () => {
      const r = await fetch(`/api/alerts/${a.id}/evaluate`, { method: 'POST' });
      const d = await r.json();
      alert(d.mensaje || d.error);
      loadAlerts();
    };
    list.appendChild(div);
  });
}

document.getElementById('btn-run').onclick = executeQuery;
document.getElementById('btn-run-business').onclick = executeQuery;
document.getElementById('chart-type').onchange = renderD3Chart;

document.getElementById('btn-mode-analyst').onclick = () => {
  document.getElementById('btn-mode-analyst').classList.add('active');
  document.getElementById('btn-mode-business').classList.remove('active');
  document.getElementById('editor-wrapper').classList.remove('hidden');
  document.getElementById('business-banner').classList.add('hidden');
  document.querySelectorAll('.analyst-only').forEach(el => el.classList.remove('hidden'));
};

document.getElementById('btn-mode-business').onclick = () => {
  document.getElementById('btn-mode-business').classList.add('active');
  document.getElementById('btn-mode-analyst').classList.remove('active');
  document.getElementById('editor-wrapper').classList.add('hidden');
  document.getElementById('business-banner').classList.remove('hidden');
  document.querySelectorAll('.analyst-only').forEach(el => el.classList.add('hidden'));
};

document.getElementById('btn-export-csv').onclick = () => {
  const { columns, rows } = lastResult;
  if (!rows.length) return;
  const csv = [columns.join(','), ...rows.map(r => columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sql_bi_resultados.csv';
  a.click();
};
document.getElementById('btn-close-versions').onclick = () => document.getElementById('modal-versions').classList.add('hidden');
document.getElementById('btn-new-alert').onclick = () => document.getElementById('modal-alert').classList.remove('hidden');
document.getElementById('btn-close-alert').onclick = () => document.getElementById('modal-alert').classList.add('hidden');

document.getElementById('btn-save-query').onclick = async () => {
  const nombre = prompt('Nombre de la consulta:');
  if (!nombre) return;
  const comentario = prompt('Comentario de esta revisión:', 'Actualización');
  const res = await fetch('/api/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, sql_texto: editor.getValue(), comentario }),
  });
  const data = await res.json();
  if (res.ok) {
    alert(`Guardada como v${data.version}`);
    loadQueries();
  } else {
    alert(data.error);
  }
};

document.getElementById('form-alert').onsubmit = async (e) => {
  e.preventDefault();
  const res = await fetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: document.getElementById('alert-name').value,
      sql_condicion: document.getElementById('alert-sql').value,
      operador: document.getElementById('alert-op').value,
      umbral: document.getElementById('alert-threshold').value,
    }),
  });
  if (res.ok) {
    document.getElementById('modal-alert').classList.add('hidden');
    loadAlerts();
  }
};

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'chart') renderD3Chart();
  };
});
