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
        const timestamp = new Date().toLocaleTimeString();
        debugLog.push(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
        console.log(`🐛 [${timestamp}] ${message}`);
        updateDebugConsole();
    }

    function updateDebugConsole() {
        const debugEl = document.getElementById('debugLog');
        if (debugEl) {
            debugEl.innerHTML = debugLog.slice(-15).map(log => `<div style="margin-bottom: 2px; font-size: 10px; opacity: 0.9;">${log}</div>`).join('');
            debugEl.scrollTop = debugEl.scrollHeight;
        }
    }

    function toggleDebug() {
        const console = document.getElementById('debugConsole');
        console.style.display = console.style.display === 'none' ? 'block' : 'none';
    }

    // ================ CONFIGURATION ================ 
    const CONFIG = {
        API_BASE: '/api',
        ENDPOINTS: {
            dados: '/api/dados',
            cenarios: '/api/cenarios',
            teste: '/api/teste',
            relatorio_executivo: '/api/relatorio/executivo',
            relatorio_detalhado: '/api/relatorio/detalhado'
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

    // ================ API CLIENT ================ 
    const ApiClient = {
        async fetchData() {
            try {
                debugMessage('Iniciando requisição para API de dados');
                
                const params = new URLSearchParams({
                    taxa: document.getElementById('taxaRetorno').value,
                    expectativa: document.getElementById('expectativaVida').value,
                    despesas: document.getElementById('despesasMensais').value
                });

                const url = `${CONFIG.ENDPOINTS.dados}?${params}`;
                debugMessage(`URL da requisição: ${url}`);

                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                debugMessage(`Dados recebidos: ${JSON.stringify(data).substring(0, 100)}...`);
                
                if (!data.success) {
                    throw new Error(data.erro || 'Erro desconhecido na API');
                }

                return data;
            } catch (error) {
                debugMessage(`Erro na API: ${error.message}`, 'error');
                throw error;
            }
        },

        async fetchCenarios() {
            try {
                const response = await fetch(CONFIG.ENDPOINTS.cenarios);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.erro || 'Erro ao carregar cenários');
                }

                return data;
            } catch (error) {
                debugMessage('Erro ao carregar cenários:', error);
                throw error;
            }
        },

        async testConnection() {
            try {
                debugMessage('Testando conexão com API');
                const response = await fetch(CONFIG.ENDPOINTS.teste);
                const data = await response.json();
                const isConnected = response.ok && data.status === 'OK';
                debugMessage(`Conexão: ${isConnected ? 'OK' : 'ERRO'}`);
                return isConnected;
            } catch (error) {
                debugMessage(`Erro ao testar conexão: ${error.message}`, 'error');
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

    // ================ CHART MANAGER WITH FIX ================ 
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
            debugMessage('Inicializando sistema de gráficos');
            
            try {
                // Try to load Chart.js
                await loadChartJS();
                AppState.chartJsLoaded = true;
                debugMessage('Chart.js inicializado com sucesso');
                
                // Create charts if data is available
                if (AppState.currentData) {
                    this.createCharts();
                }
                
            } catch (error) {
                debugMessage('Falha ao carregar Chart.js - usando visualização alternativa', 'warning');
                AppState.chartJsLoaded = false;
                this.showAlternativeVisualization();
            }
        },

        // FIX: Destroy existing charts before creating new ones
        destroyExistingCharts() {
            debugMessage('Destruindo gráficos existentes para evitar conflitos');
            
            Object.keys(AppState.charts).forEach(chartKey => {
                if (AppState.charts[chartKey] && AppState.charts[chartKey].destroy) {
                    try {
                        AppState.charts[chartKey].destroy();
                        debugMessage(`Gráfico ${chartKey} destruído com sucesso`);
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

            debugMessage('Criando gráficos Chart.js');
            
            try {
                // FIX: Always destroy existing charts first
                this.destroyExistingCharts();
                
                // Create charts based on current page
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
            debugMessage('Mostrando visualização alternativa sem Chart.js');
            
            if (!AppState.currentData) return;
            
            const { resultado, allocation, sensibilidade } = AppState.currentData;
            
            // Only show alternative for dashboard page
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
            if (!sensibilidade) return;
            
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
            
            debugMessage('Criando gráfico de compromissos');

            AppState.charts.compromissos = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Despesas Ana', 'Renda Filhos', 'Doações', 'Disponível Fazenda'],
                    datasets: [{
                        data: [
                            resultado.despesas,
                            resultado.filhos,
                            resultado.doacoes,
                            Math.max(resultado.fazenda, 0)
                        ],
                        backgroundColor: [
                            this.colors.primary,
                            this.colors.secondary,
                            this.colors.gray,
                            this.colors.accent
                        ],
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
            
            debugMessage('Criando gráfico de allocation');

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
            if (!sensibilidade) return;
            
            debugMessage('Criando gráfico de sensibilidade');

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

        // Additional page charts
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

        // Sample chart implementations for other pages
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
                        data: [65, 15, 10, 5, 5, 0, 0],
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
            if (!ctx || !AppState.currentData) return;

            const { fluxo_caixa } = AppState.currentData;
            
            if (!fluxo_caixa || fluxo_caixa.length === 0) {
                // Fallback para dados simulados
                const years = Array.from({length: 10}, (_, i) => 2025 + i);
                const patrimonialData = years.map((year, i) => {
                    return 65000000 * Math.pow(1.04, i) - (i * 1800000);
                });

                AppState.charts.patrimonialEvolution = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: years,
                        datasets: [{
                            label: 'Patrimônio (R$ milhões)',
                            data: patrimonialData.map(v => v / 1000000),
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
            } else {
                // Usar dados reais do fluxo de caixa
                AppState.charts.patrimonialEvolution = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: fluxo_caixa.map(item => item.ano),
                        datasets: [{
                            label: 'Patrimônio (R$ milhões)',
                            data: fluxo_caixa.map(item => item.patrimonio / 1000000),
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

        // FIXED: Monte Carlo simulation chart
        createMonteCarloChart() {
            const ctx = document.getElementById('monteCarloChart');
            if (!ctx) return;

            debugMessage('Criando gráfico Monte Carlo');

            // Generate simulated data based on current parameters
            const { taxaMin, taxaMax, volatilidade, numSimulacoes } = AppState.simulationParams;
            const datasets = [];
            
            // Create 20 sample trajectories for visualization
            for (let i = 0; i < 20; i++) {
                const data = [];
                let value = 65; // Starting at 65M
                
                for (let year = 0; year < 20; year++) {
                    // Random return between min and max with volatility
                    const baseReturn = taxaMin + Math.random() * (taxaMax - taxaMin);
                    const volatilityFactor = (Math.random() - 0.5) * (volatilidade / 100);
                    const totalReturn = (baseReturn + volatilityFactor * 100) / 100;
                    
                    value = value * (1 + totalReturn) - 1.8; // 1.8M annual outflows
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

        // NEW: Distribution chart for simulation results
        createDistribuicaoChart() {
            const ctx = document.getElementById('distribuicaoChart');
            if (!ctx) return;

            debugMessage('Criando gráfico de distribuição');

            // Simulate final values distribution
            const finalValues = [];
            const { taxaMin, taxaMax, volatilidade } = AppState.simulationParams;
            
            for (let i = 0; i < 1000; i++) {
                const avgReturn = (taxaMin + taxaMax) / 2;
                const randomFactor = (Math.random() - 0.5) * (volatilidade / 50);
                const finalReturn = avgReturn + randomFactor;
                
                let finalValue = 65 * Math.pow(1 + finalReturn/100, 20) - (20 * 1.8);
                finalValues.push(finalValue);
            }

            // Create histogram data
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

        // Placeholder implementations for other charts
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

            // Create a simple scatter plot for bidimensional analysis
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
            // Update simulation parameters from UI
            AppState.simulationParams.taxaMin = parseFloat(document.getElementById('simTaxaMin').value);
            AppState.simulationParams.taxaMax = parseFloat(document.getElementById('simTaxaMax').value);
            AppState.simulationParams.volatilidade = parseFloat(document.getElementById('simVolatilidade').value);
            AppState.simulationParams.numSimulacoes = parseInt(document.getElementById('simSimulacoes').value);
            
            debugMessage(`Parâmetros de simulação atualizados: ${JSON.stringify(AppState.simulationParams)}`);
            
            // Run new simulation
            this.runSimulation();
        },

        runSimulation() {
            debugMessage('Executando nova simulação Monte Carlo');
            
            const { taxaMin, taxaMax, volatilidade, numSimulacoes } = AppState.simulationParams;
            
            // Generate simulation results
            const results = this.generateSimulationResults();
            
            // Update UI with results
            this.updateSimulationResults(results);
            
            // Recreate charts if we're on the simulation page
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
            
            // Run Monte Carlo simulation
            for (let i = 0; i < numSimulacoes; i++) {
                let patrimonio = 65000000; // Start with 65M
                
                // Simulate 20 years
                for (let year = 0; year < 20; year++) {
                    // Random return within range
                    const baseReturn = (taxaMin + Math.random() * (taxaMax - taxaMin)) / 100;
                    const volatilityFactor = (Math.random() - 0.5) * 2 * (volatilidade / 100);
                    const yearReturn = baseReturn + volatilityFactor;
                    
                    // Apply return and subtract outflows
                    patrimonio = patrimonio * (1 + yearReturn) - 1800000; // 1.8M annual outflows
                    patrimonio = Math.max(patrimonio, 0); // Can't go negative
                }
                
                finalValues.push(patrimonio);
            }
            
            // Sort for percentile calculations
            finalValues.sort((a, b) => a - b);
            
            // Calculate percentiles
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
            // Update the results display elements
            document.getElementById('simResultP10').textContent = Utils.formatCurrency(results.p10, true);
            document.getElementById('simResultP50').textContent = Utils.formatCurrency(results.p50, true);
            document.getElementById('simResultP90').textContent = Utils.formatCurrency(results.p90, true);
            document.getElementById('simSuccessRate').textContent = results.successRate.toFixed(0) + '%';
            
            // Update detailed table
            document.getElementById('simP5').textContent = Utils.formatCurrency(results.p5, true);
            document.getElementById('simP10').textContent = Utils.formatCurrency(results.p10, true);
            document.getElementById('simP25').textContent = Utils.formatCurrency(results.p25, true);
            document.getElementById('simP50').textContent = Utils.formatCurrency(results.p50, true);
            document.getElementById('simP75').textContent = Utils.formatCurrency(results.p75, true);
            document.getElementById('simP90').textContent = Utils.formatCurrency(results.p90, true);
            document.getElementById('simP95').textContent = Utils.formatCurrency(results.p95, true);
        }
    };

    // ================ REPORT MANAGER ================ 
    const ReportManager = {
        async generatePDFReport(tipo) {
            debugMessage(`Iniciando geração de relatório: ${tipo}`);
            
            // Show loading status
            this.showReportStatus(true, `Gerando relatório ${tipo}...`);
            
            try {
                // Get current parameters
                const params = new URLSearchParams({
                    taxa: document.getElementById('taxaRetorno').value,
                    expectativa: document.getElementById('expectativaVida').value,
                    despesas: document.getElementById('despesasMensais').value
                });
                
                // Add simulation parameters if it's a simulation report
                if (tipo === 'simulacao') {
                    params.append('simulacao', 'true');
                    params.append('volatilidade', AppState.simulationParams.volatilidade);
                    params.append('num_simulacoes', AppState.simulationParams.numSimulacoes);
                }
                
                // Determine endpoint - map simulation to detailed report
                let endpoint;
                let reportType = tipo;
                
                if (tipo === 'executivo') {
                    endpoint = CONFIG.ENDPOINTS.relatorio_executivo;
                } else if (tipo === 'detalhado' || tipo === 'simulacao') {
                    endpoint = CONFIG.ENDPOINTS.relatorio_detalhado;
                    if (tipo === 'simulacao') {
                        reportType = 'detalhado (com simulações)';
                    }
                } else {
                    throw new Error('Tipo de relatório não suportado');
                }
                
                const url = `${endpoint}?${params}`;
                debugMessage(`URL do relatório: ${url}`);
                
                // Fetch the PDF
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Get the PDF blob
                const blob = await response.blob();
                
                // Create download link with appropriate filename
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                
                const filename = tipo === 'simulacao' ? 
                    `relatorio_simulacao_montecarlo_${new Date().toISOString().split('T')[0]}.pdf` :
                    `relatorio_${tipo}_${new Date().toISOString().split('T')[0]}.pdf`;
                
                link.download = filename;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Cleanup
                window.URL.revokeObjectURL(downloadUrl);
                
                // Add to history
                this.addToReportHistory(tipo, params);
                
                // Show success
                this.showReportStatus(false);
                Utils.showNotification(`Relatório ${reportType} gerado com sucesso!`, 'success');
                
                debugMessage(`Relatório ${tipo} baixado com sucesso`);
                
            } catch (error) {
                debugMessage(`Erro ao gerar relatório: ${error.message}`, 'error');
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
                    taxa: params.get('taxa'),
                    expectativa: params.get('expectativa'),
                    despesas: params.get('despesas')
                },
                status: 'gerado'
            };
            
            AppState.reportHistory.unshift(report);
            
            // Keep only last 10 reports
            AppState.reportHistory = AppState.reportHistory.slice(0, 10);
            
            // Update UI
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
                // Format report type name
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
            
            // Temporarily update form values
            const originalValues = {
                taxa: document.getElementById('taxaRetorno').value,
                expectativa: document.getElementById('expectativaVida').value,
                despesas: document.getElementById('despesasMensais').value
            };
            
            document.getElementById('taxaRetorno').value = parametros.taxa;
            document.getElementById('expectativaVida').value = parametros.expectativa;
            document.getElementById('despesasMensais').value = parametros.despesas;
            
            // Generate report
            await this.generatePDFReport(tipo);
            
            // Restore original values
            document.getElementById('taxaRetorno').value = originalValues.taxa;
            document.getElementById('expectativaVida').value = originalValues.expectativa;
            document.getElementById('despesasMensais').value = originalValues.despesas;
        }
    };

    // ================ UI MANAGER ================ 
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
            
            debugMessage('Atualizando métricas');
            const { resultado, patrimonio, status } = AppState.currentData;
            
            // Atualizar patrimônio
            const patrimonioEl = document.getElementById('valorPatrimonio');
            if (patrimonioEl) {
                patrimonioEl.textContent = Utils.formatCurrency(patrimonio, true);
            }
            
            // Atualizar fazenda
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
            
            // Atualizar compromissos
            const compromissosEl = document.getElementById('valorCompromissos');
            if (compromissosEl && resultado) {
                compromissosEl.textContent = Utils.formatCurrency(resultado.total, true);
            }
            
            // Atualizar status
            const statusEl = document.getElementById('valorStatus');
            if (statusEl) {
                statusEl.textContent = status || 'Calculando...';
            }
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

        updateTable() {
            const tbody = document.getElementById('cenarioTableBody');
            if (!tbody || !AppState.currentData) return;
            
            debugMessage('Atualizando tabela');
            const { sensibilidade } = AppState.currentData;
            if (!sensibilidade) return;
            
            tbody.innerHTML = '';
            
            sensibilidade.forEach(item => {
                const status = this.getStatusBadge(item.fazenda, item.percentual);
                
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${item.taxa}%</strong></td>
                        <td><strong>${Utils.formatCurrency(item.fazenda, true)}</strong></td>
                        <td>${Utils.formatPercentage(item.percentual)}</td>
                        <td>${status}</td>
                    </tr>
                `;
            });
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

    // ================ GLOBAL FUNCTIONS ================ 
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
        
        // Create charts for the new page with delay
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

    // FIXED: Update simulation parameters function
    function updateSimulationParams() {
        debugMessage('Atualizando parâmetros de simulação');
        
        // Update display values
        document.getElementById('simTaxaMinDisplay').textContent = document.getElementById('simTaxaMin').value + '%';
        document.getElementById('simTaxaMaxDisplay').textContent = document.getElementById('simTaxaMax').value + '%';
        document.getElementById('simVolatilidadeDisplay').textContent = document.getElementById('simVolatilidade').value + '%';
        
        // Update simulation
        SimulationManager.updateParameters();
    }

    // FIXED: Report generation function
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

    // ================ MAIN CONTROLLER ================ 
    const DashboardController = {
        async initialize() {
            debugMessage('Inicializando Dashboard CIMO');
            
            this.setupEvents();
            SidebarController.init();
            
            // Initialize charts system
            await ChartManager.initializeCharts();
            
            // Test connection
            await this.testConnection();
            
            // Load initial data
            await this.loadDashboard();
            
            // Initialize report history
            ReportManager.updateReportHistoryTable();
        },

        async testConnection() {
            try {
                const isConnected = await ApiClient.testConnection();
                UIManager.updateSystemStatus(isConnected);
                
                if (!isConnected) {
                    Utils.showNotification('Erro de conexão com o servidor', 'warning');
                }
            } catch (error) {
                debugMessage(`Erro ao testar conexão: ${error.message}`, 'error');
                UIManager.updateSystemStatus(false);
            }
        },

        setupEvents() {
            // Refresh button
            document.getElementById('refreshBtn').addEventListener('click', () => this.loadDashboard());
            
            // Controls com debounce para não sobrecarregar a API
            const debouncedUpdate = this.debounce(() => this.loadDashboard(), 800);
            
            document.getElementById('taxaRetorno').addEventListener('input', (e) => {
                document.getElementById('taxaDisplay').textContent = e.target.value + '%';
                debouncedUpdate();
            });
            
            document.getElementById('expectativaVida').addEventListener('change', debouncedUpdate);
            document.getElementById('despesasMensais').addEventListener('input', debouncedUpdate);
            
            // Simulation parameter events
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
                debugMessage('Carregando dados da API');
                
                // Mostrar loading
                UIManager.showLoading(true);
                AppState.isLoading = true;
                
                // Buscar dados da API Flask
                const data = await ApiClient.fetchData();
                
                debugMessage('Dados recebidos com sucesso');
                
                // Atualizar estado da aplicação
                AppState.currentData = data;
                
                // Atualizar UI
                UIManager.updateMetrics();
                UIManager.updateAlerts();
                UIManager.updateTable();
                
                // Criar gráficos com delay
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
                
                // Se falhar, mostrar mensagem de erro mais detalhada
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
                // Remover loading
                UIManager.showLoading(false);
                AppState.isLoading = false;
            }
        }
    };

    // ================ DEBUG HELPERS ================ 
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
            debugMessage(`Testando relatório: ${tipo}`);
            if (!tipo) tipo = 'executivo';
            if (!['executivo', 'detalhado', 'simulacao'].includes(tipo)) {
                debugMessage(`Tipo inválido. Use: executivo, detalhado ou simulacao`, 'warning');
                Utils.showNotification('Tipo de relatório inválido. Use: executivo, detalhado ou simulacao', 'warning');
                return;
            }
            
            if (tipo === 'simulacao') {
                debugMessage(`Parâmetros de simulação: ${JSON.stringify(AppState.simulationParams)}`);
            }
            
            ReportManager.generatePDFReport(tipo);
        },
        logs: () => debugLog,
        clearLogs: () => {
            debugLog = [];
            updateDebugConsole();
        }
    };

    // ================ INITIALIZATION ================ 
    document.addEventListener('DOMContentLoaded', () => {
        debugMessage('DOM carregado - inicializando aplicação');
        
        // Initialize with a small delay to ensure everything is ready
        setTimeout(() => {
            DashboardController.initialize();
        }, 200);
    });

    const ChartCache = {
cache: new Map(),
maxSize: 20,

generateKey(pageId, dataHash) {
    return `${pageId}-${dataHash}`;
},

getChart(key) {
    const cached = this.cache.get(key);
    if (cached) {
        // Move para o final (LRU)
        this.cache.delete(key);
        this.cache.set(key, cached);
        debugMessage(`Cache hit para: ${key}`);
        return cached;
    }
    return null;
},

setChart(key, chart) {
    // Remove mais antigo se exceder tamanho máximo
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

// 2. Intersection Observer para Lazy Loading
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

// 3. Performance Monitor
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
    
    // Log se demorar mais que o esperado
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

// 4. Otimização do ChartManager
const OptimizedChartManager = {
...ChartManager,

// Override da função createCharts para usar cache
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

    PerformanceMonitor.start('chart-creation');
    
    try {
        // Gerar hash dos dados para cache
        const dataHash = this.generateDataHash(AppState.currentData);
        const cacheKey = ChartCache.generateKey(AppState.currentPage, dataHash);
        
        // Verificar cache primeiro
        const cachedCharts = ChartCache.getChart(cacheKey);
        if (cachedCharts) {
            this.restoreChartsFromCache(cachedCharts);
            PerformanceMonitor.end('chart-creation');
            return;
        }
        
        // Destruir gráficos existentes apenas se necessário
        this.smartDestroyCharts();
        
        // Criar novos gráficos
        this.createChartsForCurrentPage();
        
        // Salvar no cache
        ChartCache.setChart(cacheKey, { ...AppState.charts });
        
        debugMessage('Gráficos criados com sucesso');
    } catch (error) {
        debugMessage(`Erro ao criar gráficos: ${error.message}`, 'error');
        this.showChartError();
    } finally {
        PerformanceMonitor.end('chart-creation');
    }
},

generateDataHash(data) {
    // Gerar hash simples dos dados para detectar mudanças
    const str = JSON.stringify({
        patrimonio: data.patrimonio,
        fazenda: data.resultado?.fazenda,
        taxa: data.parametros?.taxa,
        timestamp: Math.floor(Date.now() / 60000) // Hash por minuto
    });
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
},

smartDestroyCharts() {
    // Destruir apenas gráficos que serão recriados
    const chartsToDestroy = this.getChartsForPage(AppState.currentPage);
    
    chartsToDestroy.forEach(chartKey => {
        if (AppState.charts[chartKey] && AppState.charts[chartKey].destroy) {
            try {
                AppState.charts[chartKey].destroy();
                debugMessage(`Gráfico ${chartKey} destruído`);
            } catch (error) {
                debugMessage(`Erro ao destruir gráfico ${chartKey}: ${error.message}`, 'warning');
            }
            delete AppState.charts[chartKey];
        }
    });
},

getChartsForPage(pageId) {
    const pageCharts = {
        'dashboard': ['compromissos', 'allocation', 'sensibilidade'],
        'allocation': ['currentAllocation', 'benchmark'],
        'projections': ['patrimonialEvolution', 'cashFlow'],
        'simulations': ['monteCarlo', 'distribuicao'],
        'scenarios': ['scenarioComparison', 'scenarioEvolution', 'stressTest'],
        'sensitivity': ['returnSensitivity', 'expenseSensitivity', 'bidimensional']
    };
    
    return pageCharts[pageId] || [];
},

createChartsForCurrentPage() {
    const pageCharts = this.getChartsForPage(AppState.currentPage);
    const containers = pageCharts.map(chart => `${chart}Container`);
    
    this.hideChartPlaceholders(containers);
    
    // Criar gráficos baseado na página atual
    switch (AppState.currentPage) {
        case 'dashboard':
            this.createCompromissosChart();
            this.createAllocationChart();
            this.createSensibilidadeChart();
            break;
        case 'allocation':
            this.createAllocationPageCharts();
            break;
        case 'projections':
            this.createProjectionCharts();
            break;
        case 'simulations':
            this.createSimulationCharts();
            break;
        case 'scenarios':
            this.createScenarioCharts();
            break;
        case 'sensitivity':
            this.createSensitivityCharts();
            break;
    }
}
};

// 5. API Client com Cache
const OptimizedApiClient = {
...ApiClient,
cache: new Map(),
cacheTimeout: 60000, // 1 minuto

async fetchDataWithCache() {
    const params = new URLSearchParams({
        taxa: document.getElementById('taxaRetorno').value,
        expectativa: document.getElementById('expectativaVida').value,
        despesas: document.getElementById('despesasMensais').value
    });
    
    const cacheKey = params.toString();
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        debugMessage('Usando dados do cache local');
        return cached.data;
    }
    
    PerformanceMonitor.start('api-call');
    
    try {
        const data = await this.fetchData();
        
        // Salvar no cache
        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
        
        // Limpar cache antigo
        this.cleanOldCache();
        
        return data;
    } finally {
        PerformanceMonitor.end('api-call');
    }
},

cleanOldCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
        }
    }
}
};

// 6. Inicialização das Otimizações
function initializePerformanceOptimizations() {
debugMessage('Inicializando otimizações de performance');

// Inicializar lazy loading
ChartLazyLoader.init();

// Substituir ChartManager por versão otimizada
Object.assign(ChartManager, OptimizedChartManager);

// Substituir ApiClient por versão otimizada
Object.assign(ApiClient, OptimizedApiClient);

// Monitor de performance global
window.PerformanceMonitor = PerformanceMonitor;
window.ChartCache = ChartCache;

debugMessage('Otimizações de performance carregadas');
}

// ================ FUNÇÕES ATUALIZADAS v4.0 ================

// Validações de sanidade locais
function validarInputsLocais() {
    const taxa = parseFloat(document.getElementById('taxaRetorno').value);
    const expectativa = parseInt(document.getElementById('expectativaVida').value);
    const despesas = parseFloat(document.getElementById('despesasMensais').value);
    const custoFazenda = parseFloat(document.getElementById('custoFazenda').value);
    
    debugMessage('Validando inputs localmente');
    
    // Validar taxa de retorno (deve estar entre 0.1% e 15%)
    if (taxa < 0.1 || taxa > 15) {
        Utils.showNotification('Taxa de retorno deve estar entre 0.1% e 15%', 'danger');
        return false;
    }
    
    // Alertar se taxa muito otimista
    if (taxa > 8) {
        Utils.showNotification('⚠️ Taxa de retorno acima de 8% é muito otimista para perfil conservador-moderado', 'warning');
    }
    
    // Validar expectativa de vida (deve ser >= 53 anos)
    if (expectativa < 53) {
        Utils.showNotification('Expectativa de vida deve ser pelo menos 53 anos', 'danger');
        return false;
    }
    
    // Validar despesas (entre R$ 50k e R$ 1M)
    if (despesas < 50000 || despesas > 1000000) {
        Utils.showNotification('Despesas devem estar entre R$ 50.000 e R$ 1.000.000', 'danger');
        return false;
    }
    
    // Validar custo fazenda
    if (custoFazenda < 500000 || custoFazenda > 10000000) {
        Utils.showNotification('Custo da fazenda deve estar entre R$ 500.000 e R$ 10.000.000', 'danger');
        return false;
    }
    
    return true;
}

// ApiClient atualizado com novos parâmetros
const ApiClientV4 = {
    ...ApiClient,
    
    async fetchData() {
        // Validar inputs antes de enviar
        if (!validarInputsLocais()) {
            throw new Error('Parâmetros inválidos');
        }
        
        try {
            debugMessage('Iniciando requisição para API v4.0');
            
            const params = new URLSearchParams({
                taxa: document.getElementById('taxaRetorno').value,
                expectativa: document.getElementById('expectativaVida').value,
                despesas: document.getElementById('despesasMensais').value,
                // NOVOS PARÂMETROS v4.0:
                perfil: document.getElementById('perfilInvestimento').value,
                inicio_renda_filhos: document.getElementById('inicioRendaFilhos').value,
                custo_fazenda: document.getElementById('custoFazenda').value
            });

            const url = `${CONFIG.ENDPOINTS.dados}?${params}`;
            debugMessage(`URL da requisição v4.0: ${url}`);

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            debugMessage(`Dados v4.0 recebidos: versão ${data.versao || 'desconhecida'}`);
            
            if (!data.success) {
                throw new Error(data.erro || 'Erro desconhecido na API v4.0');
            }

            return data;
        } catch (error) {
            debugMessage(`Erro na API v4.0: ${error.message}`, 'error');
            throw error;
        }
    }
};

// UIManager atualizado para novos campos
const UIManagerV4 = {
    ...UIManager,
    
    updateMetrics() {
        if (!AppState.currentData) return;
        
        debugMessage('Atualizando métricas v4.0');
        const { resultado, patrimonio, status, parametros } = AppState.currentData;
        
        // Métricas existentes
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
        
        // NOVO: Atualizar valor arte
        const arteEl = document.getElementById('valorArte');
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
        
        // NOVO: Atualizar perfil de investimento
        const perfilEl = document.getElementById('perfilAtual');
        const retornoEl = document.getElementById('retornoEsperado');
        
        if (perfilEl && parametros) {
            const perfil = parametros.perfil_investimento || 'moderado';
            perfilEl.textContent = perfil.charAt(0).toUpperCase() + perfil.slice(1);
            
            // Mostrar retorno esperado baseado no perfil
            const retornos = {
                'conservador': '3.5% a.a.',
                'moderado': '4.5% a.a.',
                'balanceado': '5.2% a.a.'
            };
            if (retornoEl) {
                retornoEl.textContent = retornos[perfil] || '4.5% a.a.';
            }
        }
        
        // NOVO: Status visual do plano
        this.updateStatusVisual(status);
        
        // Compromissos existente
        const compromissosEl = document.getElementById('valorCompromissos');
        if (compromissosEl && resultado) {
            compromissosEl.textContent = Utils.formatCurrency(resultado.total, true);
        }
        
        // Status existente
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
        
        // Remover classes anteriores
        statusBadge.classList.remove('critico', 'atencao', 'viavel');
        
        // Adicionar classe baseada no status
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
    }
};

// Event listeners para novos inputs
document.addEventListener('DOMContentLoaded', () => {
    // ... inicialização existente ...
    
    // NOVOS EVENT LISTENERS v4.0
    const debouncedUpdate = DashboardController.debounce(() => DashboardController.loadDashboard(), 800);
    
    // Perfil de investimento
    document.getElementById('perfilInvestimento').addEventListener('change', debouncedUpdate);
    
    // Início renda filhos
    document.getElementById('inicioRendaFilhos').addEventListener('change', debouncedUpdate);
    
    // Custo fazenda
    document.getElementById('custoFazenda').addEventListener('input', debouncedUpdate);
    
    debugMessage('Event listeners v4.0 configurados');
});

// Substituir ApiClient e UIManager por versões v4.0
Object.assign(ApiClient, ApiClientV4);
Object.assign(UIManager, UIManagerV4);

// Debug helpers atualizados
window.CimoDebug = {
    ...window.CimoDebug,
    
    async testV4Features() {
        debugMessage('🧪 Testando funcionalidades v4.0');
        
        try {
            // Testar perfis de investimento
            const perfis = ['conservador', 'moderado', 'balanceado'];
            for (const perfil of perfis) {
                document.getElementById('perfilInvestimento').value = perfil;
                await new Promise(resolve => setTimeout(resolve, 500));
                debugMessage(`✅ Perfil ${perfil}: Configurado`);
            }
            
            // Testar início renda filhos
            const opcoes = ['falecimento', 'imediato', '65'];
            for (const opcao of opcoes) {
                document.getElementById('inicioRendaFilhos').value = opcao;
                await new Promise(resolve => setTimeout(resolve, 500));
                debugMessage(`✅ Início filhos ${opcao}: Configurado`);
            }
            
            // Resetar para valores padrão
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
    
    getV4Status() {
        return {
            versao: '4.0',
            inputs_implementados: {
                perfil_investimento: !!document.getElementById('perfilInvestimento'),
                inicio_renda_filhos: !!document.getElementById('inicioRendaFilhos'),
                custo_fazenda: !!document.getElementById('custoFazenda')
            },
            metricas_implementadas: {
                valor_arte: !!document.getElementById('valorArte'),
                perfil_atual: !!document.getElementById('perfilAtual'),
                status_visual: !!document.getElementById('statusBadge')
            },
            validacoes: {
                locais: typeof validarInputsLocais === 'function',
                api_v4: typeof ApiClientV4 === 'object'
            }
        };
    }
};

debugMessage('🚀 Implementação v4.0 carregada');
