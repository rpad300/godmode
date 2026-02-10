-- Migration 095: Report generation prompts (A4 document, PPT-style presentation, style variants)
-- Used when generating sprint reports as Document (A4) or Presentation. Editable in Admin > Prompts (category: report).

-- 1) Sprint report document A4 (business document)
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_report_document_a4',
    'Sprint report – Document A4',
    'Instructions for generating a professional A4 business document from sprint report data. Output must be a single self-contained HTML file (no markdown). Placeholder: {{REPORT_DATA}}. Optional style: {{STYLE_VARIANT}}.',
    'report',
    'Gera um documento profissional em formato A4 em React/HTML com as seguintes regras obrigatórias:

## FORMATO E DIMENSÕES
- Cada página simula uma folha A4 real: 210mm x 297mm (usar 794px x 1123px a 96dpi)
- As páginas são renderizadas verticalmente empilhadas com separação visual entre elas (sombra + gap)
- O scroll é entre páginas, NUNCA dentro de uma página — cada página é um bloco fixo
- O conteúdo TEM de caber dentro de cada página — se não couber, continua na página seguinte com cabeçalho de continuação
- Fundo do viewport cinzento claro (#e5e5e5), páginas em branco (#ffffff) com drop-shadow

## MARGENS E ÁREA ÚTIL
- Margens da página: 25mm topo, 25mm fundo, 20mm laterais (simular: padding ~95px topo/fundo, ~75px laterais)
- Área útil de conteúdo: ~160mm largura x ~247mm altura por página
- Nunca colocar conteúdo fora da área útil
- Header e footer da página ficam DENTRO das margens mas FORA da área de conteúdo

## HEADER E FOOTER DE PÁGINA
- Header (todas as páginas exceto capa): linha fina subtil no topo com título do documento à esquerda e logo/nome da empresa à direita
- Footer: número de página centrado ou à direita ("Página X de Y"), data do documento à esquerda
- Separador visual (linha fina #e0e0e0) entre header/footer e o conteúdo
- Header/footer em texto pequeno (10-11px), cor subtil (#666)

## PÁGINA DE CAPA (Página 1)
- Título do documento grande e impactante (centrado vertical e horizontalmente)
- Subtítulo / descrição
- Data do documento
- Autor / Equipa / Departamento
- Nome da empresa / logo placeholder
- Versão do documento (ex: v1.0)
- Sem header/footer na capa
- Design limpo com elemento visual diferenciador (barra de cor, bloco de acento)

## TIPOGRAFIA
- Font-family profissional para corpo: Inter, Segoe UI, system-ui, Georgia (serifada para docs mais formais)
- Títulos (h1): 24-28px, bold, cor de acento da empresa
- Subtítulos (h2): 18-20px, semibold
- Sub-subtítulos (h3): 14-16px, semibold
- Corpo de texto: 12-13px, line-height 1.6-1.7, cor #333
- Texto deve ser justificado ou alinhado à esquerda (nunca centrado em parágrafos)
- Espaçamento entre parágrafos: 12-16px
- Espaçamento antes de títulos: 24-32px
- Espaçamento depois de títulos: 8-12px
- Nunca usar texto menor que 10px (excepto notas de rodapé)

## ESTRUTURA DO DOCUMENTO
- Página 1: Capa
- Página 2: Índice / Tabela de Conteúdos (com números de página)
- Páginas 3-N: Conteúdo organizado por secções numeradas (1. / 1.1 / 1.1.1)
- Última página (opcional): Anexos, referências ou notas

## REGRAS DE CONTEÚDO
- Parágrafos: máximo 5-6 linhas cada — quebrar em parágrafos mais curtos para legibilidade
- Usar numeração hierárquica nas secções (1. → 1.1 → 1.1.1)
- Tabelas: bordas subtis (#e0e0e0), header da tabela com fundo de acento, padding generoso nas células (8-12px), zebra-striping opcional
- Se uma tabela não cabe na página atual, mover inteira para a próxima página (nunca cortar tabelas a meio)
- Gráficos e charts: centrados, com legenda/caption abaixo, máximo 50-60% da altura da página
- KPIs / métricas destacadas: usar cards ou blocos visuais com números grandes
- Listas: indentação clara, espaçamento entre items (6-8px), máximo 8-10 items por lista
- Callout boxes para informação importante: fundo suave, borda lateral colorida, ícone opcional

## ELEMENTOS VISUAIS PROFISSIONAIS
- Barra lateral ou acento de cor consistente (topo de cada página, ou borda lateral subtil)
- Separadores de secção: linha fina ou espaço generoso, nunca ambos
- Cores: paleta corporativa restrita (1 cor principal, 1 de acento, cinzentos para texto)
- Ícones opcionais para secções (usar Lucide icons se em React)
- Gráficos com cores da paleta definida, sem excesso de cores
- Sombras e gradientes: subtis ou nenhuns — estilo flat e limpo

## TÉCNICA DE IMPLEMENTAÇÃO
- Container externo: largura 100%, fundo cinzento, display flex column, align center, padding vertical 40px, gap 40px entre páginas, overflow-y auto (scroll entre páginas)
- Cada página: div com largura fixa 794px, altura fixa 1123px, fundo branco, box-shadow, overflow hidden, position relative
- O conteúdo dentro de cada página usa as margens definidas como padding
- Numerar páginas automaticamente via index do array de páginas
- Conteúdo que excede uma página deve ser distribuído manualmente por múltiplas páginas no código
- Para impressão: incluir @media print com page-break-after entre páginas e remoção de sombras/fundo cinzento

## SUPORTE A IMPRESSÃO / PDF
- Incluir CSS @media print:
  - Remover fundo cinzento do viewport
  - Remover sombras das páginas
  - page-break-after: always entre páginas
  - Garantir que as cores de fundo dos headers de tabela imprimem (print-color-adjust: exact)
- O utilizador deve poder fazer Ctrl+P / Cmd+P e obter um PDF limpo e correto

## O QUE NUNCA FAZER
- Conteúdo que transborda a área útil da página
- Tabelas ou gráficos cortados entre páginas
- Texto justificado com espaços enormes (preferir left-align se justificação causar gaps)
- Mais de 3 níveis de hierarquia de títulos (h1/h2/h3 é suficiente)
- Páginas meio vazias sem motivo (redistribuir conteúdo)
- Misturar múltiplos estilos de formatação — manter consistência total
- Parágrafos com mais de 6 linhas
- Fontes decorativas ou inconsistentes
- Cores que não imprimem bem (evitar amarelos claros, cinzentos muito leves)
- Headers/footers na página de capa

{{STYLE_VARIANT}}

Responde APENAS com o documento HTML completo (um único ficheiro autocontido, com React via CDN se necessário e todo o CSS inline ou em <style>). Sem explicações nem blocos markdown. Sem ```html.

Agora gera o documento com o seguinte conteúdo:

{{REPORT_DATA}}',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();

-- 2) Sprint report presentation (PPT-style slide deck)
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES (
    'sprint_report_presentation',
    'Sprint report – Apresentação (PPT)',
    'Instructions for generating a professional 16:9 slide-deck presentation from sprint report data. Output must be a single self-contained HTML file (no markdown). Placeholder: {{REPORT_DATA}}.',
    'report',
    'Gera uma apresentação interativa em React com as seguintes regras obrigatórias:

## FORMATO E LAYOUT
- Aspect ratio fixo de 16:9 (ex: 960x540px ou 1280x720px)
- Cada slide é um container com dimensões fixas, NUNCA com scroll
- O conteúdo de cada slide TEM de caber inteiramente no viewport do slide — se não couber, divide em múltiplos slides automaticamente
- Usa overflow: hidden em cada slide — nunca overflow: auto/scroll
- Todo o texto, gráficos e elementos devem ter margens internas (padding) generosas para nunca encostar às bordas (mínimo 40px em cada lado)
- O conteúdo deve estar centrado vertical e horizontalmente dentro de cada slide

## NAVEGAÇÃO
- Navegação por setas (← →) no teclado e botões clicáveis
- Indicador de slide atual (ex: "3 / 12") discreto no canto inferior direito
- Transições suaves entre slides (fade ou slide horizontal, ~300ms)
- Sem scroll em nenhum momento — a navegação é APENAS por slides

## TIPOGRAFIA
- Hierarquia clara: títulos grandes (2rem+), subtítulos (1.2rem), corpo (0.9-1rem)
- Máximo 6-8 linhas de texto por slide
- Máximo 6 bullet points por slide — se houver mais, dividir em slides
- Font-family profissional (Inter, system-ui, ou sem-serifa limpa)
- Contraste mínimo WCAG AA entre texto e fundo
- Nunca usar texto menor que 14px

## DESIGN VISUAL
- Estilo limpo e corporativo
- Paleta de cores consistente em toda a apresentação (máx. 3-4 cores)
- Slide de título/capa com destaque visual diferenciado
- Slide final de encerramento / Q&A
- Ícones ou elementos visuais para quebrar blocos de texto
- Gráficos e charts devem ocupar pelo menos 60% da área útil do slide
- Usar espaço em branco generosamente — menos é mais

## ESTRUTURA DE SLIDES
- Slide 1: Capa (título, subtítulo, data, logo/equipa)
- Slide 2: Agenda / Índice
- Slides 3-N: Conteúdo (1 ideia principal por slide)
- Slide N+1: Resumo / Takeaways
- Slide final: Obrigado / Contactos / Q&A

## REGRAS DE CONTEÚDO POR SLIDE
- Cada slide deve ter UM tema/mensagem principal
- Título do slide sempre visível no topo
- Se um slide tem gráfico, o gráfico é o protagonista (texto mínimo)
- Se um slide tem texto, usar keywords e frases curtas, não parágrafos
- Dados numéricos devem ser apresentados em cards/KPIs grandes, não em tabelas densas
- Tabelas: máximo 5 colunas e 6 linhas — senão, dividir ou simplificar

## RESPONSIVIDADE DO CONTAINER
- O slide container deve escalar proporcionalmente (transform: scale) para caber no viewport mantendo o 16:9
- Container interno com dimensões fixas, escalado via CSS transform para fit

## TÉCNICA DE IMPLEMENTAÇÃO
- Container externo: 100vw x 100vh, display:flex, align/justify center
- Container do slide: largura fixa (ex: 960px), altura fixa (540px)
- Escalar com transform: scale(factor) onde factor = min(viewportW/960, viewportH/540)
- Cada slide é um componente/div com position:absolute ou conditional render
- Usar useState para controlar o slide atual

## O QUE NUNCA FAZER
- Scroll dentro de slides
- Texto que transborda o container
- Slides com mais de 40% de área preenchida com texto
- Gráficos cortados ou que saem do slide
- Fontes abaixo de 14px
- Mais de 8 bullets por slide
- Usar o height do browser como referência — usar sempre dimensões fixas escaladas
- Backgrounds que dificultam a leitura do texto

Responde APENAS com o documento HTML completo (um único ficheiro autocontido, React via CDN, todo o CSS em <style>). Sem explicações nem blocos markdown. Sem ```html.

Conteúdo/dados do relatório:

{{REPORT_DATA}}',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();

-- 3–6) Style variants (appended to document prompt when selected)
INSERT INTO system_prompts (key, name, description, category, prompt_template, uses_ontology, is_system)
VALUES
(
    'sprint_report_style_corporate_classic',
    'Estilo: Corporativo clássico',
    'Variante de estilo para relatório documento A4. Paleta e tipografia corporativa clássica.',
    'report',
    'Estilo: Corporativo clássico
Paleta: #1B365D (azul escuro), #2E86AB (azul acento), #333 (texto), #f8f9fa (fundos subtis)
Fonte: Georgia para títulos, Inter para corpo
Elementos: Barra azul no topo de cada página, linhas finas como separadores',
    FALSE,
    TRUE
),
(
    'sprint_report_style_modern_minimal',
    'Estilo: Moderno minimalista',
    'Variante de estilo para relatório documento A4. Visual limpo e moderno.',
    'report',
    'Estilo: Moderno minimalista
Paleta: #111111 (títulos), #6C63FF (acento), #555 (texto), #fafafa (fundos)
Fonte: Inter para tudo
Elementos: Blocos de cor sólida para callouts, sem bordas em tabelas (apenas separadores horizontais)',
    FALSE,
    TRUE
),
(
    'sprint_report_style_startup_tech',
    'Estilo: Startup / Tech',
    'Variante de estilo para relatório documento A4. Visual tech/startup.',
    'report',
    'Estilo: Tech/Startup
Paleta: #0F172A (dark headers), #3B82F6 (azul tech), #10B981 (verde sucesso), #EF4444 (vermelho alerta)
Fonte: system-ui, monospace para dados
Elementos: Cards arredondados para KPIs, gradientes subtis nos headers de secção',
    FALSE,
    TRUE
),
(
    'sprint_report_style_consultancy',
    'Estilo: Consultoria / Enterprise',
    'Variante de estilo para relatório documento A4. Visual consultoria/enterprise.',
    'report',
    'Estilo: Consultoria
Paleta: #1a1a1a (títulos), #C8102E (vermelho acento tipo McKinsey), #666 (texto), #f5f5f5 (fundos)
Fonte: Georgia serifada para títulos, sans-serif para corpo
Elementos: Numeração destacada nas secções, heavy use de tabelas e frameworks',
    FALSE,
    TRUE
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    prompt_template = EXCLUDED.prompt_template,
    uses_ontology = EXCLUDED.uses_ontology,
    updated_at = now();
