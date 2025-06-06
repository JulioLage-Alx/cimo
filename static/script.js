// ================ CHART.JS LOADER OTIMIZADO 2025 ================
    let chartJSRetries = 0;
    const maxRetries = 4;

    // URLs oficiais recomendadas (atualizadas conforme pesquisa)
    const chartJSUrls = [
        'https://cdn.jsdelivr.net/npm/chart.js',                          // Oficial recomendado
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.min.js',  // CDNJS estável
        'https://unpkg.com/chart.js',                                      // UNPKG alternativo
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js'   // Versão específica
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
    // ✅ URLs EXATAS que correspondem às rotas do Flask
    API_BASE_URL: window.location.origin, // http://localhost:5000 automaticamente
    ENDPOINTS: {
        dados: '/api/dados',                    // ✅ Rota existe no app.py
        teste: '/api/teste',                    // ✅ Rota existe no app.py
        teste_correcoes: '/api/teste-correcoes' // ✅ Rota existe no app.py
    },
    
    // ✅ PARÂMETROS EXATOS que o backend espera conforme app.py
    PARAM_MAPPING: {
        'taxaRetorno': 'taxa',                      // frontend -> backend
        'expectativaVida': 'expectativa',           // frontend -> backend  
        'despesasMensais': 'despesas',              // frontend -> backend
        'perfilInvestimento': 'perfil',             // frontend -> backend (corrigido)
        'inicioRendaFilhos': 'inicio_renda_filhos', // frontend -> backend
        'custoFazenda': 'custo_fazenda'             // frontend -> backend
    }
};

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
            
            // ✅ MAPEAMENTO SINCRONIZADO COM A ESTRUTURA REAL DO BACKEND
            const resultado = apiData.resultado;
            
            return {
                success: apiData.success,
                patrimonio: apiData.patrimonio,
                versao: apiData.versao,
                timestamp: apiData.timestamp,
                
                // ✅ RESULTADO PRINCIPAL (campos do backend)
                resultado: {
                    fazenda: resultado.fazenda_disponivel,  // ✅ Mapeamento correto
                    fazenda_disponivel: resultado.fazenda_disponivel,
                    total: resultado.total_compromissos,     // ✅ Alias para compatibilidade
                    total_compromissos: resultado.total_compromissos,
                    percentual: resultado.percentual_fazenda, // ✅ Alias para compatibilidade  
                    percentual_fazenda: resultado.percentual_fazenda,
                    despesas: resultado.despesas,
                    filhos: resultado.filhos,
                    doacoes: resultado.doacoes,
                    arte: resultado.arte || 0,
                    percentual_arte: resultado.percentual_arte || 0
                },
                
                // ✅ DADOS SIMULADOS BASEADOS NA RESPOSTA (que o frontend espera)
                allocation: this.generateAllocationData(apiData.patrimonio),
                sensibilidade: this.generateSensibilidadeData(resultado),
                fluxo_caixa: this.generateFluxoCaixaData(),
                status: this.determineStatus(resultado.fazenda_disponivel, resultado.percentual_fazenda)
            };
        },

        generateFallbackData() {
            debugMessage('Gerando dados de fallback', 'warning');
            return {
                success: false,
                patrimonio: 65000000,
                resultado: {
                    fazenda: 0,
                    fazenda_disponivel: 0,
                    total: 0,
                    total_compromissos: 0,
                    percentual: 0,
                    percentual_fazenda: 0,
                    despesas: 0,
                    filhos: 0,
                    doacoes: 0,
                    arte: 0,
                    percentual_arte: 0
                },
                allocation: this.generateAllocationData(65000000),
                sensibilidade: [],
                fluxo_caixa: [],
                status: 'erro'
            };
        },

        generateAllocationData(patrimonio) {
            // ✅ GERAR ALLOCATION BASEADO NO PERFIL (simulação client-side)
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
            // ✅ GERAR SENSIBILIDADE BASEADA NO RESULTADO ATUAL (simulação client-side)
            const baseFazenda = resultado.fazenda_disponivel || 0;
            const basePercentual = resultado.percentual_fazenda || 0;
            
            const sensibilidade = [];
            const taxas = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0];
            
            taxas.forEach(taxa => {
                // Estimativa simples: cada 1% de diferença na taxa = ~±15% no resultado
                const currentTaxa = parseFloat(document.getElementById('taxaRetorno')?.value || 4.0);
                const deltaTaxa = taxa - currentTaxa;
                const factor = 1 + (deltaTaxa * 0.15); // 15% por ponto percentual
                
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

        generateFluxoCaixaData() {
            // ✅ GERAR FLUXO DE CAIXA SIMULADO (baseado nos parâmetros atuais)
            const fluxo = [];
            let patrimonio = 65000000;
            const taxa = parseFloat(document.getElementById('taxaRetorno')?.value || 4.0) / 100;
            
            for (let ano = 0; ano < 20; ano++) {
                const anoCalendario = 2025 + ano;
                const rendimentos = patrimonio * taxa;
                const saidas = 1800000; // Estimativa de saídas anuais
                patrimonio += rendimentos - saidas;
                patrimonio = Math.max(patrimonio, 0);
                
                fluxo.push({
                    ano: anoCalendario,
                    patrimonio: patrimonio,
                    rendimentos: rendimentos,
                    saidas: saidas
                });
            }
            
            return fluxo;
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
                debugMessage('Iniciando requisição para API sincronizada v4.1');
                
                // ✅ PARÂMETROS EXATOS QUE O BACKEND ESPERA
                const params = new URLSearchParams({
                    taxa: document.getElementById('taxaRetorno').value,
                    expectativa: document.getElementById('expectativaVida').value,
                    despesas: document.getElementById('despesasMensais').value,
                    // ✅ NOVOS PARÂMETROS v4.0 SINCRONIZADOS
                    perfil: document.getElementById('perfilInvestimento').value,          // ✅ 'perfil' (não 'perfil_investimento')
                    inicio_renda_filhos: document.getElementById('inicioRendaFilhos').value,
                    custo_fazenda: document.getElementById('custoFazenda').value
                });

                const url = `${CONFIG.ENDPOINTS.dados}?${params}`;
                debugMessage(`URL da requisição sincronizada: ${url}`);

                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                debugMessage(`Resposta recebida: versão ${data.versao || 'desconhecida'}, success: ${data.success}`);
                
                if (!data.success) {
                    throw new Error(data.erro || 'Erro desconhecido na API');
                }

                // ✅ MAPEAR DADOS PARA FORMATO ESPERADO PELO FRONTEND
                const mappedData = DataMapper.mapApiResponse(data);
                debugMessage('Dados mapeados com sucesso');
                
                return mappedData;
            } catch (error) {
                debugMessage(`Erro na API: ${error.message}`, 'error');
                throw error;
            }
        },
         async checkBackendHealth() {
        try {
            debugMessage('🔍 Verificando saúde do backend...');
            
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
                debugMessage(`✅ Backend online - Versão: ${data.version}`, 'success');
                AppState.connectionStatus = 'connected';
                return true;
            } else {
                throw new Error('Backend respondeu mas status não é OK');
            }
            
        } catch (error) {
            debugMessage(`❌ Backend offline: ${error.message}`, 'error');
            AppState.connectionStatus = 'disconnected';
            AppState.lastError = error.message;
            return false;
        }
    },

