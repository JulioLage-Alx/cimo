#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flask Backend - Plano Patrimonial Ana
Cimo Family Office
Versão 2.0 - Compatível com o novo Dashboard BI
"""

from flask import Flask, request, jsonify, render_template_string
from flask import render_template
from flask_cors import CORS
import math
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# ================ CONSTANTES ================
PATRIMONIO = 65_000_000  # R$ 65 milhões
IDADE_ANA = 53
DESPESAS_BASE = 150_000  # R$ 150k/mês
RENDA_FILHOS = 150_000   # R$ 50k x 3 filhos
DOACOES = 50_000         # R$ 50k/mês

# ================ FUNÇÕES DE CÁLCULO ================
def valor_presente(fluxo_mensal, anos, taxa_anual):
    """Calcula valor presente de fluxos mensais"""
    if taxa_anual <= 0:
        return fluxo_mensal * anos * 12
    
    taxa_mensal = (1 + taxa_anual/100) ** (1/12) - 1
    periodos = anos * 12
    
    if taxa_mensal > 0:
        vp = fluxo_mensal * (1 - (1 + taxa_mensal) ** (-periodos)) / taxa_mensal
    else:
        vp = fluxo_mensal * periodos
    
    return vp

def calcular_compromissos(taxa, expectativa, despesas):
    """Calcula todos os compromissos de Ana"""
    anos_vida = expectativa - IDADE_ANA
    
    # 1. Despesas da Ana até morrer
    vp_despesas = valor_presente(despesas, anos_vida, taxa)
    
    # 2. Renda dos filhos (começa quando Ana tem 65 anos, dura 25 anos)
    anos_ate_65 = 65 - IDADE_ANA
    fator_desconto = (1 + taxa/100) ** (-anos_ate_65)
    vp_filhos = valor_presente(RENDA_FILHOS, 25, taxa) * fator_desconto
    
    # 3. Doações por 15 anos
    vp_doacoes = valor_presente(DOACOES, 15, taxa)
    
    total = vp_despesas + vp_filhos + vp_doacoes
    fazenda = PATRIMONIO - total
    percentual = (fazenda / PATRIMONIO) * 100
    
    return {
        'despesas': vp_despesas,
        'filhos': vp_filhos,
        'doacoes': vp_doacoes,
        'total': total,
        'fazenda': fazenda,
        'percentual': percentual
    }

def determinar_status(fazenda, percentual):
    """Determina o status do plano baseado no valor da fazenda"""
    if fazenda < 0:
        return 'crítico'
    elif percentual < 5:
        return 'atenção'
    else:
        return 'viável'

def gerar_projecao_fluxo(taxa, anos=10):
    """Gera projeção de fluxo de caixa"""
    patrimonio_atual = PATRIMONIO
    fluxo = []
    
    for ano in range(anos):
        idade_ana = IDADE_ANA + ano + 1
        ano_calendario = 2025 + ano
        
        # Rendimentos do patrimônio
        rendimentos = patrimonio_atual * (taxa / 100)
        
        # Saídas anuais
        saidas_anuais = DESPESAS_BASE * 12  # Despesas Ana
        
        # Adicionar renda filhos se Ana tiver 65+ anos
        if idade_ana >= 65:
            saidas_anuais += RENDA_FILHOS * 12
        
        # Adicionar doações (primeiros 15 anos)
        if ano < 15:
            saidas_anuais += DOACOES * 12
        
        # Saldo líquido
        saldo_liquido = rendimentos - saidas_anuais
        patrimonio_atual += saldo_liquido
        
        fluxo.append({
            'ano': ano_calendario,
            'idade_ana': idade_ana,
            'patrimonio': patrimonio_atual,
            'rendimentos': rendimentos,
            'saidas': saidas_anuais,
            'saldo_liquido': saldo_liquido
        })
    
    return fluxo

# ================ ROTAS ================
@app.route('/')
def home():
    """Página inicial"""
    return '''
    <h1>🏢 Cimo Family Office</h1>
    <h2>📊 Plano Patrimonial Ana - v2.0</h2>
    <p><a href="/dashboard">📈 Ir para Dashboard</a></p>
    <p><a href="/api/teste">🧪 Testar API</a></p>
    <p><a href="/api/dados">📊 Ver Dados</a></p>
    '''

@app.route('/dashboard')
def dashboard():
    """Dashboard principal"""
    try:
        return render_template('index.html')
    except FileNotFoundError:
        return '''
        <h1>❌ Erro</h1>
        <p>Arquivo index.html não encontrado.</p>
        <p>Certifique-se de que o arquivo index.html está na mesma pasta que app.py</p>
        <p><a href="/">← Voltar</a></p>
        ''', 404

@app.route('/api/dados')
def api_dados():
    """API principal - retorna todos os dados (compatível com HTML)"""
    try:
        # Pegar parâmetros
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        
        # Calcular cenário principal
        resultado = calcular_compromissos(taxa, expectativa, despesas)
        status = determinar_status(resultado['fazenda'], resultado['percentual'])
        
        # Análise de sensibilidade (taxas de 2% a 8%)
        sensibilidade = []
        for t in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]:
            calc = calcular_compromissos(t, expectativa, despesas)
            sensibilidade.append({
                'taxa': t,
                'fazenda': calc['fazenda'],
                'percentual': calc['percentual']
            })
        
        # Asset allocation baseado em perfil moderado
        allocation = [
            {'nome': 'Renda Fixa BR', 'valor': 26000000, 'percentual': 40},
            {'nome': 'Renda Fixa Int', 'valor': 9750000, 'percentual': 15},
            {'nome': 'Multimercado', 'valor': 9750000, 'percentual': 15},
            {'nome': 'Ações BR', 'valor': 6500000, 'percentual': 10},
            {'nome': 'Ações Int', 'valor': 6500000, 'percentual': 10},
            {'nome': 'REITs', 'valor': 3250000, 'percentual': 5},
            {'nome': 'Reserva', 'valor': 3250000, 'percentual': 5}
        ]
        
        # Projeção de fluxo de caixa
        fluxo_caixa = gerar_projecao_fluxo(taxa)
        
        return jsonify({
            'success': True,
            'patrimonio': PATRIMONIO,
            'resultado': resultado,
            'sensibilidade': sensibilidade,
            'allocation': allocation,
            'status': status,
            'fluxo_caixa': fluxo_caixa,
            'parametros': {
                'taxa': taxa,
                'expectativa': expectativa,
                'despesas': despesas
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'erro': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/teste')
def api_teste():
    """Teste simples da API (health check)"""
    return jsonify({
        'status': 'OK',
        'service': 'Cimo Family Office API',
        'version': '2.0',
        'patrimonio': f'R$ {PATRIMONIO:,.0f}',
        'cliente': f'Ana, {IDADE_ANA} anos',
        'despesas_base': f'R$ {DESPESAS_BASE:,.0f}/mês',
        'server_time': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
        'endpoints': {
            'dashboard': '/dashboard',
            'dados': '/api/dados',
            'teste': '/api/teste',
            'logo': '/api/logo'
        }
    })

@app.route('/api/health')
def api_health():
    """Health check endpoint adicional"""
    return api_teste()

@app.route('/api/logo')
def logo():
    """Logo da Cimo em SVG"""
    svg = '''<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
            </linearGradient>
        </defs>
        <g transform="translate(10, 15)">
            <path d="M0,15 Q15,5 30,15 Q35,20 30,25 Q15,35 0,25 Z" fill="url(#grad)" opacity="0.9"/>
        </g>
        <text x="50" y="25" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e293b">CIMO</text>
        <text x="50" y="40" font-family="Inter, Arial, sans-serif" font-size="8" fill="#64748b">Multi Family Office</text>
    </svg>'''
    return svg, 200, {'Content-Type': 'image/svg+xml'}

@app.route('/api/cenarios')
def api_cenarios():
    """Endpoint para análise de cenários específicos"""
    try:
        # Cenários predefinidos
        cenarios = [
            {'nome': 'Conservador', 'taxa': 3.0, 'expectativa': 90, 'despesas': 120000},
            {'nome': 'Moderado', 'taxa': 4.0, 'expectativa': 90, 'despesas': 150000},
            {'nome': 'Agressivo', 'taxa': 5.5, 'expectativa': 90, 'despesas': 180000},
            {'nome': 'Stress Test', 'taxa': 2.5, 'expectativa': 95, 'despesas': 200000}
        ]
        
        resultados = []
        for cenario in cenarios:
            resultado = calcular_compromissos(
                cenario['taxa'], 
                cenario['expectativa'], 
                cenario['despesas']
            )
            resultado['nome'] = cenario['nome']
            resultado['parametros'] = cenario
            resultado['status'] = determinar_status(resultado['fazenda'], resultado['percentual'])
            resultados.append(resultado)
        
        return jsonify({
            'success': True,
            'cenarios': resultados,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'erro': str(e)
        }), 500

# ================ MIDDLEWARE E HANDLERS ================
@app.errorhandler(404)
def not_found(error):
    """Handler para páginas não encontradas"""
    return jsonify({
        'erro': 'Endpoint não encontrado',
        'endpoints_disponiveis': [
            '/',
            '/dashboard',
            '/api/dados',
            '/api/teste',
            '/api/health',
            '/api/logo',
            '/api/cenarios'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handler para erros internos"""
    return jsonify({
        'erro': 'Erro interno do servidor',
        'message': 'Contate o administrador do sistema'
    }), 500

@app.before_request
def log_request():
    """Log das requisições (desenvolvimento)"""
    if app.debug:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {request.method} {request.path}")

@app.after_request
def after_request(response):
    """Headers de segurança e CORS"""
    response.headers.add('X-Content-Type-Options', 'nosniff')
    response.headers.add('X-Frame-Options', 'DENY')
    response.headers.add('X-XSS-Protection', '1; mode=block')
    return response

# ================ INICIALIZAÇÃO ================
if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Cimo Family Office - Plano Patrimonial v2.0")
    print("=" * 60)
    print(f"📊 Patrimônio Ana: R$ {PATRIMONIO:,.0f}")
    print(f"👤 Idade atual: {IDADE_ANA} anos")
    print(f"💰 Despesas base: R$ {DESPESAS_BASE:,.0f}/mês")
    print("=" * 60)
    print("🌐 Servidor rodando em:")
    print("   • Home: http://localhost:5000")
    print("   • Dashboard: http://localhost:5000/dashboard")
    print("   • API Dados: http://localhost:5000/api/dados")
    print("   • API Teste: http://localhost:5000/api/teste")
    print("=" * 60)
    print("💡 Dica: Use Ctrl+C para parar o servidor")
    print("📁 Certifique-se de que index.html está na mesma pasta!")
    print("=" * 60)
    
    # Verificar se index.html existe
    if not os.path.exists('templates/index.html'):
        print("⚠️  AVISO: index.html não encontrado na pasta atual!")
        print("   O dashboard não funcionará até que o arquivo seja criado.")
        print("=" * 60)
    
    # Executar servidor
    app.run(
        debug=True, 
        host='0.0.0.0', 
        port=5000,
        use_reloader=True,
        threaded=True
    )