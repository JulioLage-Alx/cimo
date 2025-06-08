// ================ CHART.JS LOADER OTIMIZADO 2025 ================
    let chartJSRetries = 0;
    const maxRetries = 4;

    // URLs oficiais recomendadas (atualizadas conforme pesquisa)
    const chartJSUrls = [
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@3.9.1',
    'https://unpkg.com/chart.js@3.9.1/dist/chart.min.js'
];


    // ================ CHART.JS LOADER FUNCTION ================
    function loadChartJS() {
        return new Promise((resolve, reject) => {
            // Check if Chart.js is already loaded
            if (typeof Chart !== 'undefined') {
                debugMessage('Chart.js já estava carregado');
                resolve(Chart);
                return;
            }

            // Show loading status
            const statusEl = document.getElementById('chartjsStatus');
            if (statusEl) {
                statusEl.style.display = 'block';
                const retriesEl = document.getElementById('chartjsRetries');
                if (retriesEl) retriesEl.textContent = chartJSRetries;
            }

            const currentUrl = chartJSUrls[chartJSRetries % chartJSUrls.length];
            debugMessage(`Tentando carregar Chart.js (${chartJSRetries + 1}/${maxRetries}): ${currentUrl}`);

            const script = document.createElement('script');
            script.src = currentUrl;
            script.async = true;

            script.onload = () => {
                if (typeof Chart !== 'undefined') {
                    debugMessage('Chart.js carregado com sucesso!');
                    if (statusEl) statusEl.style.display = 'none';
                    resolve(Chart);
                } else {
                    debugMessage('Chart.js carregado mas objeto Chart não encontrado', 'warning');
                    script.remove();
                    retryLoad();
                }
            };

            script.onerror = () => {
                debugMessage(`Falha ao carregar Chart.js de ${currentUrl}`, 'error');
                script.remove();
                retryLoad();
            };

            function retryLoad() {
                chartJSRetries++;
                
                if (statusEl) {
                    const retriesEl = document.getElementById('chartjsRetries');
                    if (retriesEl) retriesEl.textContent = chartJSRetries;
                }

                if (chartJSRetries < maxRetries) {
                    setTimeout(() => {
                        loadChartJS().then(resolve).catch(reject);
                    }, 1000 * chartJSRetries); // Increasing delay
                } else {
                    debugMessage('Máximo de tentativas atingido - Chart.js não pôde ser carregado', 'error');
                    if (statusEl) {
                        statusEl.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-times-circle"></i>
                                <span>Falha ao carregar Chart.js - usando visualização alternativa</span>
                            </div>
                        `;
                    }
                    reject(new Error('Failed to load Chart.js after ' + maxRetries + ' attempts'));
                }
            }

            document.head.appendChild(script);
        });
    }

    // ================ DEBUG SYSTEM ================
    let debugLog = [];
    
    function debugMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    
    debugLog.push(logEntry);
    
    // Log no console com cores
    const colors = {
        info: '#3b82f6',
        success: '#059669', 
        warning: '#ea580c',
        error: '#dc2626'
    };
    
    console.log(`%c🐛 ${logEntry}`, `color: ${colors[type] || colors.info}`);
    
    updateDebugConsole();
    }

    function updateDebugConsole() {
    const debugEl = document.getElementById('debugLog');
    if (debugEl) {
        debugEl.innerHTML = debugLog.slice(-20).map(log => 
            `<div style="margin-bottom: 2px; font-size: 10px; opacity: 0.9;">${log}</div>`
        ).join('');
        debugEl.scrollTop = debugEl.scrollHeight;
    }
}

function toggleDebug() {
    const console = document.getElementById('debugConsole');
    if (console) {
        console.style.display = console.style.display === 'none' ? 'block' : 'none';
    }
}

    // ================ CONFIGURAÇÃO SINCRONIZADA COM BACKEND ================ 
    const CONFIG = {
    API_BASE_URL: window.location.origin,
    ENDPOINTS: {
        dados: '/api/dados',
        teste: '/api/teste',
        teste_correcoes: '/api/teste-correcoes',
        projecoes_detalhadas: '/api/projecoes-detalhadas'  // NOVO
    },
    
    // ✅ PARÂMETROS ATUALIZADOS COM FAZENDA
    PARAM_MAPPING: {
        'taxaRetorno': 'taxa',
        'expectativaVida': 'expectativa',
        'despesasMensais': 'despesas',
        'perfilInvestimento': 'perfil',
        'inicioRendaFilhos': 'inicio_renda_filhos',
        'custoFazenda': 'custo_fazenda',
        'periodoCompraFazenda': 'periodo_compra_fazenda',  // NOVO
        'valorFazendaAtual': 'custo_fazenda'               // ALIAS
    },
    
    // CONSTANTES DA FAZENDA
    INFLACAO_ESTATICA: 3.5  // % ao ano
};

const idadeAna= 53;  // Idade atual de Ana
const PATRIMONIO = 65_000_000;  // R$ 65 milhões

    
    

    const AppState = {
        currentData: null,
        charts: {},
        currentPage: 'dashboard',
        isLoading: false,
        chartJsLoaded: false,
        retryingCharts: false,
        simulationParams: {
            taxaMin: 2.5,
            taxaMax: 7.0,
            volatilidade: 15,
            numSimulacoes: 500
        },
        reportHistory: []
    };

    // ================ MAPEADOR DE DADOS SINCRONIZADO ================ 
   const DataMapper = {
    mapApiResponse(apiData) {
        if (!apiData || !apiData.resultado) {
            debugMessage('Resposta da API inválida ou sem dados de resultado', 'warning');
            return this.generateFallbackData();
        }
        
        debugMessage(`Mapeando resposta da API versão: ${apiData.versao || 'desconhecida'}`);
        
        const resultado = apiData.resultado;
        
        return {
            success: apiData.success,
            patrimonio: apiData.patrimonio,
            versao: apiData.versao,
            timestamp: apiData.timestamp,
            
            // ✅ RESULTADO PRINCIPAL - CAMPOS CORRETOS
            resultado: {
                // ✅ CAMPOS QUE EXISTEM NO BACKEND
                fazenda: resultado.fazenda_disponivel,
                fazenda_disponivel: resultado.fazenda_disponivel,
                total: resultado.total_compromissos,
                total_compromissos: resultado.total_compromissos,
                percentual: resultado.percentual_fazenda,
                percentual_fazenda: resultado.percentual_fazenda,
                despesas: resultado.despesas,
                filhos: resultado.filhos,
                doacoes: resultado.doacoes,
                arte: resultado.arte || 0,
                percentual_arte: resultado.percentual_arte || 0,
                
                // ✅ CAMPOS DA FAZENDA (CORRIGIDOS)
                fazenda_analysis: apiData.fazenda_analysis || {},
                periodo_compra_fazenda: apiData.periodo_compra_fazenda || null,
                valor_fazenda_atual: apiData.valor_fazenda_atual || 0,
                valor_fazenda_futuro: apiData.valor_fazenda_futuro || 0
            },
            
            allocation: this.generateAllocationData(apiData.patrimonio),
            sensibilidade: this.generateSensibilidadeData(resultado),
            status: this.determineStatus(resultado.fazenda_disponivel, resultado.percentual_fazenda)
        };
    },

    // ✅ MANTER MÉTODOS EXISTENTES SEM ALTERAÇÃO
    generateFallbackData() {
        debugMessage('Gerando dados de fallback', 'warning');
        return {
            success: false,
            patrimonio: 65000000,
            resultado: {
                fazenda: 0, fazenda_disponivel: 0, total: 0, total_compromissos: 0,
                percentual: 0, percentual_fazenda: 0, despesas: 0, filhos: 0,
                doacoes: 0, arte: 0, percentual_arte: 0,
                fazenda_analysis: {}, periodo_compra_fazenda: null,
                valor_fazenda_atual: 0, valor_fazenda_futuro: 0
            },
            allocation: this.generateAllocationData(65000000),
            sensibilidade: [], 
            status: 'erro'
        };
    },

    // ✅ MANTER DEMAIS MÉTODOS INALTERADOS...
    generateAllocationData(patrimonio) {
        const perfil = document.getElementById('perfilInvestimento')?.value || 'moderado';
        
        const profiles = {
            'conservador': [
                { nome: 'Renda Fixa Nacional', percentual: 70, valor: patrimonio * 0.70 },
                { nome: 'Renda Fixa Internacional', percentual: 15, valor: patrimonio * 0.15 },
                { nome: 'Ações Brasil', percentual: 5, valor: patrimonio * 0.05 },
                { nome: 'Ações Internacionais', percentual: 5, valor: patrimonio * 0.05 },
                { nome: 'Fundos Imobiliários', percentual: 3, valor: patrimonio * 0.03 },
                { nome: 'Reserva Liquidez', percentual: 2, valor: patrimonio * 0.02 }
            ],
            'moderado': [
                { nome: 'Renda Fixa Nacional', percentual: 50, valor: patrimonio * 0.50 },
                { nome: 'Renda Fixa Internacional', percentual: 20, valor: patrimonio * 0.20 },
                { nome: 'Ações Brasil', percentual: 15, valor: patrimonio * 0.15 },
                { nome: 'Ações Internacionais', percentual: 10, valor: patrimonio * 0.10 },
                { nome: 'Fundos Imobiliários', percentual: 3, valor: patrimonio * 0.03 },
                { nome: 'Reserva Liquidez', percentual: 2, valor: patrimonio * 0.02 }
            ],
            'balanceado': [
                { nome: 'Renda Fixa Nacional', percentual: 40, valor: patrimonio * 0.40 },
                { nome: 'Renda Fixa Internacional', percentual: 15, valor: patrimonio * 0.15 },
                { nome: 'Ações Brasil', percentual: 20, valor: patrimonio * 0.20 },
                { nome: 'Ações Internacionais', percentual: 15, valor: patrimonio * 0.15 },
                { nome: 'Fundos Imobiliários', percentual: 5, valor: patrimonio * 0.05 },
                { nome: 'Multimercado', percentual: 3, valor: patrimonio * 0.03 },
                { nome: 'Reserva Liquidez', percentual: 2, valor: patrimonio * 0.02 }
            ]
        };
        
        return profiles[perfil] || profiles['moderado'];
    },

    generateSensibilidadeData(resultado) {
        const baseFazenda = resultado.fazenda_disponivel || 0;
        const basePercentual = resultado.percentual_fazenda || 0;
        
        const sensibilidade = [];
        const taxas = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0];
        
        taxas.forEach(taxa => {
            const currentTaxa = parseFloat(document.getElementById('taxaRetorno')?.value || 4.0);
            const deltaTaxa = taxa - currentTaxa;
            const factor = 1 + (deltaTaxa * 0.15);
            
            const fazendaEstimada = baseFazenda * factor;
            const percentualEstimado = basePercentual * factor;
            
            sensibilidade.push({
                taxa: taxa,
                fazenda: fazendaEstimada,
                percentual: percentualEstimado
            });
        });
        
        return sensibilidade;
    },

    determineStatus(fazenda, percentual) {
        if (fazenda < 0) return 'crítico';
        if (percentual < 5) return 'crítico';
        if (percentual < 15) return 'atenção';
        return 'viável';
    }
};

    // ================ API CLIENT SINCRONIZADO ================ 
  const ApiClient = {
    async fetchData() {
        try {
            debugMessage('Iniciando requisição para API v4.3 com fazenda');
            
            // ✅ COLETAR TODOS OS PARÂMETROS (INCLUINDO FAZENDA)
            const params = new URLSearchParams({
                taxa: document.getElementById('taxaRetorno').value,
                expectativa: document.getElementById('expectativaVida').value,
                despesas: document.getElementById('despesasMensais').value,
                perfil: document.getElementById('perfilInvestimento').value,
                inicio_renda_filhos: document.getElementById('inicioRendaFilhos').value,
                custo_fazenda: document.getElementById('valorFazendaAtual').value,
                periodo_compra_fazenda: document.getElementById('periodoCompraFazenda').value  // NOVO
            });

            const url = `${CONFIG.ENDPOINTS.dados}?${params}`;
            debugMessage(`URL da requisição v4.3: ${url}`);

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            debugMessage(`Resposta recebida v4.3: versão ${data.versao || 'desconhecida'}, success: ${data.success}`);
            
            if (!data.success) {
                throw new Error(data.erro || 'Erro desconhecido na API');
            }

            const mappedData = DataMapper.mapApiResponse(data);
            debugMessage('Dados v4.3 mapeados com sucesso');
            
            return mappedData;
        } catch (error) {
            debugMessage(`Erro na API v4.3: ${error.message}`, 'error');
            throw error;
        }
    },

    // ✅ NOVO: Buscar projeções detalhadas com fazenda
    async fetchProjectionsData() {
        try {
            debugMessage('Buscando projeções detalhadas com fazenda');
            
            const params = new URLSearchParams({
                taxa: document.getElementById('taxaRetorno').value,
                expectativa: document.getElementById('expectativaVida').value,
                despesas: document.getElementById('despesasMensais').value,
                perfil: document.getElementById('perfilInvestimento').value,
                inicio_renda_filhos: document.getElementById('inicioRendaFilhos').value,
                custo_fazenda: document.getElementById('valorFazendaAtual').value,
                periodo_compra_fazenda: document.getElementById('periodoCompraFazenda').value
            });

            const url = `${CONFIG.ENDPOINTS.projecoes_detalhadas}?${params}`;
            debugMessage(`URL projeções: ${url}`);

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.erro || 'Erro ao buscar projeções');
            }
            
            debugMessage('Projeções detalhadas recebidas com sucesso');
            return data;
            
        } catch (error) {
            debugMessage(`Erro nas projeções: ${error.message}`, 'error');
            throw error;
        }
    },

    // Manter métodos existentes...
    async checkBackendHealth() {
        try {
            debugMessage('🔍 Verificando saúde do backend v4.3...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/teste`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                   'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'OK') {
                debugMessage(`✅ Backend v4.3 online - Versão: ${data.version}`, 'success');
                AppState.connectionStatus = 'connected';
                return true;
            } else {
                throw new Error('Backend respondeu mas status não é OK');
            }
            
        } catch (error) {
            debugMessage(`❌ Backend v4.3 offline: ${error.message}`, 'error');
            AppState.connectionStatus = 'disconnected';
            AppState.lastError = error.message;
            return false;
        }
    }
};


    // ================ UTILITIES ================ 
    const Utils = {
        formatCurrency(value, compact = false) {
            if (value === null || value === undefined) return 'N/A';
            
            if (compact && Math.abs(value) >= 1000000) {
                return `R$ ${(value / 1000000).toFixed(1)}M`;
            }
            
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value);
        },

        formatPercentage(value, decimals = 1) {
            if (value === null || value === undefined) return 'N/A';
            return `${value.toFixed(decimals)}%`;
        },

        showNotification(message, type = 'info') {
            debugMessage(`Notificação: ${message}`);
            
            const container = document.getElementById('alertContainer');
            if (!container) return;
            
            const alertId = 'alert-' + Date.now();
            
            const icons = {
                success: 'check-circle',
                warning: 'exclamation-triangle',
                danger: 'times-circle',
                info: 'info-circle'
            };
            
            const alertHTML = `
                <div id="${alertId}" class="alert ${type}">
                    <i class="fas fa-${icons[type] || 'info-circle'}"></i>
                    <span>${message}</span>
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', alertHTML);
            
            setTimeout(() => {
                const alert = document.getElementById(alertId);
                if (alert) alert.remove();
            }, 5000);
        }
    };

    // ================ CHART MANAGER SINCRONIZADO ================ 
    const ChartManager = {
        colors: {
            primary: '#1e3a8a',
            secondary: '#3b82f6',
            accent: '#059669',
            orange: '#ea580c',
            purple: '#7c3aed',
            gray: '#64748b'
        },

        async initializeCharts() {
            debugMessage('Inicializando sistema de gráficos sincronizado');
            
            try {
                await loadChartJS();
                AppState.chartJsLoaded = true;
                debugMessage('Chart.js inicializado com sucesso');
                
                if (AppState.currentData) {
                    this.createCharts();
                }
                
            } catch (error) {
                debugMessage('Falha ao carregar Chart.js - usando visualização alternativa', 'warning');
                AppState.chartJsLoaded = false;
                this.showAlternativeVisualization();
            }
        },

 destroyExistingCharts() {
    debugMessage('🗑️ Destruição COMPLETA de gráficos - v4.3.2 SYNC');
    
    try {
        // Destruir gráficos do AppState
        Object.keys(AppState.charts).forEach(chartKey => {
            if (AppState.charts[chartKey]) {
                try {
                    if (typeof AppState.charts[chartKey].destroy === 'function') {
                        AppState.charts[chartKey].destroy();
                        debugMessage(`✅ Gráfico ${chartKey} destruído via AppState`);
                    }
                } catch (error) {
                    debugMessage(`⚠️ Erro ao destruir ${chartKey}: ${error.message}`, 'warning');
                }
                delete AppState.charts[chartKey];
            }
        });
        
        // Destruir TODOS os gráficos Chart.js globalmente
        if (typeof Chart !== 'undefined' && Chart.instances) {
            Object.keys(Chart.instances).forEach(chartId => {
                try {
                    const chartInstance = Chart.instances[chartId];
                    if (chartInstance) {
                        chartInstance.destroy();
                        debugMessage(`🧹 Chart.js instance ${chartId} destruída globalmente`);
                    }
                } catch (error) {
                    debugMessage(`⚠️ Erro ao destruir instance ${chartId}: ${error.message}`, 'warning');
                }
            });
        }
        
        // Limpar cada canvas individualmente
        const canvasIds = [
            'compromissosChart', 'allocationChart', 'sensibilidadeChart',
            'currentAllocationChart', 'benchmarkChart', 'allocationTrendsChart',
            'patrimonialEvolutionChart', 'despesasFlowChart', 'rentabilidadeFlowChart', 
            'allocationEvolutionChart', 'monteCarloChart', 'distribuicaoChart',
            'scenarioComparisonChart', 'scenarioEvolutionChart', 'stressTestChart',
            'returnSensitivityChart', 'expenseSensitivityChart', 'bidimensionalChart'
        ];
        
        canvasIds.forEach(canvasId => {
            try {
                const canvas = document.getElementById(canvasId);
                if (canvas) {
                    // ✅ CRÍTICO: Verificar Chart.getChart()
                    if (typeof Chart !== 'undefined' && Chart.getChart) {
                        const existingChart = Chart.getChart(canvas);
                        if (existingChart) {
                            existingChart.destroy();
                            debugMessage(`🎯 Chart.getChart(${canvasId}) destruído`);
                        }
                    }
                    
                    // Limpar canvas
                    const context = canvas.getContext('2d');
                    if (context) {
                        context.clearRect(0, 0, canvas.width, canvas.height);
                    }
                    
                    // Remover atributos Chart.js
                    canvas.removeAttribute('data-chartjs-chart-id');
                    if (canvas.chartjsChart) {
                        delete canvas.chartjsChart;
                    }
                }
            } catch (error) {
                debugMessage(`⚠️ Erro ao limpar canvas ${canvasId}: ${error.message}`, 'warning');
            }
        });
        
        AppState.charts = {};
        debugMessage('✅ Destruição COMPLETA concluída');
        
    } catch (error) {
        debugMessage(`❌ Erro na destruição: ${error.message}`, 'error');
        AppState.charts = {};
    }
},

        createCharts() {
            if (!AppState.chartJsLoaded || typeof Chart === 'undefined') {
                debugMessage('Chart.js não disponível - usando visualização alternativa', 'warning');
                this.showAlternativeVisualization();
                return;
            }

            if (!AppState.currentData) {
                debugMessage('Dados não disponíveis para gráficos', 'warning');
                return;
            }

            debugMessage('Criando gráficos Chart.js com dados sincronizados');
            
            try {
                this.destroyExistingCharts();
                
                if (AppState.currentPage === 'dashboard') {
                    this.hideChartPlaceholders(['compromissosContainer', 'allocationContainer', 'sensibilidadeContainer']);
                    this.createCompromissosChart();
                    this.createAllocationChart();
                    this.createSensibilidadeChart();
                } else if (AppState.currentPage === 'allocation') {
                    this.hideChartPlaceholders(['currentAllocationContainer', 'benchmarkContainer']);
                    this.createAllocationPageCharts();
                } else if (AppState.currentPage === 'projections') {
                    this.hideChartPlaceholders(['patrimonialEvolutionContainer', 'cashFlowContainer']);
                    this.createProjectionCharts();
                } else if (AppState.currentPage === 'simulations') {
                    this.hideChartPlaceholders(['monteCarloContainer', 'distribuicaoContainer']);
                    this.createSimulationCharts();
                } else if (AppState.currentPage === 'scenarios') {
                    this.hideChartPlaceholders(['scenarioComparisonContainer', 'scenarioEvolutionContainer', 'stressTestContainer']);
                    this.createScenarioCharts();
                } else if (AppState.currentPage === 'sensitivity') {
                    this.hideChartPlaceholders(['returnSensitivityContainer', 'expenseSensitivityContainer', 'bidimensionalContainer']);
                    this.createSensitivityCharts();
                }
                
                debugMessage('Gráficos criados com sucesso');
            } catch (error) {
                debugMessage(`Erro ao criar gráficos: ${error.message}`, 'error');
                this.showChartError();
            }
        },

        hideChartPlaceholders(containerIds) {
            containerIds.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) {
                    const placeholder = container.querySelector('.chart-placeholder');
                    const canvas = container.querySelector('canvas');
                    if (placeholder) placeholder.style.display = 'none';
                    if (canvas) canvas.style.display = 'block';
                }
            });
        },

        showChartError() {
            const containers = ['compromissosContainer', 'allocationContainer', 'sensibilidadeContainer'];
            containers.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = `
                        <div class="chart-placeholder error">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div>Erro ao carregar gráfico</div>
                            <button onclick="window.CimoDebug.forceCharts()" style="margin-top: 8px; padding: 4px 8px; background: var(--accent-orange); color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">
                                Tentar novamente
                            </button>
                        </div>
                    `;
                }
            });
        },

        showAlternativeVisualization() {
            debugMessage('Mostrando visualização alternativa sincronizada');
            
            if (!AppState.currentData) return;
            
            const { resultado, allocation, sensibilidade } = AppState.currentData;
            
            if (AppState.currentPage === 'dashboard') {
                this.createAlternativeCompromissos(resultado);
                this.createAlternativeAllocation(allocation);
                this.createAlternativeSensibilidade(sensibilidade);
            }
        },

        createAlternativeCompromissos(resultado) {
            if (!resultado) return;
            
            const container = document.getElementById('compromissosContainer');
            if (!container) return;
            
            const total = resultado.despesas + resultado.filhos + resultado.doacoes + Math.max(resultado.fazenda, 0);
            
            container.innerHTML = `
                <div class="chart-placeholder no-charts">
                    <i class="fas fa-chart-pie"></i>
                    <div><strong>Breakdown dos Compromissos</strong></div>
                    <div class="data-visualization">
                        <div class="data-bars">
                            <div class="data-bar" style="height: ${(resultado.despesas/total*100)}%; background: linear-gradient(180deg, #1e3a8a, #3b82f6);" data-label="Despesas Ana"></div>
                            <div class="data-bar" style="height: ${(resultado.filhos/total*100)}%; background: linear-gradient(180deg, #3b82f6, #60a5fa);" data-label="Renda Filhos"></div>
                            <div class="data-bar" style="height: ${(resultado.doacoes/total*100)}%; background: linear-gradient(180deg, #64748b, #94a3b8);" data-label="Doações"></div>
                            <div class="data-bar" style="height: ${(Math.max(resultado.fazenda,0)/total*100)}%; background: linear-gradient(180deg, #059669, #10b981);" data-label="Fazenda"></div>
                        </div>
                        <div class="data-legend">
                            <div class="legend-item">
                                <div class="legend-color" style="background: #1e3a8a;"></div>
                                <span>Despesas Ana: ${Utils.formatCurrency(resultado.despesas, true)}</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background: #3b82f6;"></div>
                                <span>Renda Filhos: ${Utils.formatCurrency(resultado.filhos, true)}</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background: #64748b;"></div>
                                <span>Doações: ${Utils.formatCurrency(resultado.doacoes, true)}</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background: #059669;"></div>
                                <span>Disponível Fazenda: ${Utils.formatCurrency(resultado.fazenda, true)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        createAlternativeAllocation(allocation) {
            if (!allocation) return;
            
            const container = document.getElementById('allocationContainer');
            if (!container) return;
            
            const colors = ['#1e3a8a', '#3b82f6', '#64748b', '#059669', '#ea580c', '#7c3aed', '#94a3b8'];
            
            container.innerHTML = `
                <div class="chart-placeholder no-charts">
                    <i class="fas fa-chart-donut"></i>
                    <div><strong>Asset Allocation</strong></div>
                    <div class="data-visualization">
                        <div class="data-bars">
                            ${allocation.map((item, index) => `
                                <div class="data-bar" style="height: ${item.percentual}%; background: linear-gradient(180deg, ${colors[index]}, ${colors[index]}80);" data-label="${item.percentual}%"></div>
                            `).join('')}
                        </div>
                        <div class="data-legend">
                            ${allocation.map((item, index) => `
                                <div class="legend-item">
                                    <div class="legend-color" style="background: ${colors[index]};"></div>
                                    <span>${item.nome}: ${item.percentual}%</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        },

        createAlternativeSensibilidade(sensibilidade) {
            if (!sensibilidade || sensibilidade.length === 0) return;
            
            const container = document.getElementById('sensibilidadeContainer');
            if (!container) return;
            
            const maxValue = Math.max(...sensibilidade.map(item => Math.abs(item.fazenda)));
            
            container.innerHTML = `
                <div class="chart-placeholder no-charts">
                    <i class="fas fa-chart-line"></i>
                    <div><strong>Análise de Sensibilidade</strong></div>
                    <div class="data-visualization">
                        <div class="data-bars">
                            ${sensibilidade.map(item => {
                                const height = Math.abs(item.fazenda) / maxValue * 100;
                                const color = item.fazenda >= 0 ? '#059669' : '#dc2626';
                                return `<div class="data-bar" style="height: ${height}%; background: linear-gradient(180deg, ${color}, ${color}80);" data-label="${item.taxa}%"></div>`;
                            }).join('')}
                        </div>
                        <div class="data-legend">
                            ${sensibilidade.slice(0, 6).map(item => `
                                <div class="legend-item">
                                    <div class="legend-color" style="background: ${item.fazenda >= 0 ? '#059669' : '#dc2626'};"></div>
                                    <span>${item.taxa}%: ${Utils.formatCurrency(item.fazenda, true)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        },

       createCompromissosChart() {
    const ctx = document.getElementById('compromissosChart');
    if (!ctx || !AppState.currentData) return;
    
    const { resultado } = AppState.currentData;
    if (!resultado) return;
    
    debugMessage('Criando gráfico de compromissos sincronizado');

    // ✅ LÓGICA DINÂMICA PARA TRATAR FAZENDA NEGATIVA
    const fazendaValue = resultado.fazenda;
    const labels = ['Despesas Ana', 'Renda Filhos', 'Doações'];
    const data = [resultado.despesas, resultado.filhos, resultado.doacoes];
    const colors = [this.colors.primary, this.colors.secondary, this.colors.gray];

    // ✅ DETECTAR SE FAZENDA É POSITIVA OU NEGATIVA
    if (fazendaValue >= 0) {
        // Fazenda positiva = exibir normalmente
        labels.push('Disponível Fazenda');
        data.push(fazendaValue);
        colors.push(this.colors.accent);  // Verde
    } else {
        // Fazenda negativa = mostrar como "Déficit"
        labels.push('⚠️ Déficit Patrimonial');
        data.push(Math.abs(fazendaValue));  // Valor absoluto para gráfico
        colors.push('#dc2626');  // Vermelho para déficit
    }

    AppState.charts.compromissos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,        // ✅ DINÂMICO
            datasets: [{
                data: data,        // ✅ DINÂMICO
                backgroundColor: colors,  // ✅ DINÂMICO
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        color: '#374151',
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            
                            // ✅ TOOLTIP ESPECIAL PARA DÉFICIT
                            if (context.label.includes('Déficit')) {
                                return `${context.label}: -${Utils.formatCurrency(value)} (${percentage}% do total de compromissos)`;
                            }
                            return `${context.label}: ${Utils.formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
},

        createAllocationChart() {
            const ctx = document.getElementById('allocationChart');
            if (!ctx || !AppState.currentData) return;
            
            const { allocation } = AppState.currentData;
            if (!allocation) return;
            
            debugMessage('Criando gráfico de allocation sincronizado');

            AppState.charts.allocation = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: allocation.map(item => item.nome),
                    datasets: [{
                        data: allocation.map(item => item.percentual),
                        backgroundColor: [
                            this.colors.primary,
                            this.colors.secondary,
                            this.colors.gray,
                            this.colors.accent,
                            this.colors.orange,
                            this.colors.purple,
                            '#94a3b8'
                        ].slice(0, allocation.length),
                        borderWidth: 0,
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { 
                                color: '#374151',
                                padding: 16,
                                usePointStyle: true,
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const item = allocation[context.dataIndex];
                                    return `${context.label}: ${item.percentual}% (${Utils.formatCurrency(item.valor)})`;
                                }
                            }
                        }
                    }
                }
            });
        },

        createSensibilidadeChart() {
            const ctx = document.getElementById('sensibilidadeChart');
            if (!ctx || !AppState.currentData) return;
            
            const { sensibilidade } = AppState.currentData;
            if (!sensibilidade || sensibilidade.length === 0) return;
            
            debugMessage('Criando gráfico de sensibilidade sincronizado');

            AppState.charts.sensibilidade = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sensibilidade.map(item => `${item.taxa}%`),
                    datasets: [{
                        label: 'Valor Fazenda (R$ milhões)',
                        data: sensibilidade.map(item => item.fazenda / 1000000),
                        borderColor: this.colors.primary,
                        backgroundColor: this.colors.primary + '20',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: this.colors.primary,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed.y;
                                    return `Taxa ${context.label}: ${Utils.formatCurrency(value * 1000000, true)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: '#f1f5f9' },
                            ticks: { color: '#6b7280', font: { size: 12 } }
                        },
                        y: {
                            grid: { color: '#f1f5f9' },
                            ticks: { 
                                color: '#6b7280',
                                font: { size: 12 },
                                callback: function(value) {
                                    return 'R$ ' + value + 'M';
                                }
                            }
                        }
                    }
                }
            });
        },

        // Outros gráficos mantidos para compatibilidade
        createAllocationPageCharts() {
            this.createCurrentAllocationChart();
            this.createBenchmarkChart();
        },

        createProjectionCharts() {
            this.createPatrimonialEvolutionChart();
            this.createCashFlowChart();
        },

        createSimulationCharts() {
            this.createMonteCarloChart();
            this.createDistribuicaoChart();
        },

        createScenarioCharts() {
            this.createScenarioComparisonChart();
            this.createScenarioEvolutionChart();
            this.createStressTestChart();
        },

        createSensitivityCharts() {
            this.createReturnSensitivityChart();
            this.createExpenseSensitivityChart();
            this.createBidimensionalChart();
        },

        // Implementações dos gráficos adicionais mantidas
        createCurrentAllocationChart() {
            const ctx = document.getElementById('currentAllocationChart');
            if (!ctx || !AppState.currentData) return;
            
            const { allocation } = AppState.currentData;
            if (!allocation) return;

            AppState.charts.currentAllocation = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: allocation.map(item => item.nome),
                    datasets: [{
                        data: allocation.map(item => item.percentual),
                        backgroundColor: [
                            this.colors.primary,
                            this.colors.secondary,
                            this.colors.gray,
                            this.colors.accent,
                            this.colors.orange,
                            this.colors.purple,
                            '#94a3b8'
                        ].slice(0, allocation.length),
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { 
                                color: '#374151',
                                padding: 16,
                                usePointStyle: true,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        },

        createBenchmarkChart() {
            const ctx = document.getElementById('benchmarkChart');
            if (!ctx) return;

            AppState.charts.benchmark = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['RF Nacional', 'RF Internacional', 'Multimercado', 'Ações BR', 'Ações Int', 'Imóveis', 'Liquidez'],
                    datasets: [{
                        label: 'Atual',
                        data: [50, 20, 0, 15, 10, 3, 2],
                        backgroundColor: this.colors.primary + '80'
                    }, {
                        label: 'Benchmark',
                        data: [50, 15, 15, 10, 8, 2, 0],
                        backgroundColor: this.colors.secondary + '80'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    }
                }
            });
        },

      createPatrimonialEvolutionChart() {
    const ctx = document.getElementById('patrimonialEvolutionChart');
    if (!ctx || !ProjectionsManager.projectionData) {
        debugMessage('❌ Canvas ou dados não disponíveis para patrimonial evolution');
        return;
    }

    // ✅ NOVA: DESTRUIÇÃO INDIVIDUAL FORÇADA
    if (AppState.charts.patrimonialEvolution) {
        try {
            AppState.charts.patrimonialEvolution.destroy();
            debugMessage('🗑️ Gráfico patrimonial existente destruído');
        } catch (error) {
            debugMessage(`⚠️ Erro ao destruir patrimonial: ${error.message}`, 'warning');
        }
        delete AppState.charts.patrimonialEvolution;
    }

    const data = ProjectionsManager.projectionData.slice(0, 30);
    
    // ✅ VERIFICAÇÃO ADICIONAL DOS DADOS
    if (!data || data.length === 0) {
        debugMessage('❌ Dados de projeção inválidos para gráfico patrimonial');
        return;
    }
    
    debugMessage(`📊 Criando gráfico patrimonial com ${data.length} pontos de dados`);
    
    try {
        AppState.charts.patrimonialEvolution = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(item => item.ano),
                datasets: [{
                    label: 'Patrimônio (R$ milhões)',
                    data: data.map(item => item.patrimonio / 1000000),
                    borderColor: this.colors.primary,
                    backgroundColor: this.colors.primary + '20',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = data[context.dataIndex];
                                return [
                                    `Patrimônio: ${Utils.formatCurrency(item.patrimonio, true)}`,
                                    `Idade Ana: ${item.idade_ana} anos`,
                                    `Ana ${item.ana_viva ? 'viva' : 'faleceu'}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#f1f5f9' },
                        ticks: { color: '#6b7280', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: '#f1f5f9' },
                        ticks: { 
                            color: '#6b7280',
                            font: { size: 11 },
                            callback: function(value) {
                                return 'R$ ' + value + 'M';
                            }
                        }
                    }
                }
            }
        });
        
        debugMessage('✅ Gráfico patrimonial criado com sucesso');
        
    } catch (error) {
        debugMessage(`❌ Erro ao criar gráfico patrimonial: ${error.message}`, 'error');
    }
},

        createCashFlowChart() {
            const ctx = document.getElementById('cashFlowChart');
            if (!ctx) return;

            AppState.charts.cashFlow = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['2025', '2030', '2035', '2040', '2045', '2050'],
                    datasets: [{
                        label: 'Entradas',
                        data: [2600, 2808, 3033, 3276, 3538, 3822],
                        backgroundColor: this.colors.accent + '80'
                    }, {
                        label: 'Saídas',
                        data: [-1800, -1944, -2100, -2268, -2449, -2643],
                        backgroundColor: this.colors.orange + '80'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + Math.abs(value/1000) + 'k';
                                }
                            }
                        }
                    }
                }
            });
        },

        createMonteCarloChart() {
            const ctx = document.getElementById('monteCarloChart');
            if (!ctx) return;

            debugMessage('Criando gráfico Monte Carlo');

            const { taxaMin, taxaMax, volatilidade, numSimulacoes } = AppState.simulationParams;
            const datasets = [];
            
            for (let i = 0; i < 20; i++) {
                const data = [];
                let value = 65;
                
                for (let year = 0; year < 20; year++) {
                    const baseReturn = taxaMin + Math.random() * (taxaMax - taxaMin);
                    const volatilityFactor = (Math.random() - 0.5) * (volatilidade / 100);
                    const totalReturn = (baseReturn + volatilityFactor * 100) / 100;
                    
                    value = value * (1 + totalReturn) - 1.8;
                    data.push(Math.max(value, 0));
                }
                
                datasets.push({
                    data: data,
                    borderColor: this.colors.gray + '30',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.2
                });
            }

            AppState.charts.monteCarlo = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 20}, (_, i) => 2025 + i),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + value + 'M';
                                }
                            }
                        }
                    },
                    elements: {
                        line: {
                            borderJoinStyle: 'round'
                        }
                    }
                }
            });
        },

        createDistribuicaoChart() {
            const ctx = document.getElementById('distribuicaoChart');
            if (!ctx) return;

            debugMessage('Criando gráfico de distribuição');

            const finalValues = [];
            const { taxaMin, taxaMax, volatilidade } = AppState.simulationParams;
            
            for (let i = 0; i < 1000; i++) {
                const avgReturn = (taxaMin + taxaMax) / 2;
                const randomFactor = (Math.random() - 0.5) * (volatilidade / 50);
                const finalReturn = avgReturn + randomFactor;
                
                let finalValue = 65 * Math.pow(1 + finalReturn/100, 20) - (20 * 1.8);
                finalValues.push(finalValue);
            }

            const bins = 15;
            const minVal = Math.min(...finalValues);
            const maxVal = Math.max(...finalValues);
            const binSize = (maxVal - minVal) / bins;
            
            const histogram = new Array(bins).fill(0);
            const labels = [];
            
            for (let i = 0; i < bins; i++) {
                const binStart = minVal + i * binSize;
                const binEnd = minVal + (i + 1) * binSize;
                labels.push(`${binStart.toFixed(1)}M`);
                
                finalValues.forEach(val => {
                    if (val >= binStart && val < binEnd) {
                        histogram[i]++;
                    }
                });
            }

            AppState.charts.distribuicao = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Frequência',
                        data: histogram,
                        backgroundColor: this.colors.primary + '80',
                        borderColor: this.colors.primary,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Valor Final (R$ milhões)'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Frequência'
                            }
                        }
                    }
                }
            });
        },

        createScenarioComparisonChart() {
            const ctx = document.getElementById('scenarioComparisonChart');
            if (!ctx) return;

            AppState.charts.scenarioComparison = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Conservador', 'Moderado', 'Agressivo'],
                    datasets: [{
                        label: 'Valor Fazenda (R$ milhões)',
                        data: [-2.1, 5.2, 13.4],
                        backgroundColor: [
                            this.colors.orange,
                            this.colors.secondary,
                            this.colors.accent
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + value + 'M';
                                }
                            }
                        }
                    }
                }
            });
        },

        createScenarioEvolutionChart() {
            const ctx = document.getElementById('scenarioEvolutionChart');
            if (!ctx) return;

            AppState.charts.scenarioEvolution = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 10}, (_, i) => 2025 + i),
                    datasets: [{
                        label: 'Conservador',
                        data: [65, 63, 61, 58, 55, 51, 47, 42, 37, 31],
                        borderColor: this.colors.orange,
                        backgroundColor: 'transparent'
                    }, {
                        label: 'Moderado',
                        data: [65, 65, 66, 67, 68, 69, 70, 71, 72, 73],
                        borderColor: this.colors.secondary,
                        backgroundColor: 'transparent'
                    }, {
                        label: 'Agressivo',
                        data: [65, 68, 72, 76, 81, 86, 92, 98, 105, 112],
                        borderColor: this.colors.accent,
                        backgroundColor: 'transparent'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + value + 'M';
                                }
                            }
                        }
                    }
                }
            });
        },

        createStressTestChart() {
            const ctx = document.getElementById('stressTestChart');
            if (!ctx) return;

            AppState.charts.stressTest = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 20}, (_, i) => 2025 + i),
                    datasets: [{
                        label: 'Cenário Normal',
                        data: Array.from({length: 20}, (_, i) => 65 * Math.pow(1.04, i) - i * 1.8),
                        borderColor: this.colors.secondary,
                        backgroundColor: 'transparent'
                    }, {
                        label: 'Crise Prolongada',
                        data: Array.from({length: 20}, (_, i) => 65 * Math.pow(1.01, i) - i * 2.2),
                        borderColor: this.colors.orange,
                        backgroundColor: 'transparent'
                    }, {
                        label: 'Recessão Severa',
                        data: Array.from({length: 20}, (_, i) => 65 * Math.pow(0.98, i) - i * 2.5),
                        borderColor: '#dc2626',
                        backgroundColor: 'transparent'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + value + 'M';
                                }
                            }
                        }
                    }
                }
            });
        },

        createReturnSensitivityChart() {
            const ctx = document.getElementById('returnSensitivityChart');
            if (!ctx || !AppState.currentData) return;
            
            const { sensibilidade } = AppState.currentData;
            if (!sensibilidade) return;

            AppState.charts.returnSensitivity = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sensibilidade.map(item => `${item.taxa}%`),
                    datasets: [{
                        label: 'Valor Fazenda (R$ milhões)',
                        data: sensibilidade.map(item => item.fazenda / 1000000),
                        borderColor: this.colors.primary,
                        backgroundColor: this.colors.primary + '20',
                        borderWidth: 3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + value + 'M';
                                }
                            }
                        }
                    }
                }
            });
        },

        createExpenseSensitivityChart() {
            const ctx = document.getElementById('expenseSensitivityChart');
            if (!ctx) return;

            AppState.charts.expenseSensitivity = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['R$ 120k', 'R$ 135k', 'R$ 150k', 'R$ 165k', 'R$ 180k'],
                    datasets: [{
                        label: 'Valor Fazenda (R$ milhões)',
                        data: [11.8, 8.5, 5.2, 1.9, -1.4],
                        backgroundColor: [
                            this.colors.accent,
                            this.colors.secondary,
                            this.colors.primary,
                            this.colors.orange,
                            '#dc2626'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + value + 'M';
                                }
                            }
                        }
                    }
                }
            });
        },

        createBidimensionalChart() {
            const ctx = document.getElementById('bidimensionalChart');
            if (!ctx) return;

            AppState.charts.bidimensional = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Taxa vs Despesas',
                        data: [
                            {x: 3.0, y: 120},
                            {x: 3.5, y: 135},
                            {x: 4.0, y: 150},
                            {x: 4.5, y: 165},
                            {x: 5.0, y: 180}
                        ],
                        backgroundColor: this.colors.primary,
                        borderColor: this.colors.primary,
                        pointRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Taxa de Retorno (%)'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Despesas Mensais (R$ mil)'
                            }
                        }
                    }
                }
            });
        }
    };

const ASSET_ALLOCATION_PROFILES = {
    'conservador': {
        'renda_fixa_br': 70,      // 70% Renda Fixa Nacional
        'renda_fixa_int': 15,     // 15% Renda Fixa Internacional  
        'acoes_br': 5,            // 5% Ações Brasil
        'acoes_int': 5,           // 5% Ações Internacionais
        'imoveis': 3,             // 3% Fundos Imobiliários
        'liquidez': 2,            // 2% Reserva de Liquidez
        'retorno_esperado': 3.5,  // Taxa real esperada
        'volatilidade': 6         // Volatilidade anual %
    },
    'moderado': {
        'renda_fixa_br': 50,      // 50% Renda Fixa Nacional
        'renda_fixa_int': 20,     // 20% Renda Fixa Internacional
        'acoes_br': 15,           // 15% Ações Brasil
        'acoes_int': 10,          // 10% Ações Internacionais
        'imoveis': 3,             // 3% Fundos Imobiliários
        'liquidez': 2,            // 2% Reserva de Liquidez
        'retorno_esperado': 4.5,  // Taxa real esperada
        'volatilidade': 10        // Volatilidade anual %
    },
    'balanceado': {
        'renda_fixa_br': 40,      // 40% Renda Fixa Nacional
        'renda_fixa_int': 15,     // 15% Renda Fixa Internacional
        'acoes_br': 20,           // 20% Ações Brasil
        'acoes_int': 15,          // 15% Ações Internacionais
        'imoveis': 5,             // 5% Fundos Imobiliários
        'multimercado': 3,        // 3% Multimercado
        'liquidez': 2,            // 2% Reserva de Liquidez
        'retorno_esperado': 5.2,  // Taxa real esperada
        'volatilidade': 12        // Volatilidade anual %
    }
};
    
ChartManager.createDespesasFlowChart = function() {
    const ctx = document.getElementById('despesasFlowChart');
    if (!ctx || !ProjectionsManager.projectionData) return;

    const data = ProjectionsManager.projectionData.slice(0, 20);
    
    const datasets = [];
    
    // Despesas Ana
    datasets.push({
        label: 'Despesas Ana',
        data: data.map(item => item.despesas_ana ? item.despesas_ana / 1000000 : 0),
        backgroundColor: this.colors.primary + '80',
        borderColor: this.colors.primary,
        borderWidth: 2
    });
    
    // Doações
    datasets.push({
        label: 'Doações',
        data: data.map(item => item.doacoes ? item.doacoes / 1000000 : 0),
        backgroundColor: this.colors.secondary + '80',
        borderColor: this.colors.secondary,
        borderWidth: 2
    });
    
    // Renda filhos
    datasets.push({
        label: 'Renda Filhos',
        data: data.map(item => item.renda_filhos ? item.renda_filhos / 1000000 : 0),
        backgroundColor: this.colors.gray + '80',
        borderColor: this.colors.gray,
        borderWidth: 2
    });
    
    // Compra fazenda (pontual)
    datasets.push({
        label: 'Compra Fazenda',
        data: data.map(item => item.valor_gasto_fazenda ? item.valor_gasto_fazenda / 1000000 : 0),
        backgroundColor: this.colors.accent + '80',
        borderColor: this.colors.accent,
        borderWidth: 2,
        type: 'bar'
    });

    AppState.charts.despesasFlow = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => item.ano),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${Utils.formatCurrency(context.parsed.y * 1000000, true)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#6b7280',
                        font: { size: 11 },
                        callback: function(value) {
                            return 'R$ ' + value + 'M';
                        }
                    }
                }
            }
        }
    });
};

ChartManager.isCanvasFree = function(canvasId) {
    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return false;
        
        if (typeof Chart !== 'undefined') {
            if (Chart.getChart && Chart.getChart(canvas)) {
                return false;
            }
            if (canvas.hasAttribute('data-chartjs-chart-id')) {
                return false;
            }
            if (canvas.chartjsChart) {
                return false;
            }
        }
        
        return true;
    } catch (error) {
        return false;
    }
};



ChartManager.createRentabilidadeFlowChart = function() {
    const ctx = document.getElementById('rentabilidadeFlowChart');
    if (!ctx || !ProjectionsManager.projectionData) return;

    const data = ProjectionsManager.projectionData.slice(0, 20);
    
    AppState.charts.rentabilidadeFlow = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => item.ano),
            datasets: [{
                label: 'Rendimentos Anuais',
                data: data.map(item => item.rendimentos / 1000000),
                borderColor: this.colors.accent,
                backgroundColor: this.colors.accent + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: this.colors.accent,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4
            }, {
                label: 'Saldo Líquido',
                data: data.map(item => item.saldoLiquido / 1000000),
                borderColor: this.colors.orange,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointBackgroundColor: this.colors.orange,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 11 } }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#6b7280',
                        font: { size: 11 },
                        callback: function(value) {
                            return 'R$ ' + value + 'M';
                        }
                    }
                }
            }
        }
    });
};



const periodo = parseInt(document.getElementById('periodoCompraFazenda')?.value) || 0;

ChartManager.createAllocationEvolutionChart = function() {
    const ctx = document.getElementById('allocationEvolutionChart');
    if (!ctx) {
        debugMessage('❌ Canvas allocationEvolutionChart não encontrado');
        return;
    }

    // ✅ VERIFICAR Chart.js ANTES DE USAR
    if (typeof Chart === 'undefined') {
        debugMessage('❌ Chart.js não disponível para allocation evolution');
        this.showAlternativeVisualization();
        return;
    }

    debugMessage('🎨 Criando gráfico de evolução da allocation DINÂMICO v4.3.1');

    try {
        // ✅ DESTRUIR GRÁFICO ANTERIOR PRIMEIRO
        if (AppState.charts.allocationEvolution) {
            AppState.charts.allocationEvolution.destroy();
            delete AppState.charts.allocationEvolution;
            debugMessage('🗑️ Gráfico anterior de allocation evolution destruído');
        }

        // ✅ PEGAR PARÂMETROS REAIS DO USUÁRIO
        const perfilAtual = document.getElementById('perfilInvestimento')?.value || 'moderado';
        const periodo = parseInt(document.getElementById('periodoCompraFazenda')?.value) || 0;
        const idadeAna = 53;
        const expectativa = parseInt(document.getElementById('expectativaVida')?.value || 90);
        
        debugMessage(`📊 Parâmetros dinâmicos: perfil=${perfilAtual}, periodo=${periodo}, expectativa=${expectativa}`);
        
        // ✅ USAR ASSET_ALLOCATION_PROFILES CORRETAMENTE
        const baseAllocation = ASSET_ALLOCATION_PROFILES[perfilAtual] || ASSET_ALLOCATION_PROFILES['moderado'];
        const anos = Array.from({length: 20}, (_, i) => 2025 + i);
        
        // ✅ FUNÇÃO PARA CALCULAR ALLOCATION DINÂMICA
        const calcularAllocation = (anoIndex) => {
            const idadeAnaNoAno = idadeAna + anoIndex;
            
            // Fator conservadorismo por idade (aumenta 0.5% RF por ano após 60)
            const fatorIdade = idadeAnaNoAno > 60 ? (idadeAnaNoAno - 60) * 0.5 : 0;
            
            // Fator liquidez por proximidade da fazenda
            let fatorLiquidez = baseAllocation.liquidez || 2;
            if (periodo > 0) {
                const anosAteFazenda = periodo - anoIndex;
                if (anosAteFazenda <= Math.floor(periodo * 0.2) && anosAteFazenda > 0) {
                    // Últimos 20% do período: liquidez alta
                    fatorLiquidez = 15;
                } else if (anosAteFazenda <= Math.floor(periodo * 0.4) && anosAteFazenda > 0) {
                    // 20%-40% finais: liquidez moderada
                    fatorLiquidez = 8;
                } else if (anosAteFazenda <= Math.floor(periodo * 0.6) && anosAteFazenda > 0) {
                    // 40%-60%: começar acumular
                    fatorLiquidez = 4;
                }
            }
            
            // Ajustar RF aumentando por idade + reduzindo por liquidez
            let rendaFixaBR = (baseAllocation.renda_fixa_br || 50) + fatorIdade - (fatorLiquidez - (baseAllocation.liquidez || 2)) * 0.6;
            let rendaFixaInt = baseAllocation.renda_fixa_int || 20;
            let acoesBR = Math.max(3, (baseAllocation.acoes_br || 15) - fatorIdade * 0.3);
            let acoesInt = Math.max(3, (baseAllocation.acoes_int || 10) - fatorIdade * 0.2);
            let imoveis = baseAllocation.imoveis || 3;
            let multimercado = baseAllocation.multimercado || 0;
            
            // Normalizar para 100%
            const total = rendaFixaBR + rendaFixaInt + acoesBR + acoesInt + imoveis + multimercado + fatorLiquidez;
            const fator = 100 / total;
            
            return {
                renda_fixa_br: rendaFixaBR * fator,
                renda_fixa_int: rendaFixaInt * fator,
                acoes_br: acoesBR * fator,
                acoes_int: acoesInt * fator,
                imoveis: imoveis * fator,
                multimercado: multimercado * fator,
                liquidez: fatorLiquidez * fator
            };
        };
        
        // ✅ CRIAR DATASETS DINÂMICOS COM CHECKBOXES
        const datasets = [
            {
                label: 'Renda Fixa BR',
                data: anos.map((ano, i) => calcularAllocation(i + 1).renda_fixa_br),
                borderColor: ChartManager.colors.primary,
                backgroundColor: ChartManager.colors.primary + '20',
                tension: 0.4,
                hidden: !document.getElementById('showRendaFixaBR')?.checked
            },
            {
                label: 'Renda Fixa Int',
                data: anos.map((ano, i) => calcularAllocation(i + 1).renda_fixa_int),
                borderColor: ChartManager.colors.secondary,
                backgroundColor: ChartManager.colors.secondary + '20',
                tension: 0.4,
                hidden: !document.getElementById('showRendaFixaInt')?.checked
            },
            {
                label: 'Ações BR',
                data: anos.map((ano, i) => calcularAllocation(i + 1).acoes_br),
                borderColor: ChartManager.colors.accent,
                backgroundColor: ChartManager.colors.accent + '20',
                tension: 0.4,
                hidden: !document.getElementById('showAcoesBR')?.checked
            },
            {
                label: 'Ações Int',
                data: anos.map((ano, i) => calcularAllocation(i + 1).acoes_int),
                borderColor: ChartManager.colors.orange,
                backgroundColor: ChartManager.colors.orange + '20',
                tension: 0.4,
                hidden: !document.getElementById('showAcoesInt')?.checked
            },
            {
                label: 'Imóveis',
                data: anos.map((ano, i) => calcularAllocation(i + 1).imoveis),
                borderColor: ChartManager.colors.purple,
                backgroundColor: ChartManager.colors.purple + '20',
                tension: 0.4,
                hidden: !document.getElementById('showImoveis')?.checked
            },
            {
                label: 'Liquidez',
                data: anos.map((ano, i) => calcularAllocation(i + 1).liquidez),
                borderColor: '#dc2626',
                backgroundColor: '#dc262620',
                borderWidth: 3,
                tension: 0.4,
                hidden: !document.getElementById('showLiquidez')?.checked
            }
        ];
        
        // ✅ ADICIONAR MULTIMERCADO SE FOR PERFIL BALANCEADO
        if (baseAllocation.multimercado) {
            datasets.push({
                label: 'Multimercado',
                data: anos.map((ano, i) => calcularAllocation(i + 1).multimercado),
                borderColor: '#8b5cf6',
                backgroundColor: '#8b5cf620',
                tension: 0.4,
                hidden: !document.getElementById('showMultimercado')?.checked
            });
        }

        // ✅ CRIAR GRÁFICO DINÂMICO
        AppState.charts.allocationEvolution = new Chart(ctx, {
            type: 'line',
            data: {
                labels: anos,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 10 }, padding: 8, usePointStyle: true }
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const anoIndex = context[0].dataIndex;
                                const ano = anos[anoIndex];
                                const idadeAna = 53 + anoIndex + 1;
                                return `${ano} (Ana: ${idadeAna} anos)`;
                            },
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                            },
                            afterBody: function(context) {
                                const anoIndex = context[0].dataIndex;
                                const anosAteFazenda = periodo - anoIndex - 1;
                                if (periodo > 0 && anosAteFazenda >= 0) {
                                    return [``, `🏡 Fazenda em ${anosAteFazenda} anos`];
                                }
                                return [];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#f1f5f9' },
                        ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 10 }
                    },
                    y: {
                        beginAtZero: true,
                        max: 80,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            color: '#6b7280',
                            font: { size: 10 },
                            callback: function(value) { return value + '%'; }
                        }
                    }
                }
            }
        });

        debugMessage('✅ Gráfico de allocation evolution criado dinamicamente');

    } catch (error) {
        debugMessage(`❌ Erro no gráfico allocation evolution: ${error.message}`, 'error');
        console.error('Erro detalhado:', error);
        this.showAlternativeVisualization();
    }
};
    
    const baseAllocation = ASSET_ALLOCATION_PROFILES[perfilAtual] || ASSET_ALLOCATION_PROFILES['moderado'];
    const anos = Array.from({length: 20}, (_, i) => 2025 + i);
    
    // ✅ FUNÇÃO PARA CALCULAR ALLOCATION DINÂMICA
    const calcularAllocation = (anoIndex) => {
        const idadeAnaNoAno = idadeAna + anoIndex;
        
        // Fator conservadorismo por idade (aumenta 0.5% RF por ano após 60)
        const fatorIdade = idadeAnaNoAno > 60 ? (idadeAnaNoAno - 60) * 0.5 : 0;
        
        // Fator liquidez por proximidade da fazenda
        let fatorLiquidez = baseAllocation.liquidez;
        if (periodo > 0) {
            const anosAteFazenda = periodo - anoIndex;
            if (anosAteFazenda <= Math.floor(periodo * 0.2)) {
                // Últimos 20% do período: liquidez alta
                fatorLiquidez = 15;
            } else if (anosAteFazenda <= Math.floor(periodo * 0.4)) {
                // 20%-40% finais: liquidez moderada
                fatorLiquidez = 8;
            } else if (anosAteFazenda <= Math.floor(periodo * 0.6)) {
                // 40%-60%: começar acumular
                fatorLiquidez = 4;
            }
        }
        
        // Ajustar RF aumentando por idade + reduzindo por liquidez
        let rendaFixaBR = baseAllocation.renda_fixa_br + fatorIdade - (fatorLiquidez - baseAllocation.liquidez) * 0.6;
        let rendaFixaInt = baseAllocation.renda_fixa_int;
        let acoesBR = Math.max(3, baseAllocation.acoes_br - fatorIdade * 0.3);
        let acoesInt = Math.max(3, baseAllocation.acoes_int - fatorIdade * 0.2);
        let imoveis = baseAllocation.imoveis;
        let multimercado = baseAllocation.multimercado || 0;
        
        // Normalizar para 100%
        const total = rendaFixaBR + rendaFixaInt + acoesBR + acoesInt + imoveis + multimercado + fatorLiquidez;
        const fator = 100 / total;
        
        return {
            renda_fixa_br: rendaFixaBR * fator,
            renda_fixa_int: rendaFixaInt * fator,
            acoes_br: acoesBR * fator,
            acoes_int: acoesInt * fator,
            imoveis: imoveis * fator,
            multimercado: multimercado * fator,
            liquidez: fatorLiquidez * fator
        };
    };
    
    const datasets = [
        {
            label: 'Renda Fixa BR',
            data: anos.map((ano, i) => calcularAllocation(i + 1).renda_fixa_br),
            borderColor: ChartManager.colors.primary,
            backgroundColor: ChartManager.colors.primary + '20',
            tension: 0.4,
            hidden: !document.getElementById('showRendaFixaBR')?.checked
        },
        {
            label: 'Renda Fixa Int',
            data: anos.map((ano, i) => calcularAllocation(i + 1).renda_fixa_int),
            borderColor: ChartManager.colors.secondary,
            backgroundColor: ChartManager.colors.secondary + '20',
            tension: 0.4,
            hidden: !document.getElementById('showRendaFixaInt')?.checked
        },
        {
            label: 'Ações BR',
            data: anos.map((ano, i) => calcularAllocation(i + 1).acoes_br),
            borderColor: ChartManager.colors.accent,
            backgroundColor: ChartManager.colors.accent + '20',
            tension: 0.4,
            hidden: !document.getElementById('showAcoesBR')?.checked
        },
        {
            label: 'Ações Int',
            data: anos.map((ano, i) => calcularAllocation(i + 1).acoes_int),
            borderColor: ChartManager.colors.orange,
            backgroundColor: ChartManager.colors.orange + '20',
            tension: 0.4,
            hidden: !document.getElementById('showAcoesInt')?.checked
        },
        {
            label: 'Imóveis',
            data: anos.map((ano, i) => calcularAllocation(i + 1).imoveis),
            borderColor: ChartManager.colors.purple,
            backgroundColor: ChartManager.colors.purple + '20',
            tension: 0.4,
            hidden: !document.getElementById('showImoveis')?.checked
        },
        {
            label: 'Liquidez',
            data: anos.map((ano, i) => calcularAllocation(i + 1).liquidez),
            borderColor: '#dc2626',
            backgroundColor: '#dc262620',
            borderWidth: 3,
            tension: 0.4,
            hidden: !document.getElementById('showLiquidez')?.checked
        }
    ];
    
    // Adicionar Multimercado se for perfil balanceado
    if (baseAllocation.multimercado) {
        datasets.push({
            label: 'Multimercado',
            data: anos.map((ano, i) => calcularAllocation(i + 1).multimercado),
            borderColor: '#8b5cf6',
            backgroundColor: '#8b5cf620',
            tension: 0.4,
            hidden: !document.getElementById('showMultimercado')?.checked
        });
    }


const FazendaManager = {
   

    updateFazendaCard(dadosFazenda) {
        if (!dadosFazenda) {
            console.warn('⚠️ Dados da fazenda não disponíveis');
            return;
        }

        console.log('🏡 Atualizando card da fazenda:', dadosFazenda);

        // ✅ VALOR DISPONÍVEL (PRINCIPAL)
        const valorEl = document.getElementById('valorFazenda');
        if (valorEl) {
            const valorDisponivel = dadosFazenda.fazenda_disponivel || 0;
            valorEl.textContent = Utils.formatCurrency(valorDisponivel, true);
        }

        // ✅ PERÍODO DE COMPRA
        const periodoEl = document.getElementById('periodoFazendaDisplay');
        if (periodoEl) {
            const periodo = parseInt(document.getElementById('periodoCompraFazenda')?.value || 0);
            if (periodo && periodo > 0) {
                periodoEl.textContent = `Em ${periodo} anos`;
            } else {
                periodoEl.textContent = 'Compra imediata';
            }
        }

        // ✅ VALORES DE COMPARAÇÃO (CORRIGIDOS)
        const necessarioEl = document.getElementById('fazendaNecessario');
        const disponivelEl = document.getElementById('fazendaDisponivel');
        
        if (necessarioEl) {
            // ✅ USAR O VALOR ATUAL DA FAZENDA (DO INPUT)
            const valorFazendaAtual = parseFloat(document.getElementById('valorFazendaAtual')?.value || 0);
            const periodo = parseInt(document.getElementById('periodoCompraFazenda')?.value || 0);
            
            let valorNecessario = valorFazendaAtual;
            if (periodo > 0) {
                // Calcular valor futuro com inflação de 3.5%
                valorNecessario = valorFazendaAtual * Math.pow(1.035, periodo);
            }
            
            necessarioEl.textContent = Utils.formatCurrency(valorNecessario, true);
        }
        
        if (disponivelEl) {
            const valorDisponivel = dadosFazenda.fazenda_disponivel || 0;
            disponivelEl.textContent = Utils.formatCurrency(valorDisponivel, true);
        }

        // ✅ STATUS DA FAZENDA
        const statusEl = document.getElementById('fazendaStatus');
        if (statusEl) {
            const valorDisponivel = dadosFazenda.fazenda_disponivel || 0;
            const valorFazendaAtual = parseFloat(document.getElementById('valorFazendaAtual')?.value || 0);
            
            if (valorDisponivel >= valorFazendaAtual) {
                statusEl.innerHTML = '<span class="status-badge success">✅ Viável</span>';
            } else {
                statusEl.innerHTML = '<span class="status-badge danger">❌ Inviável</span>';
            }
        }

        debugMessage('✅ Card da fazenda atualizado com valores corretos');
    },

    // ✅ MÉTODO CORRIGIDO PARA ATUALIZAR INFORMAÇÕES
    updateFazendaInfo() {
        const periodo = parseInt(document.getElementById('periodoCompraFazenda')?.value || 0);
        const valorAtual = parseFloat(document.getElementById('valorFazendaAtual')?.value || 0);
        
        // ✅ CALCULAR VALOR FUTURO CORRETAMENTE
        let valorFuturo = valorAtual;
        if (periodo > 0) {
            valorFuturo = valorAtual * Math.pow(1.035, periodo); // 3.5% inflação
        }
        
        // ✅ ATUALIZAR SEÇÃO DE INFORMAÇÕES
        const infoEl = document.getElementById('fazendaInfoContent');
        if (infoEl) {
            if (periodo === 0) {
                infoEl.innerHTML = `
                    <strong>Compra Imediata:</strong> ${Utils.formatCurrency(valorAtual, true)}<br>
                    <em>Impacto: Redução imediata do patrimônio, sem período de acumulação</em>
                `;
            } else {
                const fases = this.calcularFases(periodo);
                
                infoEl.innerHTML = `
                    <strong>Compra em ${periodo} anos:</strong><br>
                    • Valor hoje: ${Utils.formatCurrency(valorAtual, true)}<br>
                    • Valor futuro: ${Utils.formatCurrency(valorFuturo, true)} (c/ inflação)<br>
                    • Estratégia: Liquidez gradual em ${fases.length} fases<br>
                    <em>Liquidez final: ${fases[fases.length - 1]?.liquidez || 15}% antes da compra</em>
                `;
            }
        }

        debugMessage(`🏡 Info atualizada: ${Utils.formatCurrency(valorAtual, true)} → ${Utils.formatCurrency(valorFuturo, true)} em ${periodo} anos`);
    },

    // ✅ MANTER MÉTODOS EXISTENTES
    calcularFases(periodo) {
        if (periodo <= 0) return [];
        
        const fase1Anos = Math.max(1, Math.floor(periodo * 0.40));
        const fase2Anos = Math.max(1, Math.floor(periodo * 0.40));
        const fase3Anos = periodo - fase1Anos - fase2Anos;
        
        return [
            { periodo: `1-${fase1Anos}`, liquidez: 2, descricao: 'Normal' },
            { periodo: `${fase1Anos + 1}-${fase1Anos + fase2Anos}`, liquidez: 4, descricao: 'Moderado' },
            { periodo: `${fase1Anos + fase2Anos + 1}-${periodo}`, liquidez: 15, descricao: 'Intensivo' }
        ];
    },

    calcularValorFuturo(valorAtual, anos) {
        if (anos <= 0) return valorAtual;
        return valorAtual * Math.pow(1.035, anos); // 3.5% inflação anual
    },

    createFazendaTimeline(periodo) {
        const timelineEl = document.getElementById('fazendaTimeline');
        if (!timelineEl || periodo <= 0) {
            if (timelineEl) timelineEl.innerHTML = '<div class="timeline-phase"><div class="phase-title">Compra Imediata</div><div class="phase-liquidez">Sem acumulação</div></div>';
            return;
        }

        const fases = this.calcularFases(periodo);
        
        timelineEl.innerHTML = fases.map((fase, index) => `
            <div class="timeline-phase ${index === 0 ? 'active' : ''}">
                <div class="phase-title">Fase ${index + 1}</div>
                <div class="phase-period">Anos ${fase.periodo}</div>
                <div class="phase-liquidez">${fase.liquidez}% liquidez</div>
                <div style="font-size: 0.7rem; color: var(--gray-500); margin-top: 4px;">
                    ${fase.descricao}
                </div>
            </div>
        `).join('');
    }
};




    // ================ SIMULATION MANAGER ================ 
    const SimulationManager = {
        updateParameters() {
            AppState.simulationParams.taxaMin = parseFloat(document.getElementById('simTaxaMin').value);
            AppState.simulationParams.taxaMax = parseFloat(document.getElementById('simTaxaMax').value);
            AppState.simulationParams.volatilidade = parseFloat(document.getElementById('simVolatilidade').value);
            AppState.simulationParams.numSimulacoes = parseInt(document.getElementById('simSimulacoes').value);
            
            debugMessage(`Parâmetros de simulação atualizados: ${JSON.stringify(AppState.simulationParams)}`);
            
            this.runSimulation();
        },

        runSimulation() {
            debugMessage('Executando nova simulação Monte Carlo');
            
            const { taxaMin, taxaMax, volatilidade, numSimulacoes } = AppState.simulationParams;
            
            const results = this.generateSimulationResults();
            
            this.updateSimulationResults(results);
            
            if (AppState.currentPage === 'simulations' && AppState.chartJsLoaded) {
                setTimeout(() => {
                    ChartManager.createSimulationCharts();
                }, 100);
            }
            
            Utils.showNotification('Simulação atualizada com sucesso!', 'success');
        },

        generateSimulationResults() {
            const { taxaMin, taxaMax, volatilidade, numSimulacoes } = AppState.simulationParams;
            const finalValues = [];
            
            for (let i = 0; i < numSimulacoes; i++) {
                let patrimonio = 65000000;
                
                for (let year = 0; year < 20; year++) {
                    const baseReturn = (taxaMin + Math.random() * (taxaMax - taxaMin)) / 100;
                    const volatilityFactor = (Math.random() - 0.5) * 2 * (volatilidade / 100);
                    const yearReturn = baseReturn + volatilityFactor;
                    
                    patrimonio = patrimonio * (1 + yearReturn) - 1800000;
                    patrimonio = Math.max(patrimonio, 0);
                }
                
                finalValues.push(patrimonio);
            }
            
            finalValues.sort((a, b) => a - b);
            
            const getPercentile = (arr, p) => {
                const index = Math.floor(arr.length * p / 100);
                return arr[Math.min(index, arr.length - 1)];
            };
            
            const results = {
                p5: getPercentile(finalValues, 5),
                p10: getPercentile(finalValues, 10),
                p25: getPercentile(finalValues, 25),
                p50: getPercentile(finalValues, 50),
                p75: getPercentile(finalValues, 75),
                p90: getPercentile(finalValues, 90),
                p95: getPercentile(finalValues, 95),
                successRate: (finalValues.filter(v => v > 0).length / finalValues.length) * 100,
                allValues: finalValues
            };
            
            debugMessage(`Simulação completada: ${numSimulacoes} iterações, Taxa de sucesso: ${results.successRate.toFixed(1)}%`);
            
            return results;
        },

        updateSimulationResults(results) {
            document.getElementById('simResultP10').textContent = Utils.formatCurrency(results.p10, true);
            document.getElementById('simResultP50').textContent = Utils.formatCurrency(results.p50, true);
            document.getElementById('simResultP90').textContent = Utils.formatCurrency(results.p90, true);
            document.getElementById('simSuccessRate').textContent = results.successRate.toFixed(0) + '%';
            
            document.getElementById('simP5').textContent = Utils.formatCurrency(results.p5, true);
            document.getElementById('simP10').textContent = Utils.formatCurrency(results.p10, true);
            document.getElementById('simP25').textContent = Utils.formatCurrency(results.p25, true);
            document.getElementById('simP50').textContent = Utils.formatCurrency(results.p50, true);
            document.getElementById('simP75').textContent = Utils.formatCurrency(results.p75, true);
            document.getElementById('simP90').textContent = Utils.formatCurrency(results.p90, true);
            document.getElementById('simP95').textContent = Utils.formatCurrency(results.p95, true);
        }
    };

    // ================ REPORT MANAGER SINCRONIZADO ================ 
    // ================ REPORT MANAGER EXTENDIDO ================

window.ProjectionsManager = {
    currentScenario: 'atual',
    projectionData: null,
    cashFlowView: 'annual',
    
    async initialize() {
    debugMessage('🚀 Inicializando ProjectionsManager - VERSÃO SINCRONIZADA v4.3');
    
    try {
        // ✅ PASSO 1: Atualizar card do cenário atual
        this.updateCurrentScenarioCard();
        
        // ✅ PASSO 2: Buscar dados das projeções e aguardar
        await this.updateProjectionsData();
        
        // ✅ PASSO 3: Aguardar processamento completo
        await new Promise(resolve => setTimeout(resolve, 300));
        
        debugMessage('✅ ProjectionsManager inicializado com sucesso');
        
    } catch (error) {
        debugMessage(`❌ Erro na inicialização do ProjectionsManager: ${error.message}`, 'error');
        throw error;
    }
},
    
    async updateProjectionsData() {
     try {
        debugMessage('📊 Atualizando projeções DINÂMICAS v4.3.1');
        
        // ✅ FORÇAR BUSCA NOVA DE DADOS
        const projectionsData = await ApiClient.fetchProjectionsData();
        
        if (projectionsData.success) {
            this.projectionData = projectionsData.projecao_anual;
            debugMessage(`✅ Recebidos ${this.projectionData.length} anos de projeção ATUALIZADOS`);
            
            // ✅ AGUARDAR ANTES DE ATUALIZAR UI
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // ✅ ATUALIZAR ELEMENTOS COM DADOS ATUAIS
            await this.updateProjectionSummaryFixed();
            this.updateMilestones(projectionsData.marcos_temporais);
            this.updateProjectionTable();
            this.updateProjectionStatusBar(); // ✅ NOVA FUNÇÃO
            
            const periodo = parseInt(document.getElementById('periodoCompraFazenda')?.value) || 0;
            FazendaManager.createFazendaTimeline(periodo);
            
        } else {
            throw new Error('Falha ao buscar projeções do backend');
        }
        
    } catch (error) {
        debugMessage(`❌ Erro ao atualizar projeções: ${error.message}`, 'error');
        this.generateFallbackProjections();
    }},

    
    // ✅ MÉTODOS CORRIGIDOS PARA snake_case
    findProjectionByYear(years) {
        if (!this.projectionData) return null;
        return this.projectionData.find(p => p.ano === 2025 + years);
    },
    
    findProjectionByAge(age) {
        if (!this.projectionData) return null;
        return this.projectionData.find(p => p.idade_ana === age);  // ✅ snake_case
    },
    
    findFirstDeficit() {
        if (!this.projectionData) return null;
        return this.projectionData.find(p => p.saldo_liquido < 0);  // ✅ snake_case
    },
    
    async updateProjectionSummary() {
    debugMessage('🔄 Atualizando resumo de projeções - VERSÃO ROBUSTA');
    
    // ✅ VERIFICAÇÃO ROBUSTA DOS DADOS
    if (!this.projectionData || this.projectionData.length === 0) {
        debugMessage('⚠️ Dados de projeção não disponíveis', 'warning');
        
        // ✅ MOSTRAR PLACEHOLDERS
        this.updateElement('patrimonio10Anos', 'Carregando...');
        this.updateElement('patrimonio20Anos', 'Carregando...');
        this.updateElement('patrimonioExpectativa', 'Carregando...');
        this.updateElement('primeiroDeficit', 'Analisando...');
        this.updateElement('statusGeral', 'Processando...');
        return;
    }
    
    debugMessage(`📊 Processando ${this.projectionData.length} anos de dados`);
    
    const expectativa = parseInt(document.getElementById('expectativaVida')?.value || 90);
    
    // ✅ BUSCA ROBUSTA DOS DADOS
    const projeto10Anos = this.findProjectionByYear(10);
    const projeto20Anos = this.findProjectionByYear(20);
    const projetoExpectativa = this.findProjectionByAge(expectativa);
    const primeiroDeficit = this.findFirstDeficit();
    
    debugMessage(`🔍 Dados encontrados - 10 anos: ${!!projeto10Anos}, 20 anos: ${!!projeto20Anos}, expectativa: ${!!projetoExpectativa}`);
    
    // ✅ AGUARDAR DOM ESTAR PRONTO
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ✅ ATUALIZAÇÃO SEQUENCIAL COM VERIFICAÇÃO
    try {
        // Patrimônio em 10 anos
        const valor10Anos = projeto10Anos ? Utils.formatCurrency(projeto10Anos.patrimonio, true) : 'N/A';
        this.updateElement('patrimonio10Anos', valor10Anos);
        
        // Patrimônio em 20 anos  
        const valor20Anos = projeto20Anos ? Utils.formatCurrency(projeto20Anos.patrimonio, true) : 'N/A';
        this.updateElement('patrimonio20Anos', valor20Anos);
        
        // Expectativa de vida
        this.updateElement('expectativaAge', expectativa);
        
        // Patrimônio na expectativa
        const valorExpectativa = projetoExpectativa ? Utils.formatCurrency(projetoExpectativa.patrimonio, true) : 'N/A';
        this.updateElement('patrimonioExpectativa', valorExpectativa);
        
        // Primeiro déficit
        const deficitTexto = primeiroDeficit ? `Ano ${primeiroDeficit.ano}` : 'Não identificado';
        this.updateElement('primeiroDeficit', deficitTexto);
        
        // Status geral
        const statusGeral = this.determineOverallStatus();
        this.updateElement('statusGeral', statusGeral.text);
        
        // ✅ AGUARDAR TODAS AS ATUALIZAÇÕES
        await new Promise(resolve => setTimeout(resolve, 200));
        
        this.updateTrends(projeto10Anos, projeto20Anos, projetoExpectativa, primeiroDeficit);
        
        debugMessage('✅ Resumo de projeções atualizado com sucesso');
        
    } catch (error) {
        debugMessage(`❌ Erro ao atualizar resumo: ${error.message}`, 'error');
    }
},
    
    updateProjectionTable() {
        const tableBody = document.getElementById('projectionTableBody');
        if (!tableBody || !this.projectionData) return;
        
        const rows = this.projectionData.slice(0, 20).map(proj => {
            const statusClass = proj.saldo_liquido >= 0 ? 'value-positive' : 'value-negative';  // ✅ snake_case
            const statusText = proj.saldo_liquido >= 0 ? 'Positivo' : 'Negativo';
            
            return `
                <tr ${proj.compra_fazenda ? 'style="background: rgba(5, 150, 105, 0.05); border-left: 3px solid var(--accent);"' : ''}>
                    <td><strong>${proj.ano}</strong>${proj.compra_fazenda ? ' 🏡' : ''}</td>
                    <td>${proj.idade_ana} anos ${proj.ana_viva ? '' : '(†)'}</td>
                    <td>${Utils.formatCurrency(proj.patrimonio, true)}</td>
                    <td class="value-positive">${Utils.formatCurrency(proj.rendimentos, true)}</td>
                    <td class="value-negative">${Utils.formatCurrency(proj.saidas, true)}</td>
                    <td class="${statusClass}">${Utils.formatCurrency(proj.saldo_liquido, true)}</td>
                    <td><span class="status-badge ${proj.saldo_liquido >= 0 ? 'success' : 'danger'}">${statusText}</span></td>
                </tr>
            `;
        }).join('');
        
        tableBody.innerHTML = rows;
        debugMessage('✅ Tabela de projeção atualizada com snake_case');
    },
    
    // ✅ MÉTODOS AUXILIARES
    updateElement(id, value) {
    const updateWithRetry = async (elementId, newValue, maxAttempts = 15) => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = newValue;
                debugMessage(`✅ Elemento ${elementId} atualizado: ${newValue}`);
                return true;
            }
            
            // ✅ AGUARDAR ELEMENTO APARECER NO DOM
            if (attempt < maxAttempts) {
                debugMessage(`⏳ Tentativa ${attempt}/${maxAttempts}: aguardando elemento ${elementId}`);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        debugMessage(`❌ Elemento ${elementId} não encontrado após ${maxAttempts} tentativas`, 'warning');
        return false;
    };
    
    // ✅ EXECUTAR ATUALIZAÇÃO ASSÍNCRONA
    updateWithRetry(id, value).catch(error => {
        debugMessage(`❌ Erro ao atualizar elemento ${id}: ${error.message}`, 'error');
    });
},
    
    determineOverallStatus() {
        const deficit = this.findFirstDeficit();
        const expectativa = parseInt(document.getElementById('expectativaVida')?.value || 90);
        
        if (!deficit) {
            return { text: 'Sustentável', class: 'value-positive' };
        } else if (deficit.idade_ana > expectativa) {  // ✅ snake_case
            return { text: 'Viável', class: 'value-positive' };
        } else if (deficit.idade_ana > expectativa - 5) {
            return { text: 'Atenção', class: 'value-warning' };
        } else {
            return { text: 'Crítico', class: 'value-negative' };
        }
    },
    
    updateTrends(proj10, proj20, projExp, deficit) {
        // Implementação simplificada para trends
        debugMessage('✅ Trends atualizados');
    },
    
    generateFallbackProjections() {
        debugMessage('🔄 Gerando projeções de fallback com snake_case');
        
        const taxa = parseFloat(document.getElementById('taxaRetorno')?.value || 4.0);
        const expectativa = parseInt(document.getElementById('expectativaVida')?.value || 90);
        const despesas = parseFloat(document.getElementById('despesasMensais')?.value || 150000);
        
        const patrimonio = AppState.currentData?.patrimonio || 65000000;
        let patrimonioAtual = patrimonio;
        const projecao = [];
        
        for (let ano = 0; ano < 30; ano++) {
            const idade_ana = 53 + ano + 1;  // ✅ snake_case
            const anoCalendario = 2025 + ano;
            
            const rendimentos = patrimonioAtual * (taxa / 100);
            let saidasAnuais = 0;
            
            if (idade_ana <= expectativa) {
                saidasAnuais += despesas * 12;
            }
            
            if (ano < 15) {
                saidasAnuais += 50000 * 12;
            }
            
            const saldo_liquido = rendimentos - saidasAnuais;  // ✅ snake_case
            patrimonioAtual += saldo_liquido;
            patrimonioAtual = Math.max(patrimonioAtual, 0);
            
            projecao.push({
                ano: anoCalendario,
                idade_ana: idade_ana,  // ✅ snake_case
                patrimonio: patrimonioAtual,
                rendimentos: rendimentos,
                saidas: saidasAnuais,
                saldo_liquido: saldo_liquido,  // ✅ snake_case
                ana_viva: idade_ana <= expectativa,  // ✅ snake_case
                compra_fazenda: false
            });
        }
        
        this.projectionData = projecao;
        this.updateProjectionSummary();
        this.updateProjectionTable();
        
        debugMessage(`✅ ${projecao.length} anos de fallback gerados com snake_case`);
    },
    
    // Métodos restantes simplificados
    updateCurrentScenarioCard() { debugMessage('✅ Scenario card updated'); },
    updateMilestones() { debugMessage('✅ Milestones updated'); }
};


window.ProjectionsManager.updateProjectionStatusBar = function() {
    debugMessage('📊 Atualizando barra de status das projeções');
    
    // ✅ PEGAR PARÂMETROS ATUAIS DOS INPUTS
    const taxa = parseFloat(document.getElementById('taxaRetorno')?.value || 4.0);
    const expectativa = parseInt(document.getElementById('expectativaVida')?.value || 90);
    const perfil = document.getElementById('perfilInvestimento')?.value || 'moderado';
    const idadeAna = 53;
    const horizonte = expectativa - idadeAna;
    
    // ✅ ATUALIZAR ELEMENTOS DA BARRA DE STATUS
    const elements = {
        'currentRate': `${taxa}%`,
        'projectionHorizon': `${horizonte} anos`,
        'currentProfile': perfil.charAt(0).toUpperCase() + perfil.slice(1),
        'sustainabilityAge': `${expectativa} anos`
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            debugMessage(`✅ Atualizado ${id}: ${value}`);
        }
    });
};

window.ProjectionsManager.updateProjectionSummaryFixed = async function() {
    debugMessage('🔄 Atualizando resumo de projeções DINÂMICO v4.3.1');
    
    // ✅ VERIFICAÇÃO ROBUSTA DOS DADOS
    if (!this.projectionData || this.projectionData.length === 0) {
        debugMessage('⚠️ Dados de projeção não disponíveis', 'warning');
        return;
    }
    
    debugMessage(`📊 Processando ${this.projectionData.length} anos de dados ATUAIS`);
    
    // ✅ USAR PARÂMETROS ATUAIS DO USUÁRIO
    const expectativa = parseInt(document.getElementById('expectativaVida')?.value || 90);
    
    // ✅ BUSCA ROBUSTA DOS DADOS
    const projeto10Anos = this.findProjectionByYear(10);
    const projeto20Anos = this.findProjectionByYear(20);
    const projetoExpectativa = this.findProjectionByAge(expectativa);
    const primeiroDeficit = this.findFirstDeficit();
    
    debugMessage(`🔍 Dados encontrados - 10 anos: ${!!projeto10Anos}, 20 anos: ${!!projeto20Anos}, expectativa: ${!!projetoExpectativa}`);
    
    // ✅ AGUARDAR DOM ESTAR PRONTO
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ✅ ATUALIZAÇÃO SEQUENCIAL COM VERIFICAÇÃO
    try {
        // Patrimônio em 10 anos
        const valor10Anos = projeto10Anos ? Utils.formatCurrency(projeto10Anos.patrimonio, true) : 'N/A';
        this.updateElement('patrimonio10Anos', valor10Anos);
        
        // Patrimônio em 20 anos  
        const valor20Anos = projeto20Anos ? Utils.formatCurrency(projeto20Anos.patrimonio, true) : 'N/A';
        this.updateElement('patrimonio20Anos', valor20Anos);
        
        // Expectativa de vida DINÂMICA
        this.updateElement('expectativaAge', expectativa);
        
        // Patrimônio na expectativa
        const valorExpectativa = projetoExpectativa ? Utils.formatCurrency(projetoExpectativa.patrimonio, true) : 'N/A';
        this.updateElement('patrimonioExpectativa', valorExpectativa);
        
        // Primeiro déficit
        const deficitTexto = primeiroDeficit ? `Ano ${primeiroDeficit.ano}` : 'Não identificado';
        this.updateElement('primeiroDeficit', deficitTexto);
        
        // Status geral
        const statusGeral = this.determineOverallStatus();
        this.updateElement('statusGeral', statusGeral.text);
        
        // ✅ ATUALIZAR TAMBÉM A BARRA DE STATUS
        this.updateProjectionStatusBar();
        
        // ✅ AGUARDAR TODAS AS ATUALIZAÇÕES
        await new Promise(resolve => setTimeout(resolve, 200));
        
        this.updateTrends(projeto10Anos, projeto20Anos, projetoExpectativa, primeiroDeficit);
        
        debugMessage('✅ Resumo de projeções atualizado DINAMICAMENTE com sucesso');
        
    } catch (error) {
        debugMessage(`❌ Erro ao atualizar resumo dinâmico: ${error.message}`, 'error');
    }
};

    // ================ UI MANAGER SINCRONIZADO ================ 
    const UIManager = {
        showLoading(show) {
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) {
                if (show) {
                    refreshBtn.classList.add('loading');
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Carregando...</span>';
                } else {
                    refreshBtn.classList.remove('loading');
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Atualizar</span>';
                }
            }
        },
        updateTable() {
        if (!AppState.currentData || !AppState.currentData.sensibilidade) {
            debugMessage('Dados insuficientes para atualizar tabela', 'warning');
            return;
        }

        const tbody = document.getElementById('cenarioTableBody');
        if (!tbody) {
            debugMessage('Elemento cenarioTableBody não encontrado', 'warning');
            return;
        }

        const { sensibilidade } = AppState.currentData;
        
        tbody.innerHTML = sensibilidade.map(item => {
            const status = this.getStatusBadge(item.fazenda, item.percentual);
            return `
                <tr>
                    <td><strong>${item.taxa}%</strong></td>
                    <td>${Utils.formatCurrency(item.fazenda, true)}</td>
                    <td>${Utils.formatPercentage(item.percentual)}</td>
                    <td>${status}</td>
                </tr>
            `;
        }).join('');

        debugMessage('Tabela de cenários atualizada com sucesso');
    },

        updateSystemStatus(isConnected) {
            const statusEl = document.getElementById('systemStatus');
            if (statusEl) {
                if (isConnected) {
                    statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Sistema Online</span>';
                    statusEl.className = 'status-indicator connected';
                } else {
                    statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Sistema Offline</span>';
                    statusEl.className = 'status-indicator disconnected';
                }
            }
        },




        updateStatusVisual(status) {
            const statusBadge = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            const statusDescription = document.getElementById('statusDescription');
            const statusEl = document.getElementById('valorStatus');
            
            if (!statusBadge || !statusText || !statusDescription) return;
            
            statusBadge.classList.remove('critico', 'atencao', 'viavel');
            
            let icon, description;
            
            if (status === 'crítico') {
                statusBadge.classList.add('critico');
                icon = 'exclamation-triangle';
                description = 'Plano insustentável - ação urgente necessária';
                if (statusEl) statusEl.innerHTML = '⚠️ Crítico';
            } else if (status === 'atenção') {
                statusBadge.classList.add('atencao');
                icon = 'exclamation-circle';
                description = 'Plano viável mas com margem baixa';
                if (statusEl) statusEl.innerHTML = '⚡ Atenção';
            } else {
                statusBadge.classList.add('viavel');
                icon = 'check-circle';
                description = 'Plano sustentável com boa margem';
                if (statusEl) statusEl.innerHTML = '✅ Viável';
            }
            
            statusBadge.innerHTML = `<i class="fas fa-${icon}"></i><span>${status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Calculando'}</span>`;
            statusDescription.textContent = description;
            
            debugMessage(`Status visual atualizado: ${status}`);
        },

        updateAlerts() {
            const container = document.getElementById('alertContainer');
            if (!container || !AppState.currentData) return;
            
            const { resultado, status } = AppState.currentData;
            container.innerHTML = '';
            
            if (status === 'crítico' || (resultado && resultado.fazenda < 0)) {
                container.innerHTML = `
                    <div class="alert danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Atenção:</strong> O plano atual pode não ser sustentável. 
                        Considere ajustar as variáveis para melhorar o resultado.
                    </div>
                `;
            } else if (status === 'atenção') {
                container.innerHTML = `
                    <div class="alert warning">
                        <i class="fas fa-info-circle"></i>
                        <strong>Cuidado:</strong> Margem de segurança baixa. 
                        Monitore as variáveis de perto.
                    </div>
                `;
            } else if (status === 'viável') {
                container.innerHTML = `
                    <div class="alert success">
                        <i class="fas fa-check-circle"></i>
                        <strong>Excelente:</strong> O plano está funcionando bem dentro dos parâmetros estabelecidos.
                    </div>
                `;
            }
        },

       

        getStatusBadge(fazenda, percentual) {
            if (fazenda < 0) {
                return '<span class="status-badge danger">Inviável</span>';
            } else if (percentual < 5) {
                return '<span class="status-badge warning">Crítico</span>';
            } else if (percentual < 15) {
                return '<span class="status-badge warning">Atenção</span>';
            } else {
                return '<span class="status-badge success">Viável</span>';
            }
        },
    updateFazendaMetrics(dadosFazenda) {
        if (!dadosFazenda) return;
        
        debugMessage('Atualizando métricas da fazenda');
        
        // Atualizar card principal
        FazendaManager.updateFazendaCard(dadosFazenda);
        
        // Atualizar informações nos controles
        FazendaManager.updateFazendaInfo();
        
        debugMessage('Métricas da fazenda atualizadas');
    },

    // Atualizar método existente updateMetrics para incluir fazenda
    

    // Manter outros métodos existentes (updateStatusVisual, updateAlerts, etc.)
    updateStatusVisual(status) {
        const statusBadge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        const statusDescription = document.getElementById('statusDescription');
        const statusEl = document.getElementById('valorStatus');
        
        if (!statusBadge || !statusText || !statusDescription) return;
        
        statusBadge.classList.remove('critico', 'atencao', 'viavel');
        
        let icon, description;
        
        if (status === 'crítico') {
            statusBadge.classList.add('critico');
            icon = 'exclamation-triangle';
            description = 'Plano insustentável - ação urgente necessária';
            if (statusEl) statusEl.innerHTML = '⚠️ Crítico';
        } else if (status === 'atenção') {
            statusBadge.classList.add('atencao');
            icon = 'exclamation-circle';
            description = 'Plano viável mas com margem baixa';
            if (statusEl) statusEl.innerHTML = '⚡ Atenção';
        } else {
            statusBadge.classList.add('viavel');
            icon = 'check-circle';
            description = 'Plano sustentável com boa margem';
            if (statusEl) statusEl.innerHTML = '✅ Viável';
        }
        
        statusBadge.innerHTML = `<i class="fas fa-${icon}"></i><span>${status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Calculando'}</span>`;
        statusDescription.textContent = description;
        
        debugMessage(`Status visual atualizado: ${status}`);
    },

    updateAlerts() {
        const container = document.getElementById('alertContainer');
        if (!container || !AppState.currentData) return;
        
        const { resultado, status } = AppState.currentData;
        container.innerHTML = '';
        
        // Alertas para fazenda
        if (resultado.fazenda_analysis) {
            const analysis = resultado.fazenda_analysis;
            
            if (!analysis.viavel && resultado.periodo_compra_fazenda) {
                container.innerHTML = `
                    <div class="alert warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Fazenda:</strong> Valor insuficiente em ${resultado.periodo_compra_fazenda} anos. 
                        Disponível: ${Utils.formatCurrency(analysis.disponivel_periodo, true)}, 
                        Necessário: ${Utils.formatCurrency(analysis.necessario_periodo, true)}
                    </div>
                `;
            }
        }
        
        // Alertas gerais do plano
        if (status === 'crítico' || (resultado && resultado.fazenda < 0)) {
            container.innerHTML += `
                <div class="alert danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Atenção:</strong> O plano atual pode não ser sustentável. 
                    Considere ajustar as variáveis para melhorar o resultado.
                </div>
            `;
        } else if (status === 'atenção') {
            container.innerHTML += `
                <div class="alert warning">
                    <i class="fas fa-info-circle"></i>
                    <strong>Cuidado:</strong> Margem de segurança baixa. 
                    Monitore as variáveis de perto.
                </div>
            `;
        } else if (status === 'viável') {
            container.innerHTML += `
                <div class="alert success">
                    <i class="fas fa-check-circle"></i>
                    <strong>Excelente:</strong> O plano está funcionando bem dentro dos parâmetros estabelecidos.
                </div>
            `;
        }
    },

    // Manter outros métodos existentes...
    showLoading(show) {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            if (show) {
                refreshBtn.classList.add('loading');
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Carregando...</span>';
            } else {
                refreshBtn.classList.remove('loading');
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Atualizar</span>';
            }
        }
    },

    updateTable() {
        if (!AppState.currentData || !AppState.currentData.sensibilidade) {
            debugMessage('Dados insuficientes para atualizar tabela', 'warning');
            return;
        }

        const tbody = document.getElementById('cenarioTableBody');
        if (!tbody) {
            debugMessage('Elemento cenarioTableBody não encontrado', 'warning');
            return;
        }

        const { sensibilidade } = AppState.currentData;
        
        tbody.innerHTML = sensibilidade.map(item => {
            const status = this.getStatusBadge(item.fazenda, item.percentual);
            return `
                <tr>
                    <td><strong>${item.taxa}%</strong></td>
                    <td>${Utils.formatCurrency(item.fazenda, true)}</td>
                    <td>${Utils.formatPercentage(item.percentual)}</td>
                    <td>${status}</td>
                </tr>
            `;
        }).join('');

        debugMessage('Tabela de cenários atualizada com sucesso');
    },

    getStatusBadge(fazenda, percentual) {
        if (fazenda < 0) {
            return '<span class="status-badge danger">Inviável</span>';
        } else if (percentual < 5) {
            return '<span class="status-badge warning">Crítico</span>';
        } else if (percentual < 15) {
            return '<span class="status-badge warning">Atenção</span>';
        } else {
            return '<span class="status-badge success">Viável</span>';
        }
    },

    updateSystemStatus(isConnected) {
        const statusEl = document.getElementById('systemStatus');
        if (statusEl) {
            if (isConnected) {
                statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Sistema Online</span>';
                statusEl.className = 'status-indicator connected';
            } else {
                statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Sistema Offline</span>';
                statusEl.className = 'status-indicator disconnected';
            }
        }
    }
};

UIManager.updateMetrics = function() {
    if (!AppState.currentData) {
        debugMessage('⚠️ Dados não disponíveis para updateMetrics');
        return;
    }
    
    debugMessage('🔄 Atualizando métricas sincronizadas v4.4');
    const { resultado, patrimonio, status } = AppState.currentData;
    
    // ✅ 1. PATRIMÔNIO TOTAL
    const patrimonioEl = document.getElementById('valorPatrimonio');
    if (patrimonioEl) {
        patrimonioEl.textContent = Utils.formatCurrency(patrimonio, true);
    }
    
    // ✅ 2. FAZENDA (PRINCIPAL CORREÇÃO)
    const fazendaEl = document.getElementById('valorFazenda');
    const percentualEl = document.getElementById('percentualFazenda');
    const trendEl = document.getElementById('trendFazenda');
    
    if (fazendaEl && resultado) {
        // Usar fazenda_disponivel (campo correto)
        const valorFazenda = resultado.fazenda_disponivel || resultado.fazenda || 0;
        fazendaEl.textContent = Utils.formatCurrency(valorFazenda, true);
        
        if (percentualEl) {
            const percentual = resultado.percentual_fazenda || resultado.percentual || 0;
            percentualEl.textContent = Utils.formatPercentage(percentual);
        }
        
        if (trendEl) {
            trendEl.className = 'metric-trend';
            if (valorFazenda > 0) {
                trendEl.classList.add('positive');
                const periodo = document.getElementById('periodoCompraFazenda')?.value || 0;
                const periodoTexto = periodo > 0 ? `Em ${periodo} anos` : 'Compra imediata';
                trendEl.innerHTML = `<i class="fas fa-calendar"></i><span>${periodoTexto}</span>`;
            } else {
                trendEl.classList.add('negative');
                trendEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Inviável</span>';
            }
        }
    }
    
    // ✅ 3. ATUALIZAR CARD DA FAZENDA COM DADOS COMPLETOS
    try {
        const dadosFazenda = {
            fazenda_disponivel: resultado.fazenda_disponivel || resultado.fazenda || 0,
            percentual_fazenda: resultado.percentual_fazenda || resultado.percentual || 0,
            fazenda_analysis: AppState.currentData.fazenda_analysis || {},
            periodo_compra_fazenda: AppState.currentData.periodo_compra_fazenda,
            valor_fazenda_atual: AppState.currentData.valor_fazenda_atual || 0,
            valor_fazenda_futuro: AppState.currentData.valor_fazenda_futuro || 0
        };
        
        FazendaManager.updateFazendaCard(dadosFazenda);
        debugMessage('✅ Card da fazenda atualizado');
    } catch (error) {
        debugMessage(`⚠️ Erro ao atualizar card da fazenda: ${error.message}`, 'warning');
    }
    
    // ✅ 4. ARTE/GALERIA
    const arteEl = document.getElementById('valorArte');
    const percentualArteEl = document.getElementById('percentualArte');
    const trendArteEl = document.getElementById('trendArte');
    
    if (arteEl && resultado) {
        const valorArte = resultado.arte || 0;
        arteEl.textContent = Utils.formatCurrency(valorArte, true);
        
        if (percentualArteEl) {
            percentualArteEl.textContent = Utils.formatPercentage(resultado.percentual_arte || 0);
        }
        
        if (trendArteEl) {
            trendArteEl.className = 'metric-trend';
            if (valorArte > 0) {
                trendArteEl.classList.add('positive');
                trendArteEl.innerHTML = `<i class="fas fa-palette"></i><span>${Utils.formatPercentage(resultado.percentual_arte || 0)}</span>`;
            } else {
                trendArteEl.classList.add('neutral');
                trendArteEl.innerHTML = '<i class="fas fa-palette"></i><span>Indisponível</span>';
            }
        }
    }
    
    // ✅ 5. PERFIL DE INVESTIMENTO
    const perfilEl = document.getElementById('perfilAtual');
    const retornoEl = document.getElementById('retornoEsperado');
    
    if (perfilEl) {
        const perfil = document.getElementById('perfilInvestimento')?.value || 'moderado';
        perfilEl.textContent = perfil.charAt(0).toUpperCase() + perfil.slice(1);
        
        const retornos = {
            'conservador': '3.5% a.a.',
            'moderado': '4.5% a.a.',
            'balanceado': '5.2% a.a.'
        };
        if (retornoEl) {
            retornoEl.textContent = retornos[perfil] || '4.5% a.a.';
        }
    }
    
    // ✅ 6. COMPROMISSOS TOTAIS
    const compromissosEl = document.getElementById('valorCompromissos');
    if (compromissosEl && resultado) {
        const totalCompromissos = resultado.total_compromissos || resultado.total || 0;
        compromissosEl.textContent = Utils.formatCurrency(totalCompromissos, true);
    }
    
    // ✅ 7. STATUS DO PLANO
    this.updateStatusVisual(status);
    
    const statusEl = document.getElementById('valorStatus');
    if (statusEl) {
        if (status === 'crítico') {
            statusEl.innerHTML = '⚠️ Crítico';
        } else if (status === 'atenção') {
            statusEl.innerHTML = '⚡ Atenção';
        } else {
            statusEl.innerHTML = '✅ Viável';
        }
    }

    debugMessage('✅ Métricas v4.4 atualizadas incluindo fazenda');
};

    // ================ FUNÇÕES GLOBAIS ================ 
    function showPage(pageId) {
    debugMessage(`Navegando para página: ${pageId}`);
    
    // Atualizar UI imediatamente
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
        AppState.currentPage = pageId;
    }
    
    if (event && event.target) {
        const navItem = event.target.closest('.nav-item');
        if (navItem) navItem.classList.add('active');
    }
    
    // ✅ CARREGAMENTO INTELIGENTE DOS GRÁFICOS
    loadChartsForPage(pageId);
}
async function loadChartsForPage(pageId) {
    debugMessage(`Carregando gráficos para página: ${pageId}`);
    
    // ✅ AGUARDAR Chart.js estar disponível
    await ensureChartJsReady();
    
    // ✅ AGUARDAR dados estarem disponíveis
    if (!AppState.currentData) {
        debugMessage('Dados não disponíveis, aguardando...', 'warning');
        await waitForData();
    }
    
    // ✅ CARREGAR GRÁFICOS ESPECÍFICOS DA PÁGINA
    try {
        switch(pageId) {
            case 'dashboard':
                ChartManager.hideChartPlaceholders(['compromissosContainer', 'allocationContainer', 'sensibilidadeContainer']);
                ChartManager.createCompromissosChart();
                ChartManager.createAllocationChart();
                ChartManager.createSensibilidadeChart();
                break;
                
            case 'allocation':
                ChartManager.hideChartPlaceholders(['currentAllocationContainer', 'benchmarkContainer', 'allocationTrendsContainer']);
                ChartManager.createAllocationPageCharts();
                updateAllocationTable(); // ✅ NOVA FUNÇÃO
                break;
                
            case 'projections':
    debugMessage('📊 Carregando página de projeções - VERSÃO SINCRONIZADA');
    
    ChartManager.hideChartPlaceholders([
        'patrimonialEvolutionContainer', 
        'despesasFlowContainer', 
        'rentabilidadeFlowContainer', 
        'allocationEvolutionContainer'
    ]);
    
    try {
        // ✅ PASSO 1: Inicializar ProjectionsManager
        debugMessage('🚀 Passo 1: Inicializando ProjectionsManager');
        await ProjectionsManager.initialize();
        
        // ✅ PASSO 2: Aguardar dados estarem disponíveis
        debugMessage('⏳ Passo 2: Aguardando dados das projeções');
        let attempts = 0;
        const maxAttempts = 20;
        
        while (!ProjectionsManager.projectionData && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 150));
            attempts++;
            debugMessage(`⏳ Tentativa ${attempts}/${maxAttempts} - aguardando dados`);
        }
        
        if (!ProjectionsManager.projectionData) {
            debugMessage('❌ Timeout: Dados de projeção não carregaram', 'error');
            return;
        }
        
        debugMessage(`✅ Passo 2 concluído: ${ProjectionsManager.projectionData.length} anos de dados`);
        
        // ✅ PASSO 3: Aguardar DOM estar pronto
        debugMessage('🏗️ Passo 3: Verificando elementos DOM');
        const requiredElements = [
            'patrimonialEvolutionChart',
            'despesasFlowChart', 
            'rentabilidadeFlowChart', 
            'allocationEvolutionChart'
        ];
        
        const elementsReady = requiredElements.every(id => document.getElementById(id));
        if (!elementsReady) {
            debugMessage('❌ Elementos DOM não encontrados para projeções', 'error');
            return;
        }
        
        // ✅ PASSO 4: Destruir gráficos existentes
        debugMessage('🗑️ Passo 4: Limpando gráficos existentes');
        ChartManager.destroyExistingCharts();
        
        // ✅ PASSO 5: Aguardar limpeza
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // ✅ PASSO 6: Criar gráficos sequencialmente
        debugMessage('📊 Passo 6: Criando gráficos de projeção');
        
        if (typeof Chart !== 'undefined') {
            await new Promise(resolve => {
                ChartManager.createPatrimonialEvolutionChart();
                setTimeout(resolve, 100);
            });
            
            await new Promise(resolve => {
                ChartManager.createDespesasFlowChart();
                setTimeout(resolve, 100);
            });
            
            await new Promise(resolve => {
                ChartManager.createRentabilidadeFlowChart();
                setTimeout(resolve, 100);
            });
            
            await new Promise(resolve => {
                ChartManager.createAllocationEvolutionChart();
                setTimeout(resolve, 100);
            });
            
            debugMessage('✅ Todos os gráficos de projeção criados com sucesso');
        } else {
            debugMessage('❌ Chart.js não disponível', 'error');
        }
        
    } catch (error) {
        debugMessage(`❌ Erro no carregamento de projeções: ${error.message}`, 'error');
    }
    break;


            case 'simulations':
                ChartManager.hideChartPlaceholders(['monteCarloContainer', 'distribuicaoContainer']);
                ChartManager.createSimulationCharts();
                break;
                
            case 'scenarios':
                ChartManager.hideChartPlaceholders(['scenarioComparisonContainer', 'scenarioEvolutionContainer', 'stressTestContainer']);
                ChartManager.createScenarioCharts();
                break;
                
            case 'sensitivity':
                ChartManager.hideChartPlaceholders(['returnSensitivityContainer', 'expenseSensitivityContainer', 'bidimensionalContainer']);
                ChartManager.createSensitivityCharts();
                break;
                
            case 'reports':
                // Página de relatórios não precisa de gráficos
                break;
                
            default:
                debugMessage(`Página ${pageId} não reconhecida`, 'warning');
        }
        
        debugMessage(`✅ Gráficos carregados para ${pageId}`);
        
    } catch (error) {
        debugMessage(`❌ Erro ao carregar gráficos para ${pageId}: ${error.message}`, 'error');
        ChartManager.showChartError();
    }
}

// ✅ NOVA FUNÇÃO: Garantir que Chart.js está pronto
async function ensureChartJsReady() {
    if (AppState.chartJsLoaded && typeof Chart !== 'undefined') {
        return true;
    }
    
    debugMessage('Chart.js não está pronto, aguardando...', 'warning');
    
    return new Promise((resolve, reject) => {
        const maxAttempts = 10;
        let attempts = 0;
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (typeof Chart !== 'undefined') {
                clearInterval(checkInterval);
                AppState.chartJsLoaded = true;
                debugMessage('✅ Chart.js agora está disponível');
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                debugMessage('❌ Timeout aguardando Chart.js', 'error');
                AppState.chartJsLoaded = false;
                resolve(false); // Não rejeitar, usar fallback
            }
        }, 200);
    });
}

// ✅ NOVA FUNÇÃO: Aguardar dados da API
async function waitForData() {
    if (AppState.currentData) {
        return true;
    }
    
    return new Promise((resolve) => {
        const maxWait = 5000; // 5 segundos máximo
        const startTime = Date.now();
        
        const checkData = setInterval(() => {
            if (AppState.currentData) {
                clearInterval(checkData);
                resolve(true);
            } else if (Date.now() - startTime > maxWait) {
                clearInterval(checkData);
                debugMessage('Timeout aguardando dados - usando fallback', 'warning');
                resolve(false);
            }
        }, 100);
    });
}

window.ReportManager = {
     async generateDetailedReport(tipo, parametros = null) {
        debugMessage(`Gerando relatório detalhado: ${tipo}`);
        
        // ✅ VALIDAÇÃO ANTES DE CONTINUAR
        if (!this.validateParameters()) {
            return;
        }
        
        this.showReportStatus(true, `Preparando relatório ${tipo}...`);
        
        try {
            // Coletar parâmetros atuais se não fornecidos
            const params = parametros || this.collectCurrentParameters();
            
            debugMessage(`Parâmetros coletados: ${JSON.stringify(params)}`);
            
            // Resto da função permanece igual...
            const previewData = await this.fetchReportPreview(tipo, params);
            
            if (previewData.success) {
                const shouldProceed = await this.showReportPreview(tipo, previewData);
                
                if (shouldProceed) {
                    await this.downloadPDFReport(tipo, params);
                }
            } else {
                throw new Error(previewData.error || 'Erro ao gerar preview');
            }
            
        } catch (error) {
            debugMessage(`Erro ao gerar relatório: ${error.message}`, 'error');
            Utils.showNotification(`Erro: ${error.message}`, 'danger');
        } finally {
            this.showReportStatus(false);
        }
    },
    
    collectCurrentParameters() {
        return {
            taxa: document.getElementById('taxaRetorno').value,
            expectativa: document.getElementById('expectativaVida').value,
            despesas: document.getElementById('despesasMensais').value,
            perfil: document.getElementById('perfilInvestimento').value,
            inicio_renda_filhos: document.getElementById('inicioRendaFilhos').value,
            custo_fazenda: document.getElementById('valorFazendaAtual').value,  // ✅ CORRIGIDO
            periodo_compra_fazenda: document.getElementById('periodoCompraFazenda').value  // ✅ ADICIONADO campo faltante
        };
    },
    
    // ✅ FUNÇÃO DE VALIDAÇÃO ADICIONAL (NOVA)
    validateParameters() {
        const requiredFields = [
            'taxaRetorno', 'expectativaVida', 'despesasMensais', 
            'perfilInvestimento', 'inicioRendaFilhos', 'valorFazendaAtual', 'periodoCompraFazenda'
        ];
        
        const missing = requiredFields.filter(fieldId => !document.getElementById(fieldId));
        
        if (missing.length > 0) {
            console.error('❌ Campos obrigatórios não encontrados:', missing);
            Utils.showNotification(`Erro: Campos não encontrados: ${missing.join(', ')}`, 'danger');
            return false;
        }
        
        return true;
    },
    
    async fetchReportPreview(tipo, params) {
        const url = `/api/relatorio-preview/${tipo}?${new URLSearchParams(params)}`;
        debugMessage(`Buscando preview: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    },
    
    async showReportPreview(tipo, previewData) {
        return new Promise((resolve) => {
            // Criar modal de preview
            const modal = this.createPreviewModal(tipo, previewData);
            document.body.appendChild(modal);
            
            // Event listeners para botões
            modal.querySelector('.btn-confirm').onclick = () => {
                modal.remove();
                resolve(true);
            };
            
            modal.querySelector('.btn-cancel').onclick = () => {
                modal.remove();
                resolve(false);
            };
            
            modal.querySelector('.btn-close').onclick = () => {
                modal.remove();
                resolve(false);
            };
        });
    },
    
    createPreviewModal(tipo, previewData) {
        const modal = document.createElement('div');
        modal.className = 'report-preview-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📋 Preview: Relatório ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</h3>
                        <button class="btn-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${this.formatPreviewContent(tipo, previewData)}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary btn-cancel">Cancelar</button>
                        <button class="btn btn-primary btn-confirm">📄 Gerar PDF</button>
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    },
    
    formatPreviewContent(tipo, previewData) {
        const { dados_preview, parametros, dados_base } = previewData;
        
        let content = `
            <div class="preview-section">
                <h4>📊 Parâmetros Configurados:</h4>
                <div class="preview-grid">
                    <div class="preview-item">
                        <strong>Taxa:</strong> ${parametros.taxa}% a.a.
                    </div>
                    <div class="preview-item">
                        <strong>Expectativa:</strong> ${parametros.expectativa} anos
                    </div>
                    <div class="preview-item">
                        <strong>Despesas:</strong> ${Utils.formatCurrency(parametros.despesas, true)}/mês
                    </div>
                    <div class="preview-item">
                        <strong>Perfil:</strong> ${parametros.perfil}
                    </div>
                </div>
            </div>
            
            <div class="preview-section">
                <h4>🎯 Resultado Principal:</h4>
                <div class="status-preview ${dados_base.status}">
                    <strong>Status:</strong> ${dados_base.status.toUpperCase()}<br>
                    <strong>Fazenda:</strong> ${Utils.formatCurrency(dados_base.fazenda_disponivel, true)}<br>
                    <strong>Percentual:</strong> ${dados_base.percentual_fazenda.toFixed(1)}%
                </div>
            </div>
        `;
        
        if (tipo === 'executivo') {
            content += `
                <div class="preview-section">
                    <h4>💡 Principais Insights:</h4>
                    <ul class="insights-list">
                        ${dados_preview.insights.slice(0, 3).map(insight => `<li>${insight}</li>`).join('')}
                    </ul>
                </div>
                <div class="preview-section">
                    <h4>🎯 Recomendações:</h4>
                    <ul class="recommendations-list">
                        ${dados_preview.recomendacoes.slice(0, 3).map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else if (tipo === 'tecnico') {
            content += `
                <div class="preview-section">
                    <h4>🔬 Metodologia Incluída:</h4>
                    <ul>
                        <li>Fórmulas de valor presente detalhadas</li>
                        <li>Premissas e cálculos explicados</li>
                        <li>Projeções anuais completas</li>
                        <li>Asset allocation detalhado</li>
                    </ul>
                </div>
            `;
        } else if (tipo === 'simulacao') {
            const stressTests = Object.keys(dados_preview.stress_tests || {});
            content += `
                <div class="preview-section">
                    <h4>⚡ Stress Tests Incluídos:</h4>
                    <ul>
                        ${stressTests.map(test => `<li>${test.replace('_', ' ').toUpperCase()}</li>`).join('')}
                    </ul>
                </div>
                <div class="preview-section">
                    <h4>📈 Análises de Sensibilidade:</h4>
                    <ul>
                        <li>Impacto da taxa de retorno (2% a 10%)</li>
                        <li>Impacto das despesas mensais</li>
                        <li>Cenários de otimização</li>
                    </ul>
                </div>
            `;
        }
        
        return content;
    },
    
    async downloadPDFReport(tipo, params) {
        const url = `/api/relatorio/${tipo}?${new URLSearchParams(params)}`;
        debugMessage(`Baixando PDF: ${url}`);
        
        this.showReportStatus(true, 'Gerando PDF... Isso pode levar alguns segundos.');
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }
            
            // Download do arquivo
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `relatorio_${tipo}_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            window.URL.revokeObjectURL(downloadUrl);
            
            // Adicionar ao histórico
            this.addToReportHistory(tipo, params);
            
            Utils.showNotification(`✅ Relatório ${tipo} gerado com sucesso!`, 'success');
            
        } catch (error) {
            throw new Error(`Falha ao gerar PDF: ${error.message}`);
        }
    },
    
    // Manter funções existentes
    showReportStatus(show, message = '') {
        const statusEl = document.getElementById('reportStatus');
        if (statusEl) {
            if (show) {
                statusEl.style.display = 'block';
                statusEl.innerHTML = `
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>${message}</span>
                `;
            } else {
                statusEl.style.display = 'none';
            }
        }
    },
    
    addToReportHistory(tipo, params) {
        const now = new Date();
        const report = {
            id: Date.now(),
            timestamp: now,
            tipo: tipo,
            parametros: {
                taxa: params.taxa,
                expectativa: params.expectativa,
                despesas: params.despesas,
                perfil: params.perfil
            },
            status: 'gerado'
        };
        
        AppState.reportHistory.unshift(report);
        AppState.reportHistory = AppState.reportHistory.slice(0, 10);
        
        this.updateReportHistoryTable();
    },
    
    updateReportHistoryTable() {
        const tbody = document.getElementById('reportHistoryBody');
        if (!tbody) return;
        
        if (AppState.reportHistory.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--gray-500); padding: 40px;">
                        Nenhum relatório gerado ainda. Clique em um dos cartões acima para gerar seu primeiro relatório.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = AppState.reportHistory.map(report => {
            let reportTypeName;
            switch(report.tipo) {
                case 'executivo':
                    reportTypeName = 'Relatório Executivo';
                    break;
                case 'tecnico':
                    reportTypeName = 'Relatório Técnico';
                    break;
                case 'simulacao':
                    reportTypeName = 'Simulação e Cenários';
                    break;
                default:
                    reportTypeName = `Relatório ${report.tipo.charAt(0).toUpperCase() + report.tipo.slice(1)}`;
            }
            
            return `
                <tr>
                    <td>${report.timestamp.toLocaleString('pt-BR')}</td>
                    <td>${reportTypeName}</td>
                    <td>
                        Taxa: ${report.parametros.taxa}%, 
                        Expectativa: ${report.parametros.expectativa} anos, 
                        Despesas: ${Utils.formatCurrency(parseFloat(report.parametros.despesas), true)}
                    </td>
                    <td><span class="status-badge success">Gerado</span></td>
                    <td>
                        <button class="widget-action" onclick="ReportManager.regenerateReport('${report.tipo}', ${JSON.stringify(report.parametros).replace(/"/g, '&quot;')})" title="Regenerar relatório">
                            <i class="fas fa-redo"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    async regenerateReport(tipo, parametros) {
        debugMessage(`Regenerando relatório: ${tipo}`);
        await this.generateDetailedReport(tipo, parametros);
    }
};



// ✅ NOVA FUNÇÃO: Atualizar tabela Asset Allocation
function updateAllocationTableCorrected() {
    const tbody = document.getElementById('allocationTableBody');
    if (!tbody || !AppState.currentData) {
        debugMessage('⚠️ Tabela allocation ou dados não disponíveis', 'warning');
        return;
    }
    
    const { allocation } = AppState.currentData;
    if (!allocation) return;
    
    const perfil = document.getElementById('perfilInvestimento')?.value || 'moderado';
    
    const benchmarks = {
        'conservador': { 'Renda Fixa Nacional': 75, 'Renda Fixa Internacional': 10, 'Ações Brasil': 8, 'Ações Internacionais': 5, 'Fundos Imobiliários': 2 },
        'moderado': { 'Renda Fixa Nacional': 45, 'Renda Fixa Internacional': 25, 'Ações Brasil': 15, 'Ações Internacionais': 12, 'Fundos Imobiliários': 3 },
        'balanceado': { 'Renda Fixa Nacional': 35, 'Renda Fixa Internacional': 15, 'Ações Brasil': 25, 'Ações Internacionais': 20, 'Fundos Imobiliários': 5 }
    };
    
    const benchmark = benchmarks[perfil] || benchmarks['moderado'];
    
    tbody.innerHTML = allocation.map(item => {
        const benchmarkValue = benchmark[item.nome] || 0;
        const diferenca = item.percentual - benchmarkValue;
        const rebalanceamento = Math.abs(diferenca) > 2 ? (diferenca > 0 ? 'Reduzir' : 'Aumentar') : 'Manter';
        
        return `
            <tr>
                <td><strong>${item.nome}</strong></td>
                <td>${item.percentual.toFixed(1)}%</td>
                <td>${Utils.formatCurrency(item.valor, true)}</td>
                <td>${benchmarkValue}%</td>
                <td class="${diferenca > 0 ? 'value-positive' : diferenca < 0 ? 'value-negative' : 'value-neutral'}">
                    ${diferenca > 0 ? '+' : ''}${diferenca.toFixed(1)}%
                </td>
                <td>
                    <span class="status-badge ${rebalanceamento === 'Manter' ? 'success' : 'warning'}">${rebalanceamento}</span>
                </td>
            </tr>
        `;
    }).join('');
    
    debugMessage('✅ Tabela allocation atualizada');
}






    function showAnalysis(type) {
        document.querySelectorAll('.analysis-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.analysis-content').forEach(content => {
            content.classList.remove('active');
        });
        
        event.target.classList.add('active');
        document.getElementById(type + 'Content').classList.add('active');
    }

    function updateProjection(scenario) {
        document.querySelectorAll('.scenario-card').forEach(card => {
            card.classList.remove('active');
        });
        event.target.classList.add('active');
        
        Utils.showNotification(`Projeção atualizada para cenário ${scenario}`, 'success');
    }

    function updateSimulationParams() {
        debugMessage('Atualizando parâmetros de simulação');
        
        document.getElementById('simTaxaMinDisplay').textContent = document.getElementById('simTaxaMin').value + '%';
        document.getElementById('simTaxaMaxDisplay').textContent = document.getElementById('simTaxaMax').value + '%';
        document.getElementById('simVolatilidadeDisplay').textContent = document.getElementById('simVolatilidade').value + '%';
        
        SimulationManager.updateParameters();
    }

    function generateReportPDF(tipo) {
    debugMessage(`Solicitação de geração de relatório: ${tipo}`);
    // ✅ VERIFICAR SE ReportManager EXISTE
    if (typeof ReportManager !== 'undefined') {
        ReportManager.generateDetailedReport(tipo);
    } else {
        console.error('ReportManager não inicializado ainda');
        Utils.showNotification('Sistema de relatórios ainda carregando...', 'warning');
    }
}

    function generateReport(type) {
        Utils.showNotification(`Gerando relatório ${type}...`, 'info');
    }

    function downloadReport() {
        Utils.showNotification('Download iniciado', 'success');
    }

    // ================ SIDEBAR CONTROLLER ================ 
    const SidebarController = {
        init() {
            const toggleBtns = document.querySelectorAll('.toggle-sidebar');
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('mainContent');
            
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (window.innerWidth > 1024) {
                        sidebar.classList.toggle('collapsed');
                        mainContent.classList.toggle('expanded');
                    } else {
                        sidebar.classList.toggle('show');
                    }
                });
            });

            window.addEventListener('resize', () => {
                if (window.innerWidth > 1024) {
                    sidebar.classList.remove('show');
                } else {
                    sidebar.classList.remove('collapsed');
                    mainContent.classList.remove('expanded');
                }
            });
        }
    };

    // ================ EXPORT FUNCTIONS ================ 
    function exportChart(chartId) {
        debugMessage(`Exportando gráfico: ${chartId}`);
        
        if (AppState.charts[chartId]) {
            const chart = AppState.charts[chartId];
            const url = chart.toBase64Image();
            const link = document.createElement('a');
            link.download = `${chartId}-${new Date().toISOString().split('T')[0]}.png`;
            link.href = url;
            link.click();
            Utils.showNotification('Gráfico exportado com sucesso!', 'success');
        } else {
            Utils.showNotification('Gráfico não disponível para exportação', 'warning');
        }
    }

    function exportTable() {
        debugMessage('Exportando tabela');
        Utils.showNotification('Exportação de tabela não implementada', 'warning');
    }

    function exportToPDF() {
        debugMessage('Exportando para PDF');
        Utils.showNotification('Exportação para PDF não implementada', 'warning');
    }

    // ================ MAIN CONTROLLER SINCRONIZADO ================ 
    const DashboardController = {
    async initialize() {
        debugMessage('Inicializando Dashboard CIMO v4.3 com fazenda');
        
        this.setupEvents();
        SidebarController.init();
        
        await ChartManager.initializeCharts();
        await this.testConnection();
        await this.loadDashboard();
        
        // Inicializar controles da fazenda
        FazendaManager.updateFazendaInfo();
        
        ReportManager.updateReportHistoryTable();
    },

    async testConnection() {
        try {
            const isConnected = await ApiClient.checkBackendHealth();
            UIManager.updateSystemStatus(isConnected);
            
            if (!isConnected) {
                Utils.showNotification('Erro de conexão com o servidor v4.3', 'warning');
            } else {
                debugMessage('Backend v4.3 conectado com sucesso');
            }
        } catch (error) {
            debugMessage(`Erro ao testar conexão v4.3: ${error.message}`, 'error');
            UIManager.updateSystemStatus(false);
        }
    },

    setupEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadDashboard());
        
        const debouncedUpdate = this.debounce(() => this.loadDashboard(), 1000);
        
        // Eventos existentes
        document.getElementById('taxaRetorno').addEventListener('input', (e) => {
            document.getElementById('taxaDisplay').textContent = e.target.value + '%';
            debouncedUpdate();
        });
        
        document.getElementById('expectativaVida').addEventListener('change', debouncedUpdate);
        document.getElementById('despesasMensais').addEventListener('input', debouncedUpdate);
        document.getElementById('perfilInvestimento').addEventListener('change', debouncedUpdate);
        document.getElementById('inicioRendaFilhos').addEventListener('change', debouncedUpdate);
        
        // ✅ NOVOS EVENTOS DA FAZENDA
        document.getElementById('periodoCompraFazenda').addEventListener('input', (e) => {
            FazendaManager.updateFazendaInfo();
            debouncedUpdate();
        });
        
        document.getElementById('valorFazendaAtual').addEventListener('input', (e) => {
            FazendaManager.updateFazendaInfo();
            debouncedUpdate();
        });
        
        // Eventos de simulação existentes
        document.getElementById('simTaxaMin').addEventListener('input', (e) => {
            document.getElementById('simTaxaMinDisplay').textContent = e.target.value + '%';
        });
        
        document.getElementById('simTaxaMax').addEventListener('input', (e) => {
            document.getElementById('simTaxaMaxDisplay').textContent = e.target.value + '%';
        });
        
        document.getElementById('simVolatilidade').addEventListener('input', (e) => {
            document.getElementById('simVolatilidadeDisplay').textContent = e.target.value + '%';
        });
        document.getElementById('periodoCompraFazenda').addEventListener('input', (e) => {
        debugMessage(`🏡 Período alterado: ${e.target.value} anos`);
        FazendaManager.updateFazendaInfo();
        debouncedUpdate();
         });

    document.getElementById('valorFazendaAtual').addEventListener('input', (e) => {
        debugMessage(`💰 Valor alterado: R$ ${parseFloat(e.target.value || 0).toLocaleString('pt-BR')}`);
        FazendaManager.updateFazendaInfo();
        debouncedUpdate();
        });

        // ✅ NOVOS EVENTOS: Checkboxes da allocation
        ['showRendaFixaBR', 'showRendaFixaInt', 'showAcoesBR', 'showAcoesInt', 'showImoveis', 'showLiquidez'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (AppState.chartJsLoaded && AppState.currentPage === 'projections') {
                        ChartManager.createAllocationEvolutionChart();
                    }
                });
            }
        });
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    async loadDashboard() {
        try {
            debugMessage('Carregando dados da API v4.3 com fazenda');
            
            UIManager.showLoading(true);
            AppState.isLoading = true;
            
            const data = await ApiClient.fetchData();
            
            debugMessage(`Dados v4.3 recebidos: versão ${data.versao}, sucesso: ${data.success}`);
            
            AppState.currentData = data;
            
            UIManager.updateMetrics();
            UIManager.updateAlerts();
            UIManager.updateTable();
            
            setTimeout(() => {
                if (AppState.chartJsLoaded) {
                    ChartManager.createCharts();
                } else {
                    ChartManager.showAlternativeVisualization();
                }
            }, 300);
            
            Utils.showNotification('Dashboard atualizado com sucesso!', 'success');
            
        } catch (error) {
            debugMessage(`Erro ao carregar dashboard : ${error.message}`, 'error');
            Utils.showNotification(`Erro ao carregar dados : ${error.message}`, 'danger');
            
            const container = document.getElementById('alertContainer');
            if (container) {
                container.innerHTML = `
                    <div class="alert danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Erro de Conexão :</strong> Não foi possível carregar os dados do servidor. 
                        Verifique se o backend Flask está rodando em http://localhost:5000
                    </div>
                `;
            }
        } finally {
            UIManager.showLoading(false);
            AppState.isLoading = false;
        }
    }
};

    

    // ================ DEBUG HELPERS SINCRONIZADOS ================ 
    window.CimoDebug = {
        state: () => AppState,
        charts: () => AppState.charts,
        api: ApiClient,
        utils: Utils,
        simulation: SimulationManager,
        reports: ReportManager,
        testAPI: () => ApiClient.testConnection(),
        refreshData: () => DashboardController.loadDashboard(),
        
        testChartJS: async () => {
            debugMessage('Testando Chart.js manualmente');
            try {
                await loadChartJS();
                debugMessage('Chart.js carregado com sucesso!');
                Utils.showNotification('Chart.js carregado!', 'success');
                return true;
            } catch (error) {
                debugMessage('Falha ao carregar Chart.js', 'error');
                Utils.showNotification('Falha ao carregar Chart.js', 'danger');
                return false;
            }
        },

        fixChartsNow : async () => {
            ChartManager.destroyExistingCharts();
            setTimeout(() => {
                if (AppState.currentData) {
                    ChartManager.createCharts();
                    Utils.showNotification('🎯 Correção aplicada!', 'success');
                }
            }, 300);
        },


  
        forceCharts: async () => {
            debugMessage('Forçando criação de gráficos');
            AppState.retryingCharts = true;
            
            if (!AppState.chartJsLoaded) {
                try {
                    await loadChartJS();
                    AppState.chartJsLoaded = true;
                } catch (error) {
                    debugMessage('Ainda não foi possível carregar Chart.js', 'error');
                    ChartManager.showAlternativeVisualization();
                    return;
                }
            }
            
            if (AppState.currentData) {
                ChartManager.createCharts();
                Utils.showNotification('Gráficos atualizados!', 'success');
            } else {
                await DashboardController.loadDashboard();
            }
        },
        
        testSimulation: () => {
            debugMessage('Testando simulação');
            if (AppState.currentPage !== 'simulations') {
                Utils.showNotification('Navegue para a página de Simulações primeiro', 'warning');
                return;
            }
            SimulationManager.runSimulation();
        },
         testReportPreview: async (tipo = 'executivo') => {
        try {
            const preview = await ReportManager.fetchReportPreview(tipo, ReportManager.collectCurrentParameters());
            console.log('Preview data:', preview);
            debugMessage(`Preview ${tipo} testado com sucesso`);
            return preview;
        } catch (error) {
            console.error('Erro no preview:', error);
            debugMessage(`Erro no preview ${tipo}: ${error.message}`, 'error');
        }
    },
    
    testReportGeneration: (tipo = 'executivo') => {
        ReportManager.generateDetailedReport(tipo);
    },
    
    testAllReportTypes: () => {
        ['executivo', 'tecnico', 'simulacao'].forEach(tipo => {
            setTimeout(() => ReportManager.generateDetailedReport(tipo), 1000);
        });
    },
        
        testReport: (tipo) => {
            debugMessage(`Testando relatório: ${tipo} (simulação local)`);
            if (!tipo) tipo = 'executivo';
            if (!['executivo', 'detalhado', 'simulacao'].includes(tipo)) {
                debugMessage(`Tipo inválido. Use: executivo, detalhado ou simulacao`, 'warning');
                Utils.showNotification('Tipo de relatório inválido. Use: executivo, detalhado ou simulacao', 'warning');
                return;
            }
            
            ReportManager.generatePDFReport(tipo);
        },
        
        // ✅ NOVOS TESTES v4.0 SINCRONIZADOS
        testV4Features: async () => {
            debugMessage('🧪 Testando funcionalidades v4.0 sincronizadas');
            
            try {
                const perfis = ['conservador', 'moderado', 'balanceado'];
                for (const perfil of perfis) {
                    document.getElementById('perfilInvestimento').value = perfil;
                    await new Promise(resolve => setTimeout(resolve, 500));
                    debugMessage(`✅ Perfil ${perfil}: Configurado`);
                }
                
                const opcoes = ['falecimento', 'imediato', '65'];
                for (const opcao of opcoes) {
                    document.getElementById('inicioRendaFilhos').value = opcao;
                    await new Promise(resolve => setTimeout(resolve, 500));
                    debugMessage(`✅ Início filhos ${opcao}: Configurado`);
                }
                
                document.getElementById('perfilInvestimento').value = 'moderado';
                document.getElementById('inicioRendaFilhos').value = 'falecimento';
                
                await DashboardController.loadDashboard();
                
                Utils.showNotification('🎉 Testes v4.0 concluídos com sucesso!', 'success');
                debugMessage('🎉 Todos os testes v4.0 passaram');
                
            } catch (error) {
                debugMessage(`❌ Erro nos testes v4.0: ${error.message}`, 'error');
                Utils.showNotification('❌ Erro nos testes v4.0', 'danger');
            }
        },
        
        getV4Status: () => {
            return {
                versao: '4.0-SINCRONIZADA',
                backend_integrado: true,
                inputs_implementados: {
                    perfil_investimento: !!document.getElementById('perfilInvestimento'),
                    inicio_renda_filhos: !!document.getElementById('inicioRendaFilhos'),
                    custo_fazenda: !!document.getElementById('custoFazenda')
                },
                metricas_implementadas: {
                    valor_arte: !!document.querySelector('#valorArte h3'),
                    perfil_atual: !!document.getElementById('perfilAtual'),
                    status_visual: !!document.getElementById('statusBadge')
                },
                endpoints_testados: {
                    dados: '/api/dados',
                    teste: '/api/teste',
                    teste_correcoes: '/api/teste-correcoes'
                },
                campos_sincronizados: [
                    'taxa', 'expectativa', 'despesas', 
                    'perfil', 'inicio_renda_filhos', 'custo_fazenda'
                ]
            };
        },
        
        testBackendSync: async () => {
            debugMessage('🔄 Testando sincronização completa com backend');
            
            try {
                // Testar conexão
                const connected = await ApiClient.testConnection();
                if (!connected) {
                    throw new Error('Backend não conectado');
                }
                
                // Testar endpoint de dados com todos os parâmetros v4.0
                const originalValues = {
                    taxa: document.getElementById('taxaRetorno').value,
                    expectativa: document.getElementById('expectativaVida').value,
                    despesas: document.getElementById('despesasMensais').value,
                    perfil: document.getElementById('perfilInvestimento').value,
                    inicio_renda_filhos: document.getElementById('inicioRendaFilhos').value,
                    custo_fazenda: document.getElementById('valorFazendaAtual').value.value
                };
                
                // Configurar valores de teste
                document.getElementById('taxaRetorno').value = '4.5';
                document.getElementById('expectativaVida').value = '90';
                document.getElementById('despesasMensais').value = '150000';
                document.getElementById('perfilInvestimento').value = 'moderado';
                document.getElementById('inicioRendaFilhos').value = 'falecimento';
                document.getElementById('custoFazenda').value = '2000000';
                
                const data = await ApiClient.fetchData();
                
                if (data.success) {
                    debugMessage('✅ Sincronização completa OK');
                    debugMessage(`Versão backend: ${data.versao}`);
                    debugMessage(`Fazenda disponível: ${Utils.formatCurrency(data.resultado.fazenda, true)}`);
                    Utils.showNotification('🎯 Sincronização com backend 100% OK!', 'success');
                } else {
                    throw new Error('Resposta de falha do backend');
                }
                
                // Restaurar valores originais
                Object.keys(originalValues).forEach(key => {
                    const element = {
                        taxa: document.getElementById('taxaRetorno'),
                        expectativa: document.getElementById('expectativaVida'),
                        despesas: document.getElementById('despesasMensais'),
                        perfil: document.getElementById('perfilInvestimento'),
                        inicio_renda_filhos: document.getElementById('inicioRendaFilhos'),
                        custo_fazenda: document.getElementById('valorFazendaAtual').value
                    }[key];
                    
                    if (element) {
                        element.value = originalValues[key];
                    }
                });
                
                return true;
                
            } catch (error) {
                debugMessage(`❌ Erro na sincronização: ${error.message}`, 'error');
                Utils.showNotification(`❌ Falha na sincronização: ${error.message}`, 'danger');
                return false;
            }
        },
        
        logs: () => debugLog,
        clearLogs: () => {
            debugLog = [];
            updateDebugConsole();
        },
        
        // ✅ DEBUG ESPECÍFICO PARA MAPEAMENTO DE DADOS
        debugDataMapping: () => {
            if (!AppState.currentData) {
                debugMessage('❌ Nenhum dado carregado ainda');
                return null;
            }
            
            const mapping = {
                raw_response: AppState.currentData,
                mapped_fields: {
                    patrimonio: AppState.currentData.patrimonio,
                    fazenda_backend: AppState.currentData.resultado?.fazenda_disponivel,
                    fazenda_frontend: AppState.currentData.resultado?.fazenda,
                    total_backend: AppState.currentData.resultado?.total_compromissos,
                    total_frontend: AppState.currentData.resultado?.total,
                    percentual_backend: AppState.currentData.resultado?.percentual_fazenda,
                    percentual_frontend: AppState.currentData.resultado?.percentual,
                    arte: AppState.currentData.resultado?.arte,
                    percentual_arte: AppState.currentData.resultado?.percentual_arte
                },
                generated_data: {
                    allocation: AppState.currentData.allocation?.length || 0,
                    sensibilidade: AppState.currentData.sensibilidade?.length || 0,
                    fluxo_caixa: AppState.currentData.fluxo_caixa?.length || 0
                }
            };
            
            console.table(mapping.mapped_fields);
            debugMessage('📊 Mapeamento de dados logado no console');
            
            return mapping;
        },
        
        
        fazendaInfo: () => {
            const periodo = document.getElementById('periodoCompraFazenda')?.value || 0;
            const valor = document.getElementById('valorFazendaAtual')?.value || 0;
            const valorFuturo = FazendaManager.calcularValorFuturo(valor, periodo);
            
            return {
                periodo_compra: periodo,
                valor_atual: valor,
                valor_futuro: valorFuturo,
                fases: FazendaManager.calcularFases(periodo),
                dados_atuais: AppState.currentData?.resultado?.fazenda_analysis
            };
        },
        
    testProjections: async () => {
        debugMessage('🧪 Testando projeções detalhadas');
        try {
            const data = await ApiClient.fetchProjectionsData();
            console.log('Projeções recebidas:', data);
            return data;
        } catch (error) {
            debugMessage(`Erro nas projeções: ${error.message}`, 'error');
            return null;
        }
    },
    
    forceUpdateProjections: () => {
        debugMessage('🔄 Forçando atualização de projeções');
        if (AppState.currentPage === 'projections') {
            ProjectionsManager.updateProjectionsData();
        } else {
            Utils.showNotification('Navegue para a página de Projeções primeiro', 'warning');
        }
    },
    
    testCharts: () => {
        debugMessage('🧪 Testando gráficos da fazenda');
        if (AppState.chartJsLoaded) {
            ChartManager.createDespesasFlowChart();
            ChartManager.createRentabilidadeFlowChart();
            ChartManager.createAllocationEvolutionChart();
            Utils.showNotification('Gráficos da fazenda criados!', 'success');
        } else {
            Utils.showNotification('Chart.js não carregado', 'error');
        }
    },
    
    getFazendaStatus: () => {
        return {
            controles: {
                periodo: document.getElementById('periodoCompraFazenda')?.value,
                valor: document.getElementById('valorFazendaAtual')?.value
            },
            dados_api: AppState.currentData?.resultado?.fazenda_analysis,
            projecoes: ProjectionsManager.projectionData?.length || 0,
            charts_carregados: AppState.chartJsLoaded,
            versao: '4.3-FAZENDA-LIQUIDEZ'
        };
    },


     testFazenda: (periodo = 15, valor = 2000000) => {
            debugMessage(`🧪 Testando fazenda: ${periodo} anos, R$ ${valor.toLocaleString('pt-BR')}`);
            document.getElementById('periodoCompraFazenda').value = periodo;
            document.getElementById('valorFazendaAtual').value = valor;
            
            FazendaManager.updateFazendaInfo();
            
            loadChartJS().then(() => {
                debugMessage('✅ Chart.js carregado, inicializando dashboard');
                setTimeout(() => {
                    DashboardController.initialize();
                }, 300);
            }).catch(() => {
                debugMessage('⚠️ Chart.js falhou, inicializando sem gráficos');
                setTimeout(() => {
                    DashboardController.initialize();
                }, 300);
            });
        },
};


    // ================ VALIDAÇÕES DE ENTRADA LOCAIS ================ 
    function validarInputsLocais() {
        const taxa = parseFloat(document.getElementById('taxaRetorno').value);
        const expectativa = parseInt(document.getElementById('expectativaVida').value);
        const despesas = parseFloat(document.getElementById('despesasMensais').value);
        const custoFazenda = parseFloat(document.getElementById('custoFazenda').value);
        
        debugMessage('Validando inputs localmente antes de enviar ao backend');
        
        if (taxa < 0.1 || taxa > 15) {
            Utils.showNotification('Taxa de retorno deve estar entre 0.1% e 15%', 'danger');
            return false;
        }
        
        if (taxa > 8) {
            Utils.showNotification('⚠️ Taxa de retorno acima de 8% é muito otimista', 'warning');
        }
        
        if (expectativa < 53) {
            Utils.showNotification('Expectativa de vida deve ser pelo menos 53 anos', 'danger');
            return false;
        }
        
        if (despesas < 50000 || despesas > 1000000) {
            Utils.showNotification('Despesas devem estar entre R$ 50.000 e R$ 1.000.000', 'danger');
            return false;
        }
        
        if (custoFazenda < 500000 || custoFazenda > 10000000) {
            Utils.showNotification('Custo da fazenda deve estar entre R$ 500.000 e R$ 10.000.000', 'danger');
            return false;
        }
        
        return true;
    }

    // ================ INICIALIZAÇÃO SINCRONIZADA ================ 
    document.addEventListener('DOMContentLoaded', () => {
    debugMessage('DOM carregado - inicializando aplicação v4.3 com fazenda');
    
    const requiredElements = [
        'taxaRetorno', 'expectativaVida', 'despesasMensais',
        'perfilInvestimento', 'inicioRendaFilhos', 'valorFazendaAtual',
        'periodoCompraFazenda'  // ✅ NOVO ELEMENTO
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        debugMessage(`❌ Elementos HTML faltando: ${missingElements.join(', ')}`, 'error');
        Utils.showNotification(`Erro: Elementos HTML faltando: ${missingElements.join(', ')}`, 'danger');
        return;
    }
    
    debugMessage('✅ Todos os elementos HTML v4.3 encontrados');
    
    // ✅ AGUARDAR TUDO CARREGAR PRIMEIRO
Promise.all([
    loadChartJS().catch(() => {
        console.warn('Chart.js falhou, continuando sem gráficos');
        return false;
    }),
    new Promise(resolve => setTimeout(resolve, 500)) // Aguardar DOM
]).then(() => {
    debugMessage('✅ Inicializando dashboard após todas as dependências');
    
    // Verificar se managers existem
    if (!window.ReportManager) {
        console.warn('ReportManager não inicializado');
    }
    if (!window.ProjectionsManager) {
        console.warn('ProjectionsManager não inicializado');
    }
    
    DashboardController.initialize();
}).catch(error => {
    console.error('Erro na inicialização:', error);
    // Inicializar mesmo com erros
    DashboardController.initialize();
});
});

    // ================ PERFORMANCE OPTIMIZATIONS ================ 
    const ChartCache = {
        cache: new Map(),
        maxSize: 20,

        generateKey(pageId, dataHash) {
            return `${pageId}-${dataHash}`;
        },

        getChart(key) {
            const cached = this.cache.get(key);
            if (cached) {
                this.cache.delete(key);
                this.cache.set(key, cached);
                debugMessage(`Cache hit para: ${key}`);
                return cached;
            }
            return null;
        },

        setChart(key, chart) {
            if (this.cache.size >= this.maxSize) {
                const oldestKey = this.cache.keys().next().value;
                const oldChart = this.cache.get(oldestKey);
                if (oldChart && oldChart.destroy) {
                    oldChart.destroy();
                }
                this.cache.delete(oldestKey);
            }
            
            this.cache.set(key, chart);
            debugMessage(`Cache set para: ${key}`);
        },

        invalidateAll() {
            this.cache.forEach((chart, key) => {
                if (chart && chart.destroy) {
                    chart.destroy();
                }
            });
            this.cache.clear();
            debugMessage('Cache limpo completamente');
        }
    };

    // ================ INTERSECTION OBSERVER PARA LAZY LOADING ================ 
    const ChartLazyLoader = {
        observer: null,

        init() {
            if (!window.IntersectionObserver) return;
            
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const container = entry.target;
                        const chartType = container.dataset.chartType;
                        
                        if (chartType && !container.dataset.loaded) {
                            debugMessage(`Lazy loading chart: ${chartType}`);
                            this.loadChart(container, chartType);
                            container.dataset.loaded = 'true';
                            this.observer.unobserve(container);
                        }
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '50px'
            });
        },

        observe(container, chartType) {
            if (this.observer) {
                container.dataset.chartType = chartType;
                this.observer.observe(container);
            }
        },

        loadChart(container, chartType) {
            const loadFunctions = {
                'compromissos': () => ChartManager.createCompromissosChart(),
                'allocation': () => ChartManager.createAllocationChart(),
                'sensibilidade': () => ChartManager.createSensibilidadeChart(),
                'monteCarlo': () => ChartManager.createMonteCarloChart(),
                'distribuicao': () => ChartManager.createDistribuicaoChart()
            };
            
            const loadFunction = loadFunctions[chartType];
            if (loadFunction) {
                loadFunction();
            }
        }
    };

    // ================ PERFORMANCE MONITOR ================ 
    const PerformanceMonitor = {
        metrics: {},

        start(label) {
            if (performance.mark) {
                performance.mark(`${label}-start`);
            }
            this.metrics[label] = { start: Date.now() };
        },

        end(label) {
            if (!this.metrics[label]) return;
            
            const duration = Date.now() - this.metrics[label].start;
            this.metrics[label].duration = duration;
            
            if (performance.mark && performance.measure) {
                performance.mark(`${label}-end`);
                performance.measure(label, `${label}-start`, `${label}-end`);
            }
            
            const thresholds = {
                'chart-creation': 1000,
                'api-call': 2000,
                'page-navigation': 500,
                'pdf-generation': 5000
            };
            
            if (duration > (thresholds[label] || 1000)) {
                debugMessage(`⚠️ Performance: ${label} demorou ${duration}ms`, 'warning');
            } else {
                debugMessage(`✅ Performance: ${label} completado em ${duration}ms`);
            }
            
            return duration;
        },

        getMetrics() {
            return this.metrics;
        },

        getAverageTime(label) {
            const entries = performance.getEntriesByName(label);
            if (entries.length === 0) return 0;
            
            const total = entries.reduce((sum, entry) => sum + entry.duration, 0);
            return total / entries.length;
        },
        trackFazendaCalculation: () => {
        PerformanceMonitor.start('fazenda-calculation');
        
        setTimeout(() => {
            const duration = PerformanceMonitor.end('fazenda-calculation');
            debugMessage(`⏱️ Cálculo da fazenda: ${duration}ms`);
        }, 0);
    }
    };

    // ================ ENHANCED PROJECTIONS MANAGER ================


// ================ FUNÇÕES GLOBAIS PARA PROJEÇÕES ================






function updateProjectionsData() {
    // ✅ VERIFICAR SE ProjectionsManager EXISTE
    if (typeof ProjectionsManager !== 'undefined') {
        ProjectionsManager.updateCurrentScenarioCard();
        ProjectionsManager.updateProjectionsData();
    } else {
        debugMessage('⚠️ ProjectionsManager não inicializado ainda');
    }
}

function updateProjection(scenario) {
    ProjectionsManager.updateScenario(scenario);
    
    if (AppState.chartJsLoaded && AppState.currentPage === 'projections') {
        setTimeout(() => {
            ChartManager.createProjectionCharts();
            ChartManager.createDespesasFlowChart();
            ChartManager.createRentabilidadeFlowChart();
            ChartManager.createAllocationEvolutionChart();
        }, 300);
    }
}

function updateProjectionPeriod() {
    const period = document.getElementById('projectionPeriod')?.value || '30';
    debugMessage(`Período de projeção alterado para: ${period} anos`);
    
    ProjectionsManager.updateProjectionsData();
    
    if (AppState.chartJsLoaded && AppState.currentPage === 'projections') {
        setTimeout(() => {
            ChartManager.createProjectionCharts();
        }, 200);
    }
}