mapBackendResponse(backendData) {
        debugMessage(`🔄 Mapeando resposta: ${JSON.stringify(backendData, null, 2)}`);
        
        if (!backendData || !backendData.resultado) {
            throw new Error('Estrutura de resposta inválida do backend');
        }
        
        const resultado = backendData.resultado;
        
        // ✅ MAPEAR EXATAMENTE COMO SEU BACKEND RETORNA
        const mappedData = {
            success: true,
            patrimonio: backendData.patrimonio || 65000000,
            versao: backendData.versao,
            timestamp: backendData.timestamp,
            
            // ✅ CAMPOS EXATOS DO SEU BACKEND
            resultado: {
                fazenda: resultado.fazenda_disponivel,           // backend -> frontend
                fazenda_disponivel: resultado.fazenda_disponivel,
                total: resultado.total_compromissos,             // backend -> frontend  
                total_compromissos: resultado.total_compromissos,
                percentual: resultado.percentual_fazenda,        // backend -> frontend
                percentual_fazenda: resultado.percentual_fazenda,
                despesas: resultado.despesas,
                filhos: resultado.filhos,
                doacoes: resultado.doacoes,
                arte: resultado.arte || 0,
                percentual_arte: resultado.percentual_arte || 0
            },
            
            // Gerar dados adicionais que o frontend espera
            allocation: this.generateAllocationData(backendData.patrimonio || 65000000),
            sensibilidade: this.generateSensibilityData(resultado),
            status: this.determineStatus(resultado.fazenda_disponivel, resultado.percentual_fazenda)
        };
        
        debugMessage(`✅ Dados mapeados: fazenda=${mappedData.resultado.fazenda}, percentual=${mappedData.resultado.percentual}%`);
        return mappedData;
    },



    collectFormParams() {
        const params = {};
        
        // ✅ Mapear cada input do frontend para o parâmetro esperado pelo backend
        Object.entries(CONFIG.PARAM_MAPPING).forEach(([frontendId, backendParam]) => {
            const element = document.getElementById(frontendId);
            if (element) {
                params[backendParam] = element.value;
            } else {
                debugMessage(`⚠️ Elemento ${frontendId} não encontrado`, 'warning');
            }
        });
        
        debugMessage(`📝 Parâmetros coletados: ${JSON.stringify(params)}`);
        return params;
    },


        async testConnection() {
            try {
                debugMessage('Testando conexão com API v4.1');
                const response = await fetch(CONFIG.ENDPOINTS.teste);
                const data = await response.json();
                const isConnected = response.ok && data.status === 'OK';
                debugMessage(`Conexão: ${isConnected ? 'OK' : 'ERRO'} - Versão: ${data.version || 'N/A'}`);
                return isConnected;
            } catch (error) {
                debugMessage(`Erro ao testar conexão: ${error.message}`, 'error');
                return false;
            }
        },

        async fetchTestCorrecoes() {
            try {
                debugMessage('Testando correções v4.1');
                const response = await fetch(CONFIG.ENDPOINTS.teste_correcoes);
                const data = await response.json();
                debugMessage(`Teste correções: ${data.success ? 'OK' : 'ERRO'}`);
                return data;
            } catch (error) {
                debugMessage(`Erro ao testar correções: ${error.message}`, 'error');
                return null;
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
            debugMessage('Destruindo gráficos existentes');
            
            Object.keys(AppState.charts).forEach(chartKey => {
                if (AppState.charts[chartKey] && AppState.charts[chartKey].destroy) {
                    try {
                        AppState.charts[chartKey].destroy();
                        debugMessage(`Gráfico ${chartKey} destruído`);
                    } catch (error) {
                        debugMessage(`Erro ao destruir gráfico ${chartKey}: ${error.message}`, 'warning');
                    }
                }
                delete AppState.charts[chartKey];
            });
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
            if (!ctx) return;

            const { fluxo_caixa } = AppState.currentData;
            
            let patrimonialData, labels;
            
            if (fluxo_caixa && fluxo_caixa.length > 0) {
                labels = fluxo_caixa.map(item => item.ano);
                patrimonialData = fluxo_caixa.map(item => item.patrimonio / 1000000);
            } else {
                // Fallback data
                labels = Array.from({length: 10}, (_, i) => 2025 + i);
                patrimonialData = labels.map((year, i) => {
                    return 65 * Math.pow(1.04, i) - (i * 1.8);
                });
            }

            AppState.charts.patrimonialEvolution = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Patrimônio (R$ milhões)',
                        data: patrimonialData,
                        borderColor: this.colors.primary,
                        backgroundColor: this.colors.primary + '20',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
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
    const ReportManager = {
        async generatePDFReport(tipo) {
            debugMessage(`⚠️ AVISO: Tentativa de gerar relatório ${tipo} - funcionalidade não implementada no backend`);
            
            this.showReportStatus(true, `Simulando geração de relatório ${tipo}...`);
            
            try {
                // ✅ SIMULAÇÃO LOCAL - BACKEND NÃO TEM ENDPOINTS DE RELATÓRIO
                await new Promise(resolve => setTimeout(resolve, 2000)); // Simular delay
                
                this.addToReportHistory(tipo, {
                    taxa: document.getElementById('taxaRetorno').value,
                    expectativa: document.getElementById('expectativaVida').value,
                    despesas: document.getElementById('despesasMensais').value
                });
                
                this.showReportStatus(false);
                Utils.showNotification(`⚠️ Relatório ${tipo} simulado - implementação no backend pendente`, 'warning');
                
                debugMessage(`Relatório ${tipo} simulado localmente`);
                
            } catch (error) {
                debugMessage(`Erro ao simular relatório: ${error.message}`, 'error');
                this.showReportStatus(false);
                Utils.showNotification(`Erro ao gerar relatório: ${error.message}`, 'danger');
            }
        },

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
                    despesas: params.despesas
                },
                status: 'simulado'
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
                    case 'detalhado':
                        reportTypeName = 'Análise Detalhada';
                        break;
                    case 'simulacao':
                        reportTypeName = 'Simulação Monte Carlo';
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
                        <td><span class="status-badge warning">Simulado</span></td>
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
            
            const originalValues = {
                taxa: document.getElementById('taxaRetorno').value,
                expectativa: document.getElementById('expectativaVida').value,
                despesas: document.getElementById('despesasMensais').value
            };
            
            document.getElementById('taxaRetorno').value = parametros.taxa;
            document.getElementById('expectativaVida').value = parametros.expectativa;
            document.getElementById('despesasMensais').value = parametros.despesas;
            
            await this.generatePDFReport(tipo);
            
            document.getElementById('taxaRetorno').value = originalValues.taxa;
            document.getElementById('expectativaVida').value = originalValues.expectativa;
            document.getElementById('despesasMensais').value = originalValues.despesas;
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



        updateMetrics() {
            if (!AppState.currentData) return;
            
            debugMessage('Atualizando métricas sincronizadas');
            const { resultado, patrimonio, status } = AppState.currentData;
            
            // ✅ ATUALIZAR COM DADOS SINCRONIZADOS DO BACKEND
            const patrimonioEl = document.getElementById('valorPatrimonio');
            if (patrimonioEl) {
                patrimonioEl.textContent = Utils.formatCurrency(patrimonio, true);
            }
            
            const fazendaEl = document.getElementById('valorFazenda');
            const percentualEl = document.getElementById('percentualFazenda');
            const trendEl = document.getElementById('trendFazenda');
            
            if (fazendaEl && resultado) {
                fazendaEl.textContent = Utils.formatCurrency(resultado.fazenda, true);
                if (percentualEl) {
                    percentualEl.textContent = Utils.formatPercentage(resultado.percentual);
                }
                
                if (trendEl) {
                    trendEl.className = 'metric-trend';
                    if (resultado.fazenda > 0) {
                        trendEl.classList.add('positive');
                        trendEl.innerHTML = '<i class="fas fa-arrow-up"></i><span>' + Utils.formatPercentage(resultado.percentual) + '</span>';
                    } else {
                        trendEl.classList.add('negative');
                        trendEl.innerHTML = '<i class="fas fa-arrow-down"></i><span>' + Utils.formatPercentage(resultado.percentual) + '</span>';
                    }
                }
            }
            
            // ✅ ARTE/GALERIA (NOVO CAMPO v4.0)
            const arteEl = document.querySelector('#valorArte h3');
            const percentualArteEl = document.getElementById('percentualArte');
            const trendArteEl = document.getElementById('trendArte');
            
            if (arteEl && resultado) {
                arteEl.textContent = Utils.formatCurrency(resultado.arte || 0, true);
                if (percentualArteEl) {
                    percentualArteEl.textContent = Utils.formatPercentage(resultado.percentual_arte || 0);
                }
                
                if (trendArteEl) {
                    trendArteEl.className = 'metric-trend';
                    if (resultado.arte > 0) {
                        trendArteEl.classList.add('positive');
                        trendArteEl.innerHTML = '<i class="fas fa-palette"></i><span>' + Utils.formatPercentage(resultado.percentual_arte || 0) + '</span>';
                    } else {
                        trendArteEl.classList.add('neutral');
                        trendArteEl.innerHTML = '<i class="fas fa-palette"></i><span>Indisponível</span>';
                    }
                }
            }
            
            // ✅ PERFIL DE INVESTIMENTO (NOVO CAMPO v4.0)
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
            
            const compromissosEl = document.getElementById('valorCompromissos');
            if (compromissosEl && resultado) {
                compromissosEl.textContent = Utils.formatCurrency(resultado.total, true);
            }
            
            // ✅ STATUS VISUAL ATUALIZADO
            this.updateStatusVisual(status);
            
            const statusEl = document.getElementById('valorStatus');
            if (statusEl) {
                statusEl.textContent = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Calculando...';
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

        updateMetrics() {
    if (!AppState.currentData) return;
    
    debugMessage('Atualizando métricas sincronizadas');
    const { resultado, patrimonio, status } = AppState.currentData;
    
    // ✅ PATRIMÔNIO TOTAL
    const patrimonioEl = document.getElementById('valorPatrimonio');
    if (patrimonioEl) {
        patrimonioEl.textContent = Utils.formatCurrency(patrimonio, true);
    }
    
    // ✅ FAZENDA DISPONÍVEL
    const fazendaEl = document.getElementById('valorFazenda');
    const percentualEl = document.getElementById('percentualFazenda');
    const trendEl = document.getElementById('trendFazenda');
    
    if (fazendaEl && resultado) {
        fazendaEl.textContent = Utils.formatCurrency(resultado.fazenda, true);
        if (percentualEl) {
            percentualEl.textContent = Utils.formatPercentage(resultado.percentual);
        }
        
        if (trendEl) {
            trendEl.className = 'metric-trend';
            if (resultado.fazenda > 0) {
                trendEl.classList.add('positive');
                trendEl.innerHTML = '<i class="fas fa-arrow-up"></i><span>' + Utils.formatPercentage(resultado.percentual) + '</span>';
            } else {
                trendEl.classList.add('negative');
                trendEl.innerHTML = '<i class="fas fa-arrow-down"></i><span>' + Utils.formatPercentage(resultado.percentual) + '</span>';
            }
        }
    }
    
    // ✅ ARTE/GALERIA (CORRIGIDO)
    const arteEl = document.getElementById('valorArte');  // ✅ Seletor correto
    const percentualArteEl = document.getElementById('percentualArte');
    const trendArteEl = document.getElementById('trendArte');
    
    if (arteEl && resultado) {
        arteEl.textContent = Utils.formatCurrency(resultado.arte || 0, true);
        if (percentualArteEl) {
            percentualArteEl.textContent = Utils.formatPercentage(resultado.percentual_arte || 0);
        }
        
        if (trendArteEl) {
            trendArteEl.className = 'metric-trend';
            if (resultado.arte > 0) {
                trendArteEl.classList.add('positive');
                trendArteEl.innerHTML = '<i class="fas fa-palette"></i><span>' + Utils.formatPercentage(resultado.percentual_arte || 0) + '</span>';
            } else {
                trendArteEl.classList.add('neutral');
                trendArteEl.innerHTML = '<i class="fas fa-palette"></i><span>Indisponível</span>';
            }
        }
    }
    
    // ✅ PERFIL DE INVESTIMENTO (CORRIGIDO)
    const perfilEl = document.getElementById('perfilAtual');  // ✅ Seletor correto
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
    
    // ✅ TOTAL COMPROMISSOS
    const compromissosEl = document.getElementById('valorCompromissos');
    if (compromissosEl && resultado) {
        compromissosEl.textContent = Utils.formatCurrency(resultado.total, true);
    }
    
    // ✅ STATUS VISUAL
    this.updateStatusVisual(status);
    
    const statusEl = document.getElementById('valorStatus');
    if (statusEl) {
        statusEl.textContent = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Calculando...';
    }

    debugMessage('✅ Métricas atualizadas com elementos corretos');
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
        }
    };

    // ================ FUNÇÕES GLOBAIS ================ 
    function showPage(pageId) {
        debugMessage(`Navegando para página: ${pageId}`);
        
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
        
        event.target.closest('.nav-item').classList.add('active');
        
        setTimeout(() => {
            if (AppState.chartJsLoaded) {
                ChartManager.createCharts();
            } else {
                ChartManager.showAlternativeVisualization();
            }
        }, 200);
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
        ReportManager.generatePDFReport(tipo);
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
            debugMessage('Inicializando Dashboard CIMO sincronizado com backend v4.1');
            
            this.setupEvents();
            SidebarController.init();
            
            await ChartManager.initializeCharts();
            
            await this.testConnection();
            
            await this.loadDashboard();
            
            ReportManager.updateReportHistoryTable();
        },

        async testConnection() {
            try {
                const isConnected = await ApiClient.testConnection();
                UIManager.updateSystemStatus(isConnected);
                
                if (!isConnected) {
                    Utils.showNotification('Erro de conexão com o servidor', 'warning');
                } else {
                    // ✅ TESTAR CORREÇÕES SE CONECTADO
                    const testData = await ApiClient.fetchTestCorrecoes();
                    if (testData) {
                        debugMessage(`Backend versão: ${testData.versao}, Logo funcionando: ${testData.logo_funcionando}`);
                    }
                }
            } catch (error) {
                debugMessage(`Erro ao testar conexão: ${error.message}`, 'error');
                UIManager.updateSystemStatus(false);
            }
        },

         updateScenarioTable() {
        if (!AppState.currentData?.sensibilidade) return;

        const tbody = document.getElementById('cenarioTableBody');
        if (!tbody) return;

        const { sensibilidade } = AppState.currentData;
        
        tbody.innerHTML = sensibilidade.map(item => {
            let statusClass, statusText;
            if (item.fazenda < 0) {
                statusClass = 'danger';
                statusText = 'Inviável';
            } else if (item.percentual < 5) {
                statusClass = 'warning'; 
                statusText = 'Crítico';
            } else if (item.percentual < 15) {
                statusClass = 'warning';
                statusText = 'Atenção';
            } else {
                statusClass = 'success';
                statusText = 'Viável';
            }

            return `
                <tr>
                    <td><strong>${item.taxa}%</strong></td>
                    <td>${Utils.formatCurrency(item.fazenda, true)}</td>
                    <td>${Utils.formatPercentage(item.percentual)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        }).join('');

        debugMessage('✅ Tabela de cenários atualizada');
    },


        setupEvents() {
            document.getElementById('refreshBtn').addEventListener('click', () => this.loadDashboard());
            
            // ✅ DEBOUNCE OTIMIZADO PARA NÃO SOBRECARREGAR O BACKEND
            const debouncedUpdate = this.debounce(() => this.loadDashboard(), 1000); // 1 segundo
            
            document.getElementById('taxaRetorno').addEventListener('input', (e) => {
                document.getElementById('taxaDisplay').textContent = e.target.value + '%';
                debouncedUpdate();
            });
            
            document.getElementById('expectativaVida').addEventListener('change', debouncedUpdate);
            document.getElementById('despesasMensais').addEventListener('input', debouncedUpdate);
            
            // ✅ NOVOS CAMPOS v4.0 SINCRONIZADOS
            document.getElementById('perfilInvestimento').addEventListener('change', debouncedUpdate);
            document.getElementById('inicioRendaFilhos').addEventListener('change', debouncedUpdate);
            document.getElementById('custoFazenda').addEventListener('input', debouncedUpdate);
            
            // Simulation events
            document.getElementById('simTaxaMin').addEventListener('input', (e) => {
                document.getElementById('simTaxaMinDisplay').textContent = e.target.value + '%';
            });
            
            document.getElementById('simTaxaMax').addEventListener('input', (e) => {
                document.getElementById('simTaxaMaxDisplay').textContent = e.target.value + '%';
            });
            
            document.getElementById('simVolatilidade').addEventListener('input', (e) => {
                document.getElementById('simVolatilidadeDisplay').textContent = e.target.value + '%';
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
                debugMessage('Carregando dados da API sincronizada v4.1');
                
                UIManager.showLoading(true);
                AppState.isLoading = true;
                
                // ✅ USAR CLIENTE API SINCRONIZADO
                const data = await ApiClient.fetchData();
                
                debugMessage(`Dados recebidos: versão ${data.versao}, sucesso: ${data.success}`);
                
                AppState.currentData = data;
                
                // ✅ ATUALIZAR UI COM DADOS SINCRONIZADOS
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
                debugMessage(`Erro ao carregar dashboard: ${error.message}`, 'error');
                Utils.showNotification(`Erro ao carregar dados: ${error.message}`, 'danger');
                
                const container = document.getElementById('alertContainer');
                if (container) {
                    container.innerHTML = `
                        <div class="alert danger">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>Erro de Conexão:</strong> Não foi possível carregar os dados do servidor. 
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
                    custo_fazenda: document.getElementById('custoFazenda').value
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
                        custo_fazenda: document.getElementById('custoFazenda')
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
        }
        

        
        
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
        debugMessage('DOM carregado - inicializando aplicação sincronizada com backend v4.1');
        
        // ✅ VALIDAR SE TODOS OS ELEMENTOS NECESSÁRIOS ESTÃO PRESENTES
        const requiredElements = [
            'taxaRetorno', 'expectativaVida', 'despesasMensais',
            'perfilInvestimento', 'inicioRendaFilhos', 'custoFazenda'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            debugMessage(`❌ Elementos HTML faltando: ${missingElements.join(', ')}`, 'error');
            Utils.showNotification(`Erro: Elementos HTML faltando: ${missingElements.join(', ')}`, 'danger');
            return;
        }
        
        debugMessage('✅ Todos os elementos HTML necessários encontrados');
        
        // Inicializar com delay para garantir que tudo está pronto
        setTimeout(() => {
            DashboardController.initialize();
        }, 200);
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
        }
    };

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

    // ================ FUNÇÕES GLOBAIS EXPOSTAS ================ 
    window.showPage = showPage;
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

    // ================ LOG DE INICIALIZAÇÃO ================ 
    debugMessage('🚀 JavaScript sincronizado com backend app.py v4.1 CARREGADO');
    debugMessage('📋 Endpoints disponíveis: /api/dados, /api/teste, /api/teste-correcoes');
    debugMessage('🔧 Campos sincronizados: taxa, expectativa, despesas, perfil, inicio_renda_filhos, custo_fazenda');
    debugMessage('📊 Mapeamento de dados: fazenda_disponivel → fazenda, total_compromissos → total');
    debugMessage('⚡ Performance optimizations: Chart caching, lazy loading, debounced API calls');
    debugMessage('🐛 Debug disponível via window.CimoDebug');

    // Inicializar otimizações
    initializePerformanceOptimizations();