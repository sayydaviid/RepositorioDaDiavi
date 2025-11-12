// src/app/avaliacao/ead/relatorioEAD/relatorio-eadead-client.js
'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EadFilters from '../../avalia/components/EadFilters';
import styles from '../../../../styles/dados.module.css';

export default function RelatorioEadClient({ filtersByYear, anosDisponiveis, initialSelected }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ================== Constantes ==================
  const ALL_POLOS_LABEL = 'Todos os Polos';
  const POLO_PLACEHOLDER = 'Selecione o polo desejado';
  const CACHE_ENDPOINT = '/api/reports/ead/cache';

  // Agora cobrindo TODOS os gráficos usados no relatório (mantidos)
  const ALL_CHART_IDS = [
    'chart-dimensoes',
    'chart-medias-dimensoes',
    'chart-boxplot-dimensoes',
    'chart-proporcoes-autoav',
    'chart-boxplot-autoav',
    'chart-medias-itens-autoav',
    'chart-proporcoes-atitude',
    'chart-boxplot-atitude',
    'chart-medias-atitude',
    'chart-proporcoes-gestao',
    'chart-boxplot-gestao',
    'chart-medias-gestao',
    'chart-proporcoes-processo',
    'chart-boxplot-processo',
    'chart-medias-processo',
    'chart-proporcoes-infra',
    'chart-boxplot-infra',
    'chart-medias-infra',
  ];

  const TABLE_IDS = [
    { id: 'table-stats-dimensoes' },
    { id: 'table-stats-autoav' },
    { id: 'table-stats-atitude' },
    { id: 'table-stats-gestao' },
    { id: 'table-stats-processo' },
    { id: 'table-stats-infra' },
  ];

  // espaçamentos (pt)
  const SPACING = {
    afterSectionTitle: 4,
    chartToLegend: 8,
    legendRowGap: 4,
    legendToCaption: 12,
    afterCaption: 10,
    betweenStacked: 16,
    minFreeForTable: 120,
  };

  // =============== estado/seleção =================
  const preferredAno =
    (initialSelected?.ano && String(initialSelected.ano)) ||
    (Array.isArray(anosDisponiveis) && anosDisponiveis.includes('2025') ? '2025' : (anosDisponiveis?.[0] || ''));

  const [selected, setSelected] = useState({
    ano: preferredAno,
    curso: initialSelected?.curso || '',
    polo: initialSelected?.polo || '',
  });

  const yearDef = selected.ano
    ? (filtersByYear[selected.ano] || { hasPolos: false, polos: [], cursos: [] })
    : { hasPolos: false, polos: [], cursos: [] };

  const isAllPolos =
    !!yearDef.hasPolos &&
    (selected.polo === ALL_POLOS_LABEL || selected.polo === '__ALL__' || selected.polo === 'todos');

  const is2025 = selected.ano === '2025';

  // Quando for 2025 e existir apenas 1 curso, seleciona automaticamente e oculta o campo curso.
  useEffect(() => {
    if (!selected.ano) return;
    const def = filtersByYear[selected.ano] || { cursos: [], hasPolos: false };
    if (def.hasPolos && def.cursos?.length === 1) {
      const only = def.cursos[0] || '';
      if (only && selected.curso !== only) {
        const next = { ...selected, curso: only };
        setSelected(next);
        const sp = new URLSearchParams(searchParams.toString());
        sp.set('ano', next.ano);
        sp.set('curso', only);
        router.replace(sp.toString() ? `?${sp.toString()}` : '?');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.ano, filtersByYear]);

  // Campos visíveis na UI
  const visibleFields = useMemo(() => {
    if (!selected.ano) return ['ano'];
    if (yearDef.hasPolos) return ['ano', 'polo']; // 2025: mostra polo, oculta curso
    return ['ano', 'curso'];                       // 2023: mostra curso, oculta polo
  }, [selected.ano, yearDef.hasPolos]);

  // ====== APENAS UI dos filtros ======
  const filters = useMemo(() => {
    const polosLimpos = (yearDef.polos || []).filter((p) => p && p !== ALL_POLOS_LABEL);
    return {
      anos: anosDisponiveis,
      cursos: selected.ano ? (yearDef.cursos || []) : [],
      polos: (selected.ano && yearDef.hasPolos) ? [...polosLimpos] : [],
      disciplinas: [],
      dimensoes: [],
    };
  }, [anosDisponiveis, selected.ano, yearDef]);

  const syncURL = (next) => {
    const sp = new URLSearchParams(searchParams.toString());
    next.ano ? sp.set('ano', next.ano) : sp.delete('ano');
    if (next.curso) sp.set('curso', next.curso);
    else sp.delete('curso');

    if (next.ano && filtersByYear[next.ano]?.hasPolos && next.polo && next.polo !== ALL_POLOS_LABEL) {
      sp.set('polo', next.polo);
    } else {
      sp.delete('polo');
    }
    router.replace(sp.toString() ? `?${sp.toString()}` : '?');
  };

  // ===================== bloqueio & controle (overlay + progresso) =====================
  const [blocking, setBlocking] = useState(false);
  const [forceBlocking, setForceBlocking] = useState(false); // polo único força bloqueio
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Preparando…');

  const [cacheHitUrl, setCacheHitUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const prevUrlRef = useRef('');

  // container que fica "inert" quando bloqueado
  const contentRef = useRef(null);

  // Bloqueio por “Todos os Polos” (checagem/geração) OU bloqueio forçado (polo único)
  useEffect(() => {
    const shouldBlockForAllPolos =
      yearDef.hasPolos && isAllPolos && !(cacheHitUrl || pdfUrl);

    const shouldBlock = forceBlocking || shouldBlockForAllPolos;

    setBlocking(shouldBlock);

    if (shouldBlock) {
      if (!forceBlocking) {
        setProgress((p) => (p > 0 ? p : 3));
        setProgressText(isAllPolos ? 'Preparando geração para todos os polos…' : 'Gerando PDF…');
      }
      // remove foco e torna conteúdo inerte
      try { document.activeElement?.blur?.(); } catch {}
      try {
        if (contentRef.current) {
          contentRef.current.setAttribute('inert', '');
          contentRef.current.style.pointerEvents = 'none';
        }
      } catch {}
    } else {
      // reativa conteúdo
      try {
        if (contentRef.current) {
          contentRef.current.removeAttribute('inert');
          contentRef.current.style.pointerEvents = '';
        }
      } catch {}
      if (!isAllPolos) {
        setProgress(0);
        setProgressText('Preparando…');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceBlocking, isAllPolos, yearDef.hasPolos, cacheHitUrl, pdfUrl]);

  // Bloqueio também trava rolagem
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    if (blocking) html.style.overflow = 'hidden';
    else html.style.overflow = prev || '';
    return () => { html.style.overflow = prev || ''; };
  }, [blocking]);

  // Previne interação por teclado (Tab/Enter/Espaço/Setas) quando bloqueado
  useEffect(() => {
    const handler = (e) => {
      if (!blocking) return;
      const keys = ['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (keys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [blocking]);

  // ====== progresso automático enquanto bloqueado ======
  const progressTimerRef = useRef(null);
  useEffect(() => {
    const hasResult = !!pdfUrl || !!cacheHitUrl;
    const isBlockedGenerating = blocking && !hasResult;
    if (!isBlockedGenerating) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }

    const cap = isAllPolos ? 95 : 88; // teto antes de finalizar de fato
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= cap) return p; // não passa do teto; buildPdf depois leva a 100
        if (p < 20) return p + 2.0;
        if (p < 50) return p + 1.4;
        if (p < 70) return p + 0.9;
        return p + 0.5;
      });
    }, 450);

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [blocking, isAllPolos, pdfUrl, cacheHitUrl]);
const handleFilterChange = (e) => {
  const key = e?.target?.name;
  let value = e?.target?.value ?? '';
  if (key === 'polo' && (value === POLO_PLACEHOLDER || value === '')) value = '';

  const selectingAllPolosNow =
    key === 'polo' && (value === ALL_POLOS_LABEL || value === '__ALL__' || value === 'todos');

  const next = { ...selected, [key]: value };

  // ===== comportamento IMEDIATO ao trocar de polo =====
  if (key === 'polo') {
    // some o PDF já exibido e bloqueia imediatamente
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
    setPdfUrl('');
    setPdfError('');
    setCacheHitUrl('');

    if (selectingAllPolosNow) {
      setForceBlocking(false); // para "Todos os Polos", o effect decide
      setProgress((p) => (p < 8 ? 8 : p));
      setProgressText('Preparando geração para todos os polos…');
    } else {
      // polo único -> forçar bloqueio de geração
      setForceBlocking(true);
      setProgress(8); // inicia em 8% e o auto-progress cuida do resto
      setProgressText('Gerando PDF…');
    }
  }

  // ✅ BLOQUEIO TAMBÉM QUANDO O ANO NÃO TEM POLOS (ex.: 2023) E O USUÁRIO ESCOLHE UM CURSO
  if (key === 'curso') {
    // Limpa PDF e cache a cada mudança de curso
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
    setPdfUrl('');
    setPdfError('');
    setCacheHitUrl('');

    // Se o ano selecionado NÃO tem polos (2023) e o valor de curso não está vazio, força bloqueio
    const def = filtersByYear[selected.ano] || { hasPolos: false };
    if (!def.hasPolos && value) {
      setForceBlocking(true);
      setProgress((p) => (p < 8 ? 8 : p));
      setProgressText('Gerando PDF…');
    } else if (!value) {
      // se limpar o curso, remove o bloqueio forçado
      setForceBlocking(false);
      setProgress(0);
      setProgressText('Preparando…');
    }
  }

  if (key === 'ano') {
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
    setPdfUrl('');
    setPdfError('');
    setCacheHitUrl('');
    next.curso = '';
    next.polo = '';
    setForceBlocking(false);
    setProgress(0);
    setProgressText('Preparando…');
  }

  if (key === 'curso' && !selected.ano) next.curso = '';
  if (key === 'polo' && !(selected.ano && yearDef.hasPolos)) next.polo = '';

  setSelected(next);
  syncURL(next);
};

  /* =========================
     GERAÇÃO DO PDF AO VIVO + CACHE
     ========================= */
  const canGenerate = !!selected.ano && (yearDef.hasPolos ? !!selected.polo : !!selected.curso);

  // ========= IFRAME COM O DASHBOARD =========
  const chartsIframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);

  const iframeSrc = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('ano', selected.ano || '');
    if (selected.curso) sp.set('curso', selected.curso);
    if (yearDef.hasPolos && selected.polo && !isAllPolos) sp.set('polo', selected.polo);
    sp.set('embedForPdf', '1');
    return `/avaliacao/ead?${sp.toString()}`;
  }, [selected.ano, selected.curso, selected.polo, yearDef.hasPolos, isAllPolos]);

  useEffect(() => { setIframeReady(false); }, [iframeSrc]);

  // ============= helpers comuns (mantidos onde afetam gráficos) =============
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const getIframeDoc = () => {
    const ifr = chartsIframeRef.current;
    return ifr?.contentWindow?.document || ifr?.contentDocument || null;
  };
  const getIframeWin = () => chartsIframeRef.current?.contentWindow || null;

  const clampPct = (v) => Math.floor(Math.max(0, Math.min(100, v)));

  const nudgeIframeLayout = () => {
    const ifr = chartsIframeRef.current;
    if (!ifr) return;
    try {
      const win = ifr.contentWindow;
      if (!win) return;
      void ifr.offsetHeight;
      win.dispatchEvent(new win.Event('resize'));
      if (win.scrollTo) win.scrollTo(0, 1);
    } catch {}
  };

  const ensureInView = async (el) => {
    try { el?.scrollIntoView?.({ block: 'center', inline: 'nearest' }); } catch {}
    nudgeIframeLayout();
    await sleep(60);
    nudgeIframeLayout();
    await sleep(60);
  };

  const findChartEl = (doc, id) => {
    if (!doc) return null;
    const el = doc.querySelector(`#${id}`);
    if (!el) return null;
    const c = el.querySelector('canvas');
    const s = el.querySelector('svg');
    if (c && c.width > 0 && c.height > 0) return el;
    if (s) {
      const bb = s.getBBox ? s.getBBox() : null;
      if (!bb || (bb.width > 0 && bb.height > 0)) return el;
    }
    const rect = el.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.height > 0) return el;
    return null;
  };

  const waitForChart = async (id, timeoutMs = 12000) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const el = findChartEl(getIframeDoc(), id);
      if (el) return el;
      nudgeIframeLayout();
      await sleep(90);
    }
    console.warn(`Timeout esperando pelo gráfico/tabela: #${id}`);
    return null;
  };

  const waitForManyCharts = async (ids, timeoutMs = 12000) => {
    const end = performance.now() + timeoutMs;
    const pending = new Set(ids);
    while (pending.size && performance.now() < end) {
      const doc = getIframeDoc();
      for (const id of Array.from(pending)) {
        if (findChartEl(doc, id)) pending.delete(id);
      }
      if (!pending.size) break;
      nudgeIframeLayout();
      await sleep(120);
    }
    return pending.size === 0;
  };

  const elementToPngDataUrl = async (el) => {
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const clone = el.cloneNode(true);
    clone.style.background = '#ffffff';
    const serializer = new XMLSerializer();
    const xhtml = serializer.serializeToString(clone);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
         <foreignObject width="100%" height="100%">${xhtml}</foreignObject>
       </svg>`;
    const svg64 = typeof window.btoa === 'function' ? window.btoa(unescape(encodeURIComponent(svg))) : '';
    const dataUrl = `data:image/svg+xml;base64,${svg64}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || w;
    c.height = img.naturalHeight || h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  };

  const getDataUrlFromChartContainer = async (containerId) => {
    const el = await waitForChart(containerId, 12000);
    if (!el) return null;

    const tryOnce = async () => {
      await ensureInView(el);

      const canvas = el.querySelector('canvas');
      if (canvas) {
        try {
          const data = canvas.toDataURL('image/png');
          if (data && data.length > 1000) return data;
        } catch {}
      }

      const svg = el.querySelector('svg');
      if (svg) {
        try {
          const cloned = svg.cloneNode(true);
          cloned.setAttribute('style', 'background:#ffffff');
          const serializer = new XMLSerializer();
          const svgStr = serializer.serializeToString(cloned);
          const svg64 = typeof window.btoa === 'function' ? window.btoa(unescape(encodeURIComponent(svgStr))) : '';
          const image64 = `data:image/svg+xml;base64,${svg64}`;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = image64; });
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 1600;
          c.height = img.naturalHeight || 900;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0);
          const data = c.toDataURL('image/png');
          if (data && data.length > 1000) return data;
        } catch {}
      }

      try {
        const data = await elementToPngDataUrl(el);
        if (data && data.length > 1000) return data;
      } catch {}

      return null;
    };

    for (let i = 0; i < 4; i++) {
      const data = await tryOnce();
      if (data) return data;
      nudgeIframeLayout();
      await sleep(120 + i * 60);
    }
    console.warn('Falha ao capturar container:', containerId);
    return null;
  };

  // ==== helpers específicos dos polos ====
  const getCleanPolos = () => {
    const all = yearDef?.polos || [];
    return all.filter(p =>
      p &&
      p !== ALL_POLOS_LABEL &&
      p !== '__ALL__' &&
      String(p).toLowerCase() !== 'todos'
    );
  };

  const loadDashboardFor = async ({ ano, curso, poloName }) => {
    const ifr = chartsIframeRef.current;
    if (!ifr) return;

    const sp = new URLSearchParams();
    sp.set('ano', ano || '');
    if (curso) sp.set('curso', curso);
    if (yearDef.hasPolos && poloName) sp.set('polo', String(poloName));
    sp.set('embedForPdf', '1');
    const target = `/avaliacao/ead?${sp.toString()}`;

    await new Promise((resolve) => {
      const onLoad = async () => {
        ifr.removeEventListener('load', onLoad);
        await sleep(200);
        nudgeIframeLayout();
        resolve();
      };
      ifr.addEventListener('load', onLoad);
      setIframeReady(false);
      ifr.src = target;
    });

    await sleep(150);
  };

  const mergeWithExternalPdf = async (basePdfBytes, externalPdfPath) => {
    const { PDFDocument } = await import('pdf-lib');
    const basePdf = await PDFDocument.load(basePdfBytes);
    try {
      const extBytes = await (await fetch(externalPdfPath)).arrayBuffer();
      const extPdf = await PDFDocument.load(extBytes);
      const copied = await basePdf.copyPages(extPdf, extPdf.getPageIndices());
      copied.forEach((p) => basePdf.addPage(p));
    } catch {}
    const merged = await basePdf.save();
    return new Blob([merged], { type: 'application/pdf' });
  };

  // ===== helpers visuais de PDF (mantidos) =====
  const drawImageContain = async (doc, dataUrl, boxX, boxY, boxW, boxH, fmt = 'PNG') => {
    if (!dataUrl) return { finalH: 0, yPos: boxY };
    const loadImg = (src) =>
      new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve({ w: im.naturalWidth || im.width, h: im.naturalHeight || im.height });
        im.onerror = reject;
        im.src = src;
      });

    const { w, h } = await loadImg(dataUrl);
    if (!w || !h) return { finalH: 0, yPos: boxY };

    const scale = Math.min(boxW / w, boxH / h);
    const drawW = w * scale;
    const drawH = h * scale;

    const x = boxX + (boxW - drawW) / 2;
    const y = boxY;

    doc.addImage(dataUrl, fmt, x, y, drawW, drawH, undefined, 'FAST');
    return { finalH: drawH, yPos: y };
  };

  const fetchAsDataUrl = async (url) => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  };

  const drawLegendFactory = (doc, pageWidth) => (yLegend, items, opts = {}) => {
    const LEGENDA_ITEMS = items || [
      { label: 'Excelente',    color: '#1D556F' },
      { label: 'Bom',          color: '#288FB4' },
      { label: 'Regular',      color: '#F0B775' },
      { label: 'Insuficiente', color: '#FA360A' },
    ];
    const { fontSize = 9, box = 8, textGap = 4, itemGap = 8, left = 40, right = 40, maxWidth = null } = opts;

    doc.setFont('helvetica','normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(0,0,0);

    const usable = (maxWidth ?? (pageWidth - left - right));
    const lines = [[]];
    let lineW = 0;

    LEGENDA_ITEMS.forEach((it) => {
      const labelW = doc.getTextWidth(it.label);
      const w = box + textGap + labelW;
      const addW = (lines[lines.length-1].length ? itemGap : 0) + w;
      if (lineW + addW > usable && lines[lines.length-1].length) { lines.push([it]); lineW = w; }
      else { lines[lines.length-1].push(it); lineW += addW; }
    });

    let currentY = yLegend;
    lines.forEach((row, idx) => {
      const rowW = row.reduce((acc, it, i) => acc + (i ? itemGap : 0) + (box + textGap + doc.getTextWidth(it.label)), 0);
      let x = (pageWidth - rowW) / 2;
      row.forEach((it) => {
        doc.setFillColor(it.color);
        doc.rect(x, currentY - box + 1, box, box, 'F');
        x += box + textGap;
        doc.text(it.label, x, currentY);
        x += doc.getTextWidth(it.label) + itemGap;
      });
      if (idx < lines.length - 1) currentY += fontSize + SPACING.legendRowGap;
    });

    const totalHeight = (currentY - yLegend) + fontSize;
    return yLegend + totalHeight;
  };

  const buildingRef = useRef(false);

  // ====== helpers de cache (somente para "Todos os Polos") ======
  const fetchCachedUrl = async (ano, curso) => {
    try {
      const sp = new URLSearchParams({ ano: ano || '', curso: curso || '' });
      const r = await fetch(`${CACHE_ENDPOINT}?${sp.toString()}`, { method: 'GET' });
      if (r.ok) {
        const j = await r.json();
        return j?.url || null;
      }
    } catch {}
    return null;
  };

  const saveToCache = async (blob, ano, curso) => {
    try {
      const fd = new FormData();
      fd.append('ano', ano || '');
      fd.append('curso', curso || '');
      fd.append('file', new File([blob], 'todos-os-polos.pdf', { type: 'application/pdf' }));
      const r = await fetch(CACHE_ENDPOINT, { method: 'POST', body: fd });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.url || null;
    } catch { return null; }
  };

  // ====== Gate de cache: checar apenas 1x por seleção ======
  const cacheDecisionRef = useRef({ sig: '', decided: false });
  const selSig = useMemo(() => {
    return `${selected.ano || ''}::${selected.curso || ''}::${yearDef.hasPolos && isAllPolos ? 'todos' : 'single'}`;
  }, [selected.ano, selected.curso, yearDef.hasPolos, isAllPolos]);

  useEffect(() => {
    cacheDecisionRef.current = { sig: selSig, decided: false };
    setCacheHitUrl('');
  }, [selSig]);

  // ====== Cancelamento global para geração ======
  const cancelledRef = useRef(false);

  // =================== Função de geração (fora do effect) ===================
  async function buildPdf() {
    if (buildingRef.current) return;
    buildingRef.current = true;

    setPdfError('');
    if (!canGenerate || !iframeReady) {
      if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
      setPdfUrl('');
      buildingRef.current = false;
      return;
    }

    // Ativa messaging se for “Todos os Polos” ou se foi forçado (polo único)
    if (isAllPolos || forceBlocking) {
      setProgress((p) => (p > 12 ? p : 12));
      setProgressText(isAllPolos ? 'Preparando geração para todos os polos…' : 'Gerando PDF…');
    }

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = margin;
      let FIG_NO = 1;

      const drawLegend = drawLegendFactory(doc, pageWidth);
      const addFigureCaption = (yCap, caption) => {
        if (!caption) return yCap;
        doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
        const text = `Figura ${FIG_NO} — ${caption}`;
        const textLines = doc.splitTextToSize(text, pageWidth - 2*margin);
        doc.text(textLines, pageWidth/2, yCap, { align:'center' });
        FIG_NO += 1;
        const textHeight = doc.getTextDimensions(textLines).h;
        return yCap + textHeight;
      };
      const drawCenteredWrapped = (text, y0, maxWidth, size) => {
        doc.setFont('helvetica','bold'); doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, pageWidth/2, y0, { align: 'center' });
        const lh = size*0.55 + 4;
        return y0 + lines.length*lh;
      };

      // CAPA
      try {
        const capaDataUrl = await fetchAsDataUrl('/capa_avalia.png');
        const coverMarginX = 36, coverMarginY = 48;
        await drawImageContain(doc, capaDataUrl, coverMarginX, coverMarginY, pageWidth - 2*coverMarginX, pageHeight - 2*coverMarginY, 'PNG');
      } catch {}

      // APRESENTAÇÃO
      doc.addPage(); y = margin;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text(`APRESENTAÇÃO DO RELATÓRIO AVALIA ${selected.ano}`, pageWidth/2, y, { align:'center' });
      y += 22;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
      const paragraphs = [
        'A Autoavaliação dos Cursos de Graduação a Distância da UFPA (AVALIA EAD) é coordenada pela CPA em parceria com a DIAVI/PROPLAN.',
        'O AVALIA-EAD visa captar a percepção discente sobre o curso, apoiando melhorias nas condições de ensino e aprendizagem.',
        'O formulário contempla 3 dimensões: Autoavaliação, Ação Docente (Atitude, Gestão e Processo Avaliativo) e Infra/Recursos de TI.',
        'Resultados referentes ao Período Letivo 2025-2, com escala de 1 (Insuficiente) a 4 (Excelente) e opção “Não se Aplica”.',
        'Representações gráficas: barras (percentuais e médias) e boxplots (distribuição de médias por disciplina/docente).',
      ];
      for (let i=0;i<paragraphs.length;i++){
        const lines = doc.splitTextToSize(paragraphs[i], pageWidth - 2*margin);
        doc.text(lines, margin, y); y += lines.length*13 + 6;
        if (y > pageHeight - margin - 200 && i < paragraphs.length - 1) { doc.addPage(); y = margin; }
      }
      try {
        const boxplotInfo = await fetchAsDataUrl('/boxplot.jpeg');
        const boxMaxW = pageWidth - 2*margin, boxMaxH = 240;
        const spaceLeft = pageHeight - y - margin;
        if (spaceLeft < boxMaxH + 12) { doc.addPage(); y = margin; }
        const { finalH, yPos } = await drawImageContain(doc, boxplotInfo, margin, y, boxMaxW, boxMaxH, 'JPEG');
        const yAfter = yPos + finalH + SPACING.legendToCaption;
        addFigureCaption(yAfter, 'Exemplo de Boxplot');
      } catch {}

      // ========= laço por POLO =========
      const polosToRender = yearDef.hasPolos
        ? (isAllPolos ? getCleanPolos() : [selected.polo])
        : [null];

      for (let idx = 0; idx < polosToRender.length; idx++) {
        if (cancelledRef.current) break;

        const poloName = polosToRender[idx];

        // 🔑 SEMPRE recarrega o dashboard para o polo atual (corrige herança indevida)
        setProgressText(
          isAllPolos
            ? `Carregando dados do polo ${idx+1}/${polosToRender.length}…`
            : `Carregando dados do polo selecionado…`
        );
        await loadDashboardFor({ ano: selected.ano, curso: selected.curso, poloName });

        if (isAllPolos && yearDef.hasPolos) {
          const totalPolos = polosToRender.length || 1;
          setProgress((p) => Math.min(95, Math.max(p, Math.round(((idx + 0.4) / totalPolos) * 100))));
          await sleep(120);
        }

        // Capa da seção curso/polo
        doc.addPage();
        const titulo1 = `RELATÓRIO AVALIA ${selected.ano}`;
        const campus  = poloName || 'Campus/Polo';
        const titulo2 = `${selected.curso || 'Curso'} - ${campus}`;
        let yT = drawCenteredWrapped(titulo1, pageHeight/2 - 22, pageWidth - 2*margin, 20);
        drawCenteredWrapped(titulo2, yT + 6, pageWidth - 2*margin, 15);

        // Dimensões gerais + tabelas
        const dimHint = await addSectionDimensoesGerais(doc, pageWidth, pageHeight, margin, drawLegend, addFigureCaption);
        const dimTableCursor = await addStatsTableSmart(doc, pageHeight, pageWidth, margin, 'table-stats-dimensoes', dimHint);

        const autoHint = await addThreeChartsSection(doc, pageWidth, pageHeight, margin, drawLegend, addFigureCaption, {
          title: 'Autoavaliação Discente',
          bigChartId: 'chart-proporcoes-autoav',
          midChartId: 'chart-boxplot-autoav',
          smallChartId: 'chart-medias-itens-autoav',
          bigChartSubTitle: `Proporções de Respostas por Item (${selected.ano})`,
          midChartSubTitle: `Boxplot das Médias por Item (${selected.ano})`,
          smallChartSubTitle: `Médias dos Itens (${selected.ano})`,
          startHint: dimTableCursor,
        });
        const autoTableCursor = await addStatsTableSmart(doc, pageHeight, pageWidth, margin, 'table-stats-autoav', autoHint);

        const atiHint = await addThreeChartsSection(doc, pageWidth, pageHeight, margin, drawLegend, addFigureCaption, {
          title: 'Atitude Profissional',
          bigChartId: 'chart-proporcoes-atitude',
          midChartId: 'chart-boxplot-atitude',
          smallChartId: 'chart-medias-atitude',
          bigChartSubTitle: `Proporções de Respostas por Item (${selected.ano})`,
          midChartSubTitle: `Boxplot das Médias por Item (${selected.ano})`,
          smallChartSubTitle: `Médias dos Itens (${selected.ano})`,
          startHint: autoTableCursor,
        });
        const atiTableCursor = await addStatsTableSmart(doc, pageHeight, pageWidth, margin, 'table-stats-atitude', atiHint);

        const gesHint = await addThreeChartsSection(doc, pageWidth, pageHeight, margin, drawLegend, addFigureCaption, {
          title: 'Gestão Didática',
          bigChartId: 'chart-proporcoes-gestao',
          midChartId: 'chart-boxplot-gestao',
          smallChartId: 'chart-medias-gestao',
          bigChartSubTitle: `Proporções de Respostas por Item (${selected.ano})`,
          midChartSubTitle: `Boxplot das Médias por Item (${selected.ano})`,
          smallChartSubTitle: `Médias dos Itens (${selected.ano})`,
          startHint: atiTableCursor,
        });
        const gesTableCursor = await addStatsTableSmart(doc, pageHeight, pageWidth, margin, 'table-stats-gestao', gesHint);

        const proHint = await addThreeChartsSection(doc, pageWidth, pageHeight, margin, drawLegend, addFigureCaption, {
          title: 'Processo Avaliativo',
          bigChartId: 'chart-proporcoes-processo',
          midChartId: 'chart-boxplot-processo',
          smallChartId: 'chart-medias-processo',
          bigChartSubTitle: `Proporções de Respostas por Item (${selected.ano})`,
          midChartSubTitle: `Boxplot das Médias por Item (${selected.ano})`,
          smallChartSubTitle: `Médias dos Itens (${selected.ano})`,
          startHint: gesTableCursor,
        });
        const proTableCursor = await addStatsTableSmart(doc, pageHeight, pageWidth, margin, 'table-stats-processo', proHint);

        const infHint = await addThreeChartsSection(doc, pageWidth, pageHeight, margin, drawLegend, addFigureCaption, {
          title: 'Instalações Físicas e Recursos de TI',
          bigChartId: 'chart-proporcoes-infra',
          midChartId: 'chart-boxplot-infra',
          smallChartId: 'chart-medias-infra',
          bigChartSubTitle: `Proporções de Respostas por Item (${selected.ano})`,
          midChartSubTitle: `Boxplot das Médias por Item (${selected.ano})`,
          smallChartSubTitle: `Médias dos Itens (${selected.ano})`,
          startHint: proTableCursor,
        });
        await addStatsTableSmart(doc, pageHeight, pageWidth, margin, 'table-stats-infra', infHint);

        if (isAllPolos && yearDef.hasPolos) {
          const totalPolos = polosToRender.length || 1;
          const pct = Math.min(95, Math.round(((idx + 1) / totalPolos) * 100));
          setProgressText(`Gerando páginas ${idx+1}/${totalPolos}…`);
          setProgress(pct);
        }
      }

      if (isAllPolos && yearDef.hasPolos) {
        setProgressText('Anexando questionário…');
        setProgress((p) => Math.max(p, 96));
      }

      const baseBlob = doc.output('blob');
      const baseBytes = await baseBlob.arrayBuffer();
      let questionarioPdfPath = '/questionario_disc.pdf';
      if (selected.ano === '2025')      questionarioPdfPath = '/questionario_disc_2025.pdf';
      else if (selected.ano === '2023') questionarioPdfPath = '/questionario_disc_2025.pdf';
      const finalBlob = await mergeWithExternalPdf(baseBytes, questionarioPdfPath);

      if (isAllPolos && yearDef.hasPolos) {
        setProgressText('Finalizando PDF…');
        setProgress(99);
      }

      const url = URL.createObjectURL(finalBlob);
      if (!cancelledRef.current) {
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = url;
        setPdfUrl(url);

        // Salva no cache apenas para "Todos os Polos"
        if (yearDef.hasPolos && isAllPolos) {
          saveToCache(finalBlob, selected.ano, selected.curso || '').catch(() => {});
        }

        setProgressText('Concluído!');
        setProgress(100);
      } else {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setPdfError('Não foi possível gerar o PDF. Verifique os filtros ou recarregue a página.');
      if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
      setPdfUrl('');
    } finally {
      buildingRef.current = false;
      // encerra qualquer bloqueio forçado (polo único) ao final da geração
      setForceBlocking(false);
      // desliga bloqueio
      setBlocking(false);
    }
  }

  // =================== Efeito principal com gate de cache ===================
  useEffect(() => {
    cancelledRef.current = false;

    async function decideCacheOnce() {
      if (!canGenerate) {
        if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
        setPdfUrl('');
        return;
      }

      const isTodos = yearDef.hasPolos && isAllPolos && !!selected.ano;

      if (cacheDecisionRef.current.sig === selSig && cacheDecisionRef.current.decided) {
        return;
      }

      cacheDecisionRef.current.sig = selSig;
      cacheDecisionRef.current.decided = true;

      if (isTodos) {
        setProgress((p) => (p < 8 ? 8 : p));
        setProgressText('Verificando cache…');

        const cached = await fetchCachedUrl(selected.ano, selected.curso || '');
        if (!cancelledRef.current && cached) {
          setCacheHitUrl(cached);
          if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
          setPdfUrl(cached);
          setProgressText('Carregado do cache.');
          setProgress(100);
          setForceBlocking(false);
          setBlocking(false);
          return;
        }

        setProgressText('Cache não encontrado. Gerando…');
        setProgress((p) => Math.max(p, 12));
      }
    }

    async function maybeBuild() {
      if (cacheHitUrl) return;              // se já veio do cache, não gera
      if (!(canGenerate && iframeReady)) return;

      const t = setTimeout(buildPdf, 400);
      return () => clearTimeout(t);
    }

    const p = decideCacheOnce();
    const cleanup = maybeBuild();

    return () => {
      cancelledRef.current = true;
      if (typeof cleanup === 'function') cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate, iframeReady, selSig, cacheHitUrl]);

  // cleanup URL do PDF (apenas para object URLs locais)
  useEffect(() => () => {
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
  }, []);

  const downloadName = `relatorio-avalia-${selected.ano}-${selected.curso || 'curso'}${
    yearDef.hasPolos ? (isAllPolos ? '-todos-os-polos' : (selected.polo ? '-' + selected.polo.replace(/\s+/g, '-').toLowerCase() : '')) : ''
  }.pdf`;

  // Mensagem contextual
  const MissingMsg = () => {
    if (!selected.ano) return <>Selecione <strong>Ano</strong> para começar.</>;
    if (yearDef.hasPolos) return <>Selecione <strong>Polo</strong> para gerar o PDF.</>;
    return <>Selecione <strong>Curso</strong> para gerar o PDF.</>;
  };

  // ================= helpers de seção (gráficos — mantidos) =================
  const addThreeChartsSection = async (doc, pageWidth, pageHeight, margin, drawLegend, addFigureCaption, {
    title, bigChartId, midChartId, smallChartId,
    bigChartSubTitle, midChartSubTitle, smallChartSubTitle,
    startHint
  }) => {
    const imgBig   = await getDataUrlFromChartContainer(bigChartId);
    const imgMid   = await getDataUrlFromChartContainer(midChartId);
    const imgSmall = await getDataUrlFromChartContainer(smallChartId);
    if (!imgBig && !imgMid && !imgSmall) return { page: doc.getNumberOfPages(), y: margin };

    const fullW = pageWidth - 2*margin;
    const titleHeightTmp = doc.getTextDimensions(title).h;
    const needForHeadAndBig = titleHeightTmp + SPACING.afterSectionTitle + 220 + 40;

    let startPage;
    let currentY;
    if (startHint && startHint.page === doc.getNumberOfPages() && (pageHeight - startHint.y - margin) >= needForHeadAndBig) {
      startPage = startHint.page;
      currentY  = startHint.y + 4;
    } else {
      doc.addPage();
      startPage = doc.getNumberOfPages();
      currentY  = margin;
    }

    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text(title, pageWidth/2, currentY, { align: 'center' });
    const titleHeight = doc.getTextDimensions(title).h;
    currentY = currentY + titleHeight + SPACING.afterSectionTitle;

    if (imgBig) {
      const boxH = 220;
      const { finalH, yPos } = await drawImageContain(doc, imgBig, margin, currentY, fullW, boxH, 'PNG');
      currentY = yPos + finalH;
      currentY += SPACING.chartToLegend;
      currentY = drawLegend(currentY);
      currentY += SPACING.legendToCaption;
      currentY = addFigureCaption(currentY, bigChartSubTitle || 'Gráfico');
      currentY += SPACING.afterCaption;
    }

    if (imgMid) {
      currentY += SPACING.betweenStacked;
      let room = pageHeight - currentY - margin;
      const midH = 190;
      if (room < midH + 80) { doc.addPage(); currentY = margin; }
      const { finalH, yPos } = await drawImageContain(doc, imgMid, margin, currentY, fullW, midH, 'PNG');
      currentY = yPos + finalH + SPACING.legendToCaption;
      currentY = addFigureCaption(currentY, midChartSubTitle || 'Boxplot');
      currentY += SPACING.afterCaption;
    }

    if (imgSmall) {
      currentY += SPACING.betweenStacked;
      let room = pageHeight - currentY - margin;
      if (room < 120) { doc.addPage(); currentY = margin; room = pageHeight - currentY - margin; }
      const { finalH, yPos } = await drawImageContain(doc, imgSmall, margin, currentY, fullW, Math.max(140, Math.min(room, 260)), 'PNG');
      const yAfter = yPos + finalH + SPACING.legendToCaption;
      addFigureCaption(yAfter, smallChartSubTitle || 'Médias');
      currentY = yAfter;
    }

    return { page: startPage, y: currentY };
  };

  const addSectionDimensoesGerais = async (doc, pageWidth, pageHeight, margin, drawLegend, addFigureCaption) => {
    const imgProporcoes = await getDataUrlFromChartContainer('chart-dimensoes');
    const imgMedias     = await getDataUrlFromChartContainer('chart-medias-dimensoes');
    const imgBoxplot    = await getDataUrlFromChartContainer('chart-boxplot-dimensoes');
    if (!imgProporcoes && !imgMedias && !imgBoxplot) return { page: doc.getNumberOfPages(), y: margin };

    doc.addPage();
    const startPage = doc.getNumberOfPages();
    const title = 'Dimensões Gerais';
    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text(title, pageWidth/2, margin, { align: 'center' });

    const titleHeight = doc.getTextDimensions(title).h;
    let currentY = margin + titleHeight + SPACING.afterSectionTitle;
    const fullW = pageWidth - 2*margin;

    if (imgProporcoes) {
      const boxH = 300;
      const { finalH, yPos } = await drawImageContain(doc, imgProporcoes, margin, currentY, fullW, boxH, 'PNG');
      currentY = yPos + finalH;
      currentY += SPACING.chartToLegend;
      currentY = drawLegend(currentY);
      currentY += SPACING.legendToCaption;
      currentY = addFigureCaption(currentY, `Proporções por Dimensão (${selected.ano})`);
      currentY += SPACING.afterCaption;
    }

    if (imgMedias) {
      const desiredH = 180;
      const room = pageHeight - currentY - margin;
      if (room < desiredH + 60) { doc.addPage(); currentY = margin + titleHeight; }
      const { finalH, yPos } = await drawImageContain(doc, imgMedias, margin, currentY, fullW, Math.max(desiredH, Math.min(room, 260)), 'PNG');
      currentY = yPos + finalH + SPACING.legendToCaption;
      currentY = addFigureCaption(currentY, `Médias por Dimensão (${selected.ano})`);
      currentY += SPACING.afterCaption;
    }

    if (imgBoxplot) {
      const minBoxH = 160;
      let room = pageHeight - currentY - margin;
      if (room < minBoxH + 40) { doc.addPage(); currentY = margin + titleHeight; room = pageHeight - currentY - margin; }
      const targetH = Math.max(minBoxH, Math.min(room, 260));
      const { finalH, yPos } = await drawImageContain(doc, imgBoxplot, margin, currentY, fullW, targetH, 'PNG');
      currentY = yPos + finalH + SPACING.legendToCaption;
      currentY = addFigureCaption(currentY, `Boxplot das Médias por Dimensão (${selected.ano})`);
    }

    return { page: startPage, y: currentY };
  };

  const addStatsTableSmart = async (doc, pageHeight, pageWidth, margin, tableId, hint) => {
    const img = await getDataUrlFromChartContainer(tableId);
    if (!img) return { page: doc.getNumberOfPages(), y: margin };
    const fullW = pageWidth - 2*margin;

    let pageToDraw = doc.getNumberOfPages();
    let yStart = margin;

    if (hint && hint.page === doc.getNumberOfPages()) {
      const remaining = pageHeight - hint.y - margin;
      if (remaining >= SPACING.minFreeForTable) {
        pageToDraw = hint.page;
        yStart = hint.y + 8;
      } else {
        doc.addPage();
        pageToDraw = doc.getNumberOfPages();
        yStart = margin;
      }
    } else {
      doc.addPage();
      pageToDraw = doc.getNumberOfPages();
      yStart = margin;
    }

    const maxH = pageHeight - yStart - margin;
    const { finalH, yPos } = await drawImageContain(doc, img, margin, yStart, fullW, maxH, 'PNG');

    return { page: pageToDraw, y: yPos + finalH + 10 };
  };

  // =================== RENDER ===================
  return (
    <div>
      {/* Conteúdo que fica inerte quando bloqueado */}
      <div ref={contentRef}>
        {/* Filtros */}
        <div className={styles.filtersContainer}>
          <EadFilters
            filters={filters}
            selectedFilters={selected}
            onFilterChange={handleFilterChange}
            visibleFields={visibleFields}
            poloPlaceholder={POLO_PLACEHOLDER}
            disablePlaceholderOption
            showAllPolosOption
            allPolosLabel={ALL_POLOS_LABEL}
          />
        </div>

        {/* IFRAME “visível” com transparência */}
        <iframe
          ref={chartsIframeRef}
          src={iframeSrc}
          title="Fonte dos gráficos para o PDF"
          style={{
            position: 'absolute',
            left: -99999,
            top: -99999,
            width: 1600,
            height: 3000, // mantido
            opacity: 0,
            pointerEvents: 'none'
          }}
          onLoad={() => setIframeReady(true)}
        />

        {/* Preview / Download */}
        <div style={{ marginTop: 16 }}>
          {!canGenerate ? (
            <div className={styles.errorMessage} style={{ padding: 12 }}>
              <MissingMsg />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    download={downloadName}
                    className={styles.applyButton}
                  >
                    Baixar PDF
                  </a>
                )}
                {pdfError && <span className={styles.errorMessage} style={{ padding: 8 }}>{pdfError}</span>}
              </div>

              {pdfUrl ? (
                <iframe
                  title="Preview PDF"
                  src={pdfUrl}
                  style={{ width: '100%', height: '80vh', border: '1px solid #333' }}
                />
              ) : !pdfError ? (
                <div className={styles.errorMessage} style={{ padding: 12 }}>
                  Gerando pré-visualização… {isAllPolos ? '(processando todos os polos)' : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ===== Overlay de bloqueio com barra de progresso ===== */}
      {blocking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            color: '#fff',
            textAlign: 'center',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          aria-modal="true"
          role="dialog"
        >
          <div style={{ fontSize: 18, marginBottom: 14 }}>
            {isAllPolos ? (
              <>Gerando relatório para <strong>Todos os Polos</strong>…</>
            ) : (
              <>Gerando relatório…</>
            )}
          </div>
          <div
            aria-label="Progresso de geração"
            style={{
              width: 'min(720px, 90vw)',
              height: 18,
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.4)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${clampPct(progress)}%`,
                height: '100%',
                background: '#fff',
                borderRadius: 9999,
                transition: 'width 220ms ease',
              }}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9 }}>
              {progressText} &nbsp;•&nbsp; {clampPct(progress)}%
          </div>
          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
            Por favor, aguarde. A página ficará bloqueada até a conclusão.
          </div>
        </div>
      )}
    </div>
  );
}