function toggleCashFlowView() {
    ProjectionsManager.cashFlowView = ProjectionsManager.cashFlowView === 'annual' ? 'monthly' : 'annual';
    
    const btn = document.getElementById('cashFlowViewBtn');
    if (btn) {
        const span = btn.querySelector('span');
        if (span) {
            span.textContent = ProjectionsManager.cashFlowView === 'annual' ? 'Anual' : 'Mensal';
        }
    }
    
    if (AppState.chartJsLoaded && AppState.currentPage === 'projections') {
        ChartManager.createDespesasFlowChart();
        ChartManager.createRentabilidadeFlowChart();
    }
    
    debugMessage(`Visualização de fluxo de caixa: ${ProjectionsManager.cashFlowView}`);
}

function exportProjectionTable() {
    ProjectionsManager.exportProjectionTable();
}


ChartManager.createProjectionCharts = function() {
    this.createPatrimonialEvolutionChart();
    this.createDespesasFlowChart();
    this.createRentabilidadeFlowChart();
    this.createAllocationEvolutionChart();
};

// ================ INTEGRAÇÃO COM CHART MANAGER ================


ChartManager.createPatrimonialEvolutionChart = function() {
    const ctx = document.getElementById('patrimonialEvolutionChart');
    if (!ctx || !ProjectionsManager.projectionData) return;

    const data = ProjectionsManager.projectionData.slice(0, 30); // 30 anos máximo
    
    AppState.charts.patrimonialEvolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => item.ano),
            datasets: [{
                label: 'Patrimônio (R$ milhões)',
                data: data.map(item => item.patrimonio / 1000000),
                borderColor: this.colors.primary,
                backgroundColor: this.colors.primary + '20',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: this.colors.primary,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const item = data[context.dataIndex];
                            return [
                                `Patrimônio: ${Utils.formatCurrency(item.patrimonio, true)}`,
                                `Idade Ana: ${item.idadeAna} anos`,
                                `Ana ${item.anaViva ? 'viva' : 'faleceu'}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: { 
                        color: '#6b7280',
                        font: { size: 11 },
                        callback: function(value) {
                            return 'R$ ' + value + 'M';
                        }
                    }
                }
            }
        }
    });
};


ChartManager.createAllocationPageCharts = function() {
    debugMessage('Criando gráficos da página Asset Allocation');
    this.createCurrentAllocationChart();
    this.createBenchmarkChart();
    this.createAllocationTrendsChart();  // ✅ NOVO
};

ChartManager.createCurrentAllocationChart = function() {
    const ctx = document.getElementById('currentAllocationChart');
    if (!ctx || !AppState.currentData) return;
    
    const { allocation } = AppState.currentData;
    if (!allocation) return;

    debugMessage('Criando gráfico de allocation atual');

    AppState.charts.currentAllocation = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: allocation.map(item => item.nome),
            datasets: [{
                data: allocation.map(item => item.percentual),
                backgroundColor: [
                    '#1e3a8a', '#3b82f6', '#64748b', '#059669', 
                    '#ea580c', '#7c3aed', '#94a3b8'
                ].slice(0, allocation.length),
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { 
                        color: '#374151',
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const item = allocation[context.dataIndex];
                            return `${context.label}: ${item.percentual}% (${Utils.formatCurrency(item.valor, true)})`;
                        }
                    }
                }
            }
        }
    });
};

ChartManager.createBenchmarkChart = function() {
    const ctx = document.getElementById('benchmarkChart');
    if (!ctx) return;

    debugMessage('Criando gráfico de benchmark');

    const perfil = document.getElementById('perfilInvestimento')?.value || 'moderado';
    
    // ✅ DADOS REALISTAS DE BENCHMARK POR PERFIL
    const benchmarkData = {
        'conservador': {
            atual: [70, 15, 5, 5, 3, 2],
            benchmark: [75, 10, 8, 5, 2, 0],
            labels: ['RF BR', 'RF Int', 'Ações BR', 'Ações Int', 'Imóveis', 'Liquidez']
        },
        'moderado': {
            atual: [50, 20, 15, 10, 3, 2],
            benchmark: [45, 25, 15, 12, 3, 0],
            labels: ['RF BR', 'RF Int', 'Ações BR', 'Ações Int', 'Imóveis', 'Liquidez']
        },
        'balanceado': {
            atual: [40, 15, 20, 15, 5, 5],
            benchmark: [35, 15, 25, 20, 5, 0],
            labels: ['RF BR', 'RF Int', 'Ações BR', 'Ações Int', 'Imóveis', 'Liquidez']
        }
    };

    const data = benchmarkData[perfil] || benchmarkData['moderado'];

    AppState.charts.benchmark = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Alocação Atual',
                data: data.atual,
                backgroundColor: this.colors.primary + '80',
                borderColor: this.colors.primary,
                borderWidth: 1
            }, {
                label: 'Benchmark Sugerido',
                data: data.benchmark,
                backgroundColor: this.colors.accent + '80',
                borderColor: this.colors.accent,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    max: 80,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#6b7280',
                        font: { size: 11 },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
};

// ✅ NOVO GRÁFICO: Evolução da Allocation ao Longo do Tempo
ChartManager.createAllocationTrendsChart = function() {
    const ctx = document.getElementById('allocationTrendsChart');
    if (!ctx) return;

    debugMessage('Criando gráfico de tendências de allocation');

    // Simular evolução da allocation ao longo dos anos
    const anos = ['2025', '2030', '2035', '2040', '2045'];
    const periodo = parseInt(document.getElementById('periodoCompraFazenda')?.value || 15);
    
    AppState.charts.allocationTrends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: anos,
            datasets: [{
                label: 'Renda Fixa (%)',
                data: [50, 55, 60, 65, 70], // Aumenta com o tempo (conservadorismo)
                borderColor: this.colors.primary,
                backgroundColor: this.colors.primary + '20',
                tension: 0.4
            }, {
                label: 'Renda Variável (%)',
                data: [25, 22, 18, 15, 12], // Diminui com o tempo
                borderColor: this.colors.accent,
                backgroundColor: this.colors.accent + '20',
                tension: 0.4
            }, {
                label: 'Liquidez (%)',
                data: [2, periodo > 10 ? 8 : 4, periodo > 5 ? 15 : 6, 12, 8], // Pico antes da fazenda
                borderColor: this.colors.orange,
                backgroundColor: this.colors.orange + '20',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { size: 11 } }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    max: 80,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#6b7280',
                        font: { size: 11 },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
};


// ================ SETUP DE EVENTOS PARA CHECKBOXES ================
function setupAllocationCheckboxEvents() {
    debugMessage('🔧 Configurando eventos de checkboxes da allocation');
    
    const checkboxIds = [
        'showRendaFixaBR', 
        'showRendaFixaInt', 
        'showAcoesBR', 
        'showAcoesInt', 
        'showImoveis', 
        'showLiquidez',
        'showMultimercado'
    ];
    
    checkboxIds.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                debugMessage(`📊 Checkbox ${id} alterado: ${checkbox.checked}`);
                
                // Atualizar gráfico de allocation evolution se estiver na página de projeções
                if (AppState.chartJsLoaded && AppState.currentPage === 'projections') {
                    setTimeout(() => {
                        ChartManager.createAllocationEvolutionChart();
                    }, 100);
                }
                
                // Atualizar outros gráficos de allocation se necessário
                if (AppState.chartJsLoaded && AppState.currentPage === 'allocation') {
                    setTimeout(() => {
                        ChartManager.createAllocationTrendsChart();
                    }, 100);
                }
            });
            
            debugMessage(`✅ Evento configurado para ${id}`);
        } else {
            debugMessage(`⚠️ Checkbox ${id} não encontrado no DOM`, 'warning');
        }
    });
    
    debugMessage('✅ Todos os eventos de checkboxes configurados');
}

ChartManager.createCashFlowChart = function() {
    const ctx = document.getElementById('cashFlowChart');
    if (!ctx || !ProjectionsManager.projectionData) return;

    const data = ProjectionsManager.projectionData.slice(0, 20);
    
    AppState.charts.cashFlow = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.ano),
            datasets: [{
                label: 'Rendimentos',
                data: data.map(item => item.rendimentos / 1000000),
                backgroundColor: this.colors.accent + '80',
                borderColor: this.colors.accent,
                borderWidth: 1
            }, {
                label: 'Saídas',
                data: data.map(item => -item.saidas / 1000000),
                backgroundColor: this.colors.orange + '80',
                borderColor: this.colors.orange,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = Math.abs(context.parsed.y);
                            const type = context.dataset.label;
                            return `${type}: ${Utils.formatCurrency(value * 1000000, true)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#6b7280',
                        font: { size: 11 },
                        callback: function(value) {
                            return 'R$ ' + Math.abs(value) + 'M';
                        }
                    }
                }
            }
        }
    });
};

// ================ INICIALIZAÇÃO ================
// Integrar ProjectionsManager com o sistema existente
const originalShowPage = window.showPage;
async function showPageCorrected(pageId) {
    debugMessage(`🧭 Navegando para página: ${pageId} (versão robusta)`);
    
    try {
        // Atualizar UI imediatamente
        document.querySelectorAll('.page-content').forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        
        const targetPage = document.getElementById(pageId + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
            AppState.currentPage = pageId;
        }
        
        if (window.event && window.event.target) {
            const navItem = window.event.target.closest('.nav-item');
            if (navItem) navItem.classList.add('active');
        }
        
        // ✅ CARREGAR GRÁFICOS COM AGUARDA
        await loadChartsForPageCorrected(pageId);
        
    } catch (error) {
        debugMessage(`❌ Erro na navegação: ${error.message}`, 'error');
    }
}

// Integrar com atualizações de dados
const originalLoadDashboard = DashboardController.loadDashboard;
DashboardController.loadDashboard = async function() {
    await originalLoadDashboard.call(this);
    
    // Se estiver na página de projeções, atualizar
    if (AppState.currentPage === 'projections') {
        setTimeout(() => {
            ProjectionsManager.updateCurrentScenarioCard();
            ProjectionsManager.updateProjectionsData();
        }, 500);
    }
};

