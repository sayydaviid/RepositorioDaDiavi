// -> ADIÇÃO 1: Importar o Suspense
import { Suspense } from 'react';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';

import EadDashboardClient from './EadDashboardClient';
import styles from '../../../styles/dados.module.css';
import { Users, BarChart, HardDrive, BookOpen } from 'lucide-react';
import { dimensionMapEad } from '../lib/questionMappingEad';

// helpers para limpar valores ruins de disciplina (remove "-- / 0" e afins)
const hasLetters = (s) => /[A-Za-zÀ-ÿ]/.test(String(s || ''));
const isBadDisc = (s) => {
  const v = String(s || '').trim();
  if (!v) return true;
  if (v === '-- / 0' || v === '--/0' || v === '--' || v === '-' || v === '—' || v === '0') return true;
  if (/^[\s–—\-_/]*0?\s*$/.test(v)) return true; // só traços/barras/zeros
  if (/^--/.test(v) || /\/\s*0$/.test(v)) return true; // começa com "--" ou termina com "/ 0"
  if (!hasLetters(v)) return true;
  return false;
};

// Função para ler e processar o arquivo CSV
async function getEadInitialData() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'app', 'banco', 'AUTOAVALIAÇÃO DOS CURSOS DE GRADUAÇÃO A DISTÂNCIA - 2025-2.csv');
    const csvData = fs.readFileSync(filePath, 'utf8');

    const parsedData = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    const data = parsedData.data;

    // --- 1. Calcular Dados para os Cards de Resumo ---
    const total_respondentes = new Set(data.map(row => row['Nome de usuário'])).size;

    const countBy = (arr, key) => arr.reduce((acc, row) => {
        const value = row[key];
        if (value) {
            acc[value] = (acc[value] || 0) + 1;
        }
        return acc;
    }, {});

    const poloCounts = countBy(data, 'Qual o seu Polo de Vinculação?');
    const cursoCounts = countBy(data, 'Qual é o seu Curso?');

    const findMax = (counts) => Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'N/A');

    const polo_mais_respostas = findMax(poloCounts);
    const curso_mais_respostas = findMax(cursoCounts);

    const scoreMap = { 'Excelente': 4, 'Bom/Boa': 3, 'Regular': 2, 'Insuficiente/Ruim': 1 };
    // Headers das questões (textuais) do CSV 2025
    const questionHeaders = parsedData.meta.fields.filter(h => /^\d+\)/.test(h) && !h.includes('['));

    let totalScore = 0;
    let validAnswersCount = 0;
    data.forEach(row => {
        questionHeaders.forEach(header => {
            const answer = row[header];
            const score = scoreMap[answer];
            if (score) {
                totalScore += score;
                validAnswersCount++;
            }
        });
    });
    const media_geral = validAnswersCount > 0 ? (totalScore / validAnswersCount) : 0;

    const summaryData = {
      total_respostas: [total_respondentes],
      polo_mais_respostas: [polo_mais_respostas],
      curso_mais_respostas: [curso_mais_respostas],
      media_geral: [media_geral]
    };


    // --- 2. Calcular Dados para o Gráfico de Dimensões ---
    const dimensions = {
      'Autoavaliação Discente': questionHeaders.slice(0, 13),
      'Avaliação da Ação Docente': questionHeaders.slice(13, 35),
      'Instalações Físicas e Recursos de TI': questionHeaders.slice(35, 45)
    };

    const dimensoesData = Object.entries(dimensions).flatMap(([dimensao, headers]) => {
        const counts = { 'Excelente': 0, 'Bom/Boa': 0, 'Regular': 0, 'Insuficiente/Ruim': 0 };
        let totalInCategory = 0;

        data.forEach(row => {
            headers.forEach(header => {
                const answer = row[header];
                if (counts.hasOwnProperty(answer)) {
                    counts[answer]++;
                    totalInCategory++;
                }
            });
        });
        
        return Object.entries(counts).map(([conceito, valor]) => ({
            dimensao,
            conceito: conceito.replace('/Boa', '').replace('/Ruim', ''),
            valor: totalInCategory > 0 ? (valor / totalInCategory) * 100 : 0
        }));
    });

    // --- LÓGICA PARA GRÁFICOS DE ITENS INDIVIDUAIS ---
    const autoavHeaders = questionHeaders.slice(0, 13);
    const autoavaliacaoItensData = autoavHeaders.flatMap(header => {
        const counts = { 'Excelente': 0, 'Bom/Boa': 0, 'Regular': 0, 'Insuficiente/Ruim': 0 };
        let totalInItem = 0;
        data.forEach(row => {
            const answer = row[header];
            if (counts.hasOwnProperty(answer)) {
                counts[answer]++;
                totalInItem++;
            }
        });
        const itemLabelMatch = header.match(/^(\d+)\)/);
        const itemLabel = itemLabelMatch ? itemLabelMatch[1] : header;
        return Object.entries(counts).map(([conceito, valor]) => ({
            item: itemLabel,
            conceito: conceito.replace('/Boa', '').replace('/Ruim', ''),
            valor: totalInItem > 0 ? (valor / totalInItem) * 100 : 0
        }));
    });

    const atitudeHeaders = questionHeaders.slice(13, 19);
    const acaoDocenteAtitudeData = atitudeHeaders.flatMap(header => {
        const counts = { 'Excelente': 0, 'Bom/Boa': 0, 'Regular': 0, 'Insuficiente/Ruim': 0 };
        let totalInItem = 0;
        data.forEach(row => {
            const answer = row[header];
            if (counts.hasOwnProperty(answer)) {
                counts[answer]++;
                totalInItem++;
            }
        });
        const itemLabelMatch = header.match(/^(\d+)\)/);
        const itemLabel = itemLabelMatch ? itemLabelMatch[1] : header;
        return Object.entries(counts).map(([conceito, valor]) => ({
            item: itemLabel,
            conceito: conceito.replace('/Boa', '').replace('/Ruim', ''),
            valor: totalInItem > 0 ? (valor / totalInItem) * 100 : 0
        }));
    });

    const gestaoHeaders = questionHeaders.slice(19, 30);
    const acaoDocenteGestaoData = gestaoHeaders.flatMap(header => {
        const counts = { 'Excelente': 0, 'Bom/Boa': 0, 'Regular': 0, 'Insuficiente/Ruim': 0 };
        let totalInItem = 0;
        data.forEach(row => {
            const answer = row[header];
            if (counts.hasOwnProperty(answer)) {
                counts[answer]++;
                totalInItem++;
            }
        });
        const itemLabelMatch = header.match(/^(\d+)\)/);
        const itemLabel = itemLabelMatch ? itemLabelMatch[1] : header;
        return Object.entries(counts).map(([conceito, valor]) => ({
            item: itemLabel,
            conceito: conceito.replace('/Boa', '').replace('/Ruim', ''),
            valor: totalInItem > 0 ? (valor / totalInItem) * 100 : 0
        }));
    });

    const processoHeaders = questionHeaders.slice(30, 35);
    const acaoDocenteProcessoData = processoHeaders.flatMap(header => {
        const counts = { 'Excelente': 0, 'Bom/Boa': 0, 'Regular': 0, 'Insuficiente/Ruim': 0 };
        let totalInItem = 0;
        data.forEach(row => {
            const answer = row[header];
            if (counts.hasOwnProperty(answer)) {
                counts[answer]++;
                totalInItem++;
            }
        });
        const itemLabelMatch = header.match(/^(\d+)\)/);
        const itemLabel = itemLabelMatch ? itemLabelMatch[1] : header;
        return Object.entries(counts).map(([conceito, valor]) => ({
            item: itemLabel,
            conceito: conceito.replace('/Boa', '').replace('/Ruim', ''),
            valor: totalInItem > 0 ? (valor / totalInItem) * 100 : 0
        }));
    });

    const infraHeaders = questionHeaders.slice(35, 45);
    const infraestruturaItensData = infraHeaders.flatMap(header => {
        const counts = { 'Excelente': 0, 'Bom/Boa': 0, 'Regular': 0, 'Insuficiente/Ruim': 0 };
        let totalInItem = 0;
        data.forEach(row => {
            const answer = row[header];
            if (counts.hasOwnProperty(answer)) {
                counts[answer]++;
                totalInItem++;
            }
        });
        const itemLabelMatch = header.match(/^(\d+)\)/);
        const itemLabel = itemLabelMatch ? itemLabelMatch[1] : header;
        return Object.entries(counts).map(([conceito, valor]) => ({
            item: itemLabel,
            conceito: conceito.replace('/Boa', '').replace('/Ruim', ''),
            valor: totalInItem > 0 ? (valor / totalInItem) * 100 : 0
        }));
    });


    // --- 3. Extrair Opções para os Filtros ---
    const getUniqueValues = (key) => [...new Set(data.map(row => row[key]).filter(Boolean))].sort();

    const allDisciplinas = new Set();
    data.forEach(row => {
      for (const key in row) {
        if (key.startsWith('Selecione para qual disciplina') && !key.includes('[')) {
          const val = row[key];
          if (val && !isBadDisc(val)) {
            allDisciplinas.add(String(val).trim());
          }
        }
      }
    });

    // =================================================================
    // >>>>>>>>>>>> OPÇÕES DE FILTRO ATUALIZADAS AQUI <<<<<<<<<<<<
    // =================================================================
    const filtersOptions = {
      anos: ['2025', '2023'], // Adicionada a lista de anos
      dimensoes: Object.keys(dimensionMapEad), // Adicionada a lista de dimensões
      polos: getUniqueValues('Qual o seu Polo de Vinculação?'),
      cursos: getUniqueValues('Qual é o seu Curso?'),
      disciplinas: [...allDisciplinas].sort()
    };
    
    // =================================================================
    // >>>>>>>>>>>>>>>>>>>> ADIÇÕES PARA 2023/2025 <<<<<<<<<<<<<<<<<<<<<
    // =================================================================
    // Agora também colhemos disciplinas de TODAS as colunas “Selecione para qual disciplina…”
    // e enviamos "rows" normalizadas para o client (5 = não conta).
    let byYear = {
      '2025': {
        summary: summaryData,
        dimensoes: dimensoesData,
        autoavaliacaoItens: autoavaliacaoItensData,
        acaoDocenteAtitude: acaoDocenteAtitudeData,
        acaoDocenteGestao: acaoDocenteGestaoData,
        acaoDocenteProcesso: acaoDocenteProcessoData,
        infraestruturaItens: infraestruturaItensData,
        // >>> rows 2025 para filtragem no client
        rows: data,
        // >>> headers reais das perguntas (para mapear "1)" -> header completo no client)
        qHeadersFull: questionHeaders,
        filtersOptionsYear: {
          polos: filtersOptions.polos,
          cursos: filtersOptions.cursos,
          disciplinas: filtersOptions.disciplinas,
          dimensoes: filtersOptions.dimensoes,
        }
      }
    };

    try {
      const filePath2023 = path.join(process.cwd(), 'src', 'app', 'banco', 'AUTOAVALIAÇÃO DOS CURSOS DE GRADUAÇÃO A DISTÂNCIA - 2023-4 .csv');
      const csvData2023 = fs.readFileSync(filePath2023, 'utf8');
      const parsed2023 = Papa.parse(csvData2023, { header: false, skipEmptyLines: true });
      const rows2023 = parsed2023.data || [];

      if (rows2023.length) {
        // Detecta primeira coluna numérica (1..5)
        const isScore = (v) => ['1','2','3','4','5',1,2,3,4,5].includes(v);
        const headerRow = rows2023[0]; // pode ser o próprio cabeçalho textual
        const sampleRow = rows2023.find(r => r.some(v => isScore(v))) || rows2023[1] || rows2023[0];

        let startIdx = 0;
        for (let i = 0; i < sampleRow.length; i++) {
          if (isScore(sampleRow[i])) { startIdx = i; break; }
        }

        // Curso está na coluna 1 (índice 1) pelo layout que você mandou.
        const idxCurso = 1;

        // Disciplinas: qualquer coluna entre 2 e (startIdx-1) que tiver valor
        const disciplinaCols = [];
        for (let i = 2; i < startIdx; i++) disciplinaCols.push(i);

        const disciplinasSet = new Set();
        const cursoSet = new Set();

        // Monta rows normalizadas: { curso, disciplina, '1)': num, ... }
        const numQuestions = sampleRow.length - startIdx;
        const qHeaders2023 = Array.from({ length: numQuestions }, (_, i) => `${i+1})`);

        const rowsNorm2023 = rows2023
          .filter(r => r && r.length) // ignora vazias
          .map(r => {
            const cursoVal = (r[idxCurso] || '').toString().trim();
            if (cursoVal && !/^qual\b/i.test(cursoVal)) cursoSet.add(cursoVal);

            // disciplina: primeira não-vazia nas colunas de disciplina
            let discVal = '';
            for (const c of disciplinaCols) {
              if (r[c] && String(r[c]).trim()) { discVal = String(r[c]).trim(); break; }
            }
            if (discVal && !isBadDisc(discVal)) disciplinasSet.add(discVal);

            const obj = { curso: cursoVal, disciplina: discVal };
            // copia as respostas numéricas
            qHeaders2023.forEach((h, i) => {
              const raw = r[startIdx + i];
              const n = Number(raw);
              obj[h] = Number.isFinite(n) ? n : null; // 1..5; 5 será ignorado no client
            });
            return obj;
          });

        // Remove possíveis entradas "Qual é o seu Curso?" por segurança
        const cursos2023 = [...cursoSet].filter(c => c && !/^qual\b/i.test(c)).sort();
        const disciplinas2023 = [...disciplinasSet].filter(d => d && !isBadDisc(d)).sort();

        // ==== Agregações 2023 (mantendo seu formato atual) ====
        const conceitoFromNum = (n) => {
          const val = Number(n);
          if (val === 5) return null; // 5 não conta
          if (val === 4) return 'Excelente';
          if (val === 3) return 'Bom';
          if (val === 2) return 'Regular';
          if (val === 1) return 'Insuficiente';
          return null;
        };

        const conceitos = ['Excelente','Bom','Regular','Insuficiente'];

        // Limites seguros por comprimento e com Infra até 43 (44/45 são texto em 2023)
        const cap = (i) => Math.min(i, numQuestions);
        const endAuto = cap(13);
        const endAcao = cap(35);
        const endInfra = Math.min(cap(45), 43);

        const dims2023 = {
          'Autoavaliação Discente': qHeaders2023.slice(0, endAuto),
          'Avaliação da Ação Docente': qHeaders2023.slice(13, endAcao),
          'Instalações Físicas e Recursos de TI': qHeaders2023.slice(35, endInfra)
        };

        const respostasConcept = rowsNorm2023.map(o =>
          qHeaders2023.map(h => conceitoFromNum(o[h]))
        );

        const dimensoes2023 = Object.entries(dims2023).flatMap(([dim, headers]) => {
          const counts = { Excelente:0, Bom:0, Regular:0, Insuficiente:0 };
          let total = 0;
          rowsNorm2023.forEach((o, rowIdx) => {
            headers.forEach(h => {
              const idx = Number(h.replace(')','')) - 1;
              const c = respostasConcept[rowIdx][idx];
              if (c && counts[c] !== undefined) { counts[c]++; total++; }
            });
          });
          return conceitos.map(c => ({
            dimensao: dim,
            conceito: c,
            valor: total > 0 ? (counts[c]/total)*100 : 0
          }));
        });

        const makeItensData2023 = (headers) => headers.flatMap(h => {
          const idx = Number(h.replace(')','')) - 1;
          const counts = { Excelente:0, Bom:0, Regular:0, Insuficiente:0 };
          let total = 0;
          respostasConcept.forEach(arr => {
            const c = arr[idx];
            if (c && counts[c] !== undefined) { counts[c]++; total++; }
          });
          const itemLabel = h.replace(')','');
          return conceitos.map(c => ({
            item: itemLabel,
            conceito: c,
            valor: total > 0 ? (counts[c]/total)*100 : 0
          }));
        });

        const autoavaliacaoItens2023 = makeItensData2023(dims2023['Autoavaliação Discente']);
        const atitude2023 = makeItensData2023(qHeaders2023.slice(13, Math.min(19, qHeaders2023.length)));
        const gestao2023 = makeItensData2023(qHeaders2023.slice(19, Math.min(30, qHeaders2023.length)));
        const processo2023 = makeItensData2023(qHeaders2023.slice(30, Math.min(35, qHeaders2023.length)));
        const infra2023 = makeItensData2023(dims2023['Instalações Físicas e Recursos de TI']);

        // Cards 2023 simples
        const totalRespondentes2023 = rowsNorm2023.length;
        const cursoMais2023 = cursos2023[0] || 'N/A';

        const summary2023 = {
          total_respostas: [totalRespondentes2023],
          polo_mais_respostas: ['—'],
          curso_mais_respostas: [cursoMais2023],
          media_geral: [0],
        };

        byYear['2023'] = {
          summary: summary2023,
          dimensoes: dimensoes2023,
          autoavaliacaoItens: autoavaliacaoItens2023,
          acaoDocenteAtitude: atitude2023,
          acaoDocenteGestao: gestao2023,
          acaoDocenteProcesso: processo2023,
          infraestruturaItens: infra2023,
          // >>> rows 2023 normalizadas para filtragem no client
          rows: rowsNorm2023,
          filtersOptionsYear: {
            polos: [], // 2023 sem polo
            cursos: cursos2023,
            disciplinas: disciplinas2023,
            dimensoes: Object.keys(dimensionMapEad),
          }
        };
      }
    } catch (e) {
      console.warn('CSV 2023 não encontrado ou falha ao processar. Seguindo só com 2025.', e?.message);
    }
    // =================================================================
    // <<<<<<<<<<<<<<<<<<<<<< FIM DAS ADIÇÕES 2023/2025 >>>>>>>>>>>>>>>>
    // =================================================================
    
    // Adiciona os novos dados ao retorno da função
    return { 
      summaryData, 
      dimensoesData, 
      filtersOptions, 
      autoavaliacaoItensData, 
      acaoDocenteAtitudeData, 
      acaoDocenteGestaoData, 
      acaoDocenteProcessoData, 
      infraestruturaItensData,
      // >>> ADIÇÃO: mapa por ano (2025 sempre presente; 2023 se foi lido com sucesso)
      byYear,
      defaultYear: '2025'
    };

  } catch (error) {
    console.error("Erro ao ler ou processar o arquivo CSV (EAD):", error.message);
    return { 
      summaryData: null, 
      dimensoesData: null, 
      filtersOptions: null, 
      autoavaliacaoItensData: null, 
      acaoDocenteAtitudeData: null, 
      acaoDocenteGestaoData: null, 
      acaoDocenteProcessoData: null, 
      infraestruturaItensData: null,
      byYear: null,
      defaultYear: '2025'
    };
  }
}

// --- O COMPONENTE DA PÁGINA ---
// -> ADIÇÃO 2: Receber { searchParams } como propriedade da página
export default async function EadPage({ searchParams }) {
  const { summaryData, dimensoesData, filtersOptions, autoavaliacaoItensData, acaoDocenteAtitudeData, acaoDocenteGestaoData, acaoDocenteProcessoData, infraestruturaItensData, byYear, defaultYear } = await getEadInitialData();

  if (!summaryData || !dimensoesData || !filtersOptions) {
    return (
      <div className={styles.mainContent}>
        <h1 className={styles.title}>Avalia EAD</h1>
        <p className={styles.errorMessage}>
          Erro ao carregar os dados. Verifique se o arquivo CSV está no local correto e se o formato está correto.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.mainContent}>
      <h1 className={styles.title}>Avaliação EAD</h1>
      
      {/* -> ADIÇÃO 3: Envolver o componente cliente com o Suspense */}
      <Suspense fallback={<div className={styles.loading}>Carregando dashboard...</div>}>
        <EadDashboardClient
          initialData={{
              summary: summaryData,
              dimensoes: dimensoesData,
              autoavaliacaoItens: autoavaliacaoItensData,
              acaoDocenteAtitude: acaoDocenteAtitudeData,
              acaoDocenteGestao: acaoDocenteGestaoData,
              acaoDocenteProcesso: acaoDocenteProcessoData,
              infraestruturaItens: infraestruturaItensData,
          }}
          // >>> ADIÇÃO: entrega datasets por ano + ano padrão
          initialDataByYear={byYear}
          defaultYear={defaultYear}
          filtersOptions={filtersOptions}
        />
      </Suspense>
    </div>
  );
}