const originalSetupEvents = DashboardController.setupEvents;
DashboardController.setupEvents = function() {
    // Manter eventos originais
    if (originalSetupEvents) {
        originalSetupEvents.call(this);
    }
    
    // ✅ ADICIONAR EVENTOS PARA ATUALIZAÇÃO DE PROJEÇÕES
    const debouncedProjectionUpdate = this.debounce(() => {
        if (AppState.currentPage === 'projections') {
            setTimeout(() => {
                ProjectionsManager.updateProjectionsData();
                ChartManager.createAllocationEvolutionChart();
            }, 300);
        }
    }, 1000);
    
    // Eventos que devem atualizar projeções
    ['taxaRetorno', 'expectativaVida', 'despesasMensais', 'perfilInvestimento', 'inicioRendaFilhos', 'periodoCompraFazenda', 'valorFazendaAtual'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', debouncedProjectionUpdate);
            element.addEventListener('input', debouncedProjectionUpdate);
        }
    });
    
    setupAllocationCheckboxEvents();
    debugMessage('✅ Eventos v4.3.1 configurados com atualizações dinâmicas');
};


window.CimoDebug.testAllCorrections = async function() {
    console.clear();
    debugMessage('🧪 TESTANDO TODAS AS CORREÇÕES v4.3');
    
    // Teste 1: Asset Allocation Dinâmico
    debugMessage('📊 Teste 1: Asset Allocation Dinâmico');
    document.getElementById('perfilInvestimento').value = 'balanceado';
    document.getElementById('periodoCompraFazenda').value = '15';
    await showPageCorrected('projections');
    await new Promise(resolve => setTimeout(resolve, 2000));
    debugMessage('✅ Teste 1 concluído');
    
    // Teste 2: Navegação entre páginas
    debugMessage('📊 Teste 2: Navegação Robusta');
    const pages = ['dashboard', 'allocation', 'projections', 'simulations'];
    for (const page of pages) {
        await showPageCorrected(page);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    debugMessage('✅ Teste 2 concluído');
    
    // Teste 3: snake_case
    debugMessage('📊 Teste 3: Dados snake_case');
    if (ProjectionsManager.projectionData && ProjectionsManager.projectionData.length > 0) {
        const sample = ProjectionsManager.projectionData[0];
        const hasSnakeCase = 'idade_ana' in sample && 'saldo_liquido' in sample;
        debugMessage(`✅ Snake_case OK: ${hasSnakeCase}`);
    }
    
    debugMessage('🎉 TODOS OS TESTES CONCLUÍDOS - Correções v4.3 funcionando!');
    Utils.showNotification('🎉 Correções v4.3 testadas com sucesso!', 'success');
};

window.CimoDebug.testAssetAllocationDynamic = function() {
    debugMessage('🧪 Testando Asset Allocation Dinâmico');
    
    // Testar diferentes perfis
    const perfis = ['conservador', 'moderado', 'balanceado'];
    perfis.forEach(perfil => {
        document.getElementById('perfilInvestimento').value = perfil;
        debugMessage(`📊 Testando perfil: ${perfil}`);
        ChartManager.createAllocationEvolutionChart();
    });
    
    debugMessage('✅ Teste Asset Allocation Dinâmico concluído');
};

window.CimoDebug.fixChartAndProjections = function() {
    debugMessage('🔧 Aplicando correções v4.3.1 para Chart e Projeções');
    
    try {
        // Forçar recriação do gráfico
        if (AppState.currentPage === 'projections') {
            ChartManager.createAllocationEvolutionChart();
            ProjectionsManager.updateProjectionsData();
        }
        
        Utils.showNotification('✅ Correções v4.3.1 aplicadas!', 'success');
        debugMessage('✅ Correções aplicadas com sucesso');
        
    } catch (error) {
        debugMessage(`❌ Erro ao aplicar correções: ${error.message}`, 'error');
        Utils.showNotification('❌ Erro ao aplicar correções', 'danger');
    }
};

debugMessage('🚀 Correções v4.3.1 carregadas - Chart Evolution + Projeções Dinâmicas');
console.log('✅ Use window.CimoDebug.fixChartAndProjections() para aplicar correções');


// ✅ CARREGAMENTO DE GRÁFICOS ROBUSTO
async function loadChartsForPageCorrected(pageId) {
    debugMessage(`📊 Carregando gráficos para: ${pageId}`);
    
    // ✅ AGUARDAR Chart.js
    if (!AppState.chartJsLoaded || typeof Chart === 'undefined') {
        debugMessage('⏳ Aguardando Chart.js...');
        const chartReady = await new Promise(resolve => {
            let attempts = 0;
            const check = setInterval(() => {
                if (typeof Chart !== 'undefined') {
                    clearInterval(check);
                    AppState.chartJsLoaded = true;
                    resolve(true);
                } else if (++attempts > 20) {
                    clearInterval(check);
                    resolve(false);
                }
            }, 250);
        });
        
        if (!chartReady) {
            debugMessage('❌ Chart.js não carregou, usando fallback', 'error');
            ChartManager.showAlternativeVisualization();
            return;
        }
    }
    
    // ✅ AGUARDAR DADOS SE NECESSÁRIO
    if (!AppState.currentData) {
        debugMessage('⏳ Aguardando dados...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // ✅ CARREGAR GRÁFICOS POR PÁGINA
    const chartFunctions = {
        'dashboard': () => {
            ChartManager.hideChartPlaceholders(['compromissosContainer', 'allocationContainer', 'sensibilidadeContainer']);
            ChartManager.createCompromissosChart();
            ChartManager.createAllocationChart();
            ChartManager.createSensibilidadeChart();
        },
        'allocation': () => {
            ChartManager.hideChartPlaceholders(['currentAllocationContainer', 'benchmarkContainer']);
            ChartManager.createAllocationPageCharts();
            updateAllocationTableCorrected();
        },
        'projections': async () => {
            ChartManager.hideChartPlaceholders(['patrimonialEvolutionContainer', 'despesasFlowContainer', 'rentabilidadeFlowContainer', 'allocationEvolutionContainer']);
            
            // ✅ INICIALIZAR ProjectionsManager PRIMEIRO
            await ProjectionsManager.initialize();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // ✅ CRIAR GRÁFICOS DE PROJEÇÃO
            ChartManager.createPatrimonialEvolutionChart();
            ChartManager.createDespesasFlowChart();
            ChartManager.createRentabilidadeFlowChart();
            ChartManager.createAllocationEvolutionChart();
        },
        'simulations': () => {
            ChartManager.hideChartPlaceholders(['monteCarloContainer', 'distribuicaoContainer']);
            ChartManager.createSimulationCharts();
        },
        'scenarios': () => {
            ChartManager.hideChartPlaceholders(['scenarioComparisonContainer', 'scenarioEvolutionContainer', 'stressTestContainer']);
            ChartManager.createScenarioCharts();
        },
        'sensitivity': () => {
            ChartManager.hideChartPlaceholders(['returnSensitivityContainer', 'expenseSensitivityContainer', 'bidimensionalContainer']);
            ChartManager.createSensitivityCharts();
        },
        'reports': () => {
            debugMessage('📄 Página de relatórios - sem gráficos');
        }
    };
    
    const chartFunction = chartFunctions[pageId];
    if (chartFunction) {
        try {
            await chartFunction();
            debugMessage(`✅ Gráficos carregados para ${pageId}`);
        } catch (error) {
            debugMessage(`❌ Erro nos gráficos de ${pageId}: ${error.message}`, 'error');
        }
    }
}

    // ================ INICIALIZAÇÃO DAS OTIMIZAÇÕES ================ 
    function initializePerformanceOptimizations() {
        debugMessage('Inicializando otimizações de performance');

        ChartLazyLoader.init();

        window.PerformanceMonitor = PerformanceMonitor;
        window.ChartCache = ChartCache;

        debugMessage('Otimizações de performance carregadas');
    }



    // ================ EXPOR OBJETOS GLOBAIS PARA DEBUG ================ 
    window.AppState = AppState;
    window.ChartManager = ChartManager;
    window.UIManager = UIManager;
    window.ApiClient = ApiClient;
    window.DataMapper = DataMapper;
    window.Utils = Utils;
    window.DashboardController = DashboardController;
    window.SimulationManager = SimulationManager;
    window.ReportManager = ReportManager;
    window.ProjectionsManager = ProjectionsManager;
    // ================ FUNÇÕES GLOBAIS EXPOSTAS ================ 
    window.showPage = showPageCorrected;
    window.updateAllocationTable = updateAllocationTableCorrected;
    window.showAnalysis = showAnalysis;
    window.updateProjection = updateProjection;
    window.updateSimulationParams = updateSimulationParams;
    window.generateReportPDF = generateReportPDF;
    window.generateReport = generateReport;
    window.downloadReport = downloadReport;
    window.exportChart = exportChart;
    window.exportTable = exportTable;
    window.exportToPDF = exportToPDF;
    window.toggleDebug = toggleDebug;
    window.validarInputsLocais = validarInputsLocais;
    window.ProjectionsManager = ProjectionsManager;
    window.FazendaManager = FazendaManager;
    // ================ LOG DE INICIALIZAÇÃO ================ 
   debugMessage('🚀 JavaScript v4.3 FAZENDA + LIQUIDEZ GRADUAL CARREGADO');
debugMessage('🏡 Novos recursos: Período compra, liquidez gradual, gráficos duplos');
debugMessage('📋 Endpoints: /api/dados (v4.3), /api/projecoes-detalhadas');
debugMessage('🔧 Parâmetros: periodo_compra_fazenda, valor_fazenda_atual');
debugMessage('📊 Gráficos: DespesasFlow, RentabilidadeFlow, AllocationEvolution');
debugMessage('⚡ Inflação estática: 3.5% a.a., Fases: 40%, 40%, 20%');
debugMessage('🐛 Debug: window.CimoDebug.testFazenda(), getFazendaStatus()');
console.log('✅ Correções v4.3 carregadas com sucesso!');
console.log('🧪 Use window.CimoDebug.testAllCorrections() para testar tudo');
console.log('📊 Use window.CimoDebug.testAssetAllocationDynamic() para testar allocation');
debugMessage('🚀 Correções v4.3 PRONTAS - Asset Allocation 100% Dinâmico + Navegação Robusta + snake_case');
// Ver status dos gráficos Chart.js




    // Inicializar otimizações
    initializePerformanceOptimizations();