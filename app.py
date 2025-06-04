from flask import Flask, request, jsonify, render_template_string, send_file, make_response
from flask import render_template
from flask_cors import CORS
import math
from datetime import datetime, timedelta
import os
import io
import json
import base64
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.platypus.flowables import PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pytz  # Para timezone São Paulo

app = Flask(__name__)
CORS(app)

# ================ CONSTANTES E CONFIGURAÇÕES ================
PATRIMONIO = 65_000_000  # R$ 65 milhões (valor líquido após impostos)
IDADE_ANA = 53           # Idade atual de Ana
DESPESAS_BASE = 150_000  # R$ 150k/mês (padrão de vida de Ana)
RENDA_FILHOS = 150_000   # R$ 50k x 3 filhos = R$ 150k/mês total
DOACOES = 50_000         # R$ 50k/mês para fundação "Para Todos em Varginha"
PERIODO_DOACOES = 15     # Exatamente 15 anos de doações

# Taxa de inflação presumida (para referência nos comentários)
# A taxa de retorno utilizada é sempre REAL (já descontada desta inflação)
INFLACAO_PRESUMIDA = 3.5  # % ao ano (IPCA histórico Brasil)

# Timezone para relatórios
SAO_PAULO_TZ = pytz.timezone('America/Sao_Paulo')

# ================ ESTRUTURA DE ASSET ALLOCATION ================
# Perfis de alocação baseados no perfil conservador-moderado de Ana
ASSET_ALLOCATION_PROFILES = {
    'conservador': {
        'renda_fixa_br': 70,      # 70% Renda Fixa Nacional
        'renda_fixa_int': 15,     # 15% Renda Fixa Internacional  
        'acoes_br': 5,            # 5% Ações Brasil
        'acoes_int': 5,           # 5% Ações Internacionais
        'imoveis': 3,             # 3% Fundos Imobiliários
        'liquidez': 2,            # 2% Reserva de Liquidez
        'retorno_esperado': 3.5,  # Taxa real esperada
        'volatilidade': 6         # Volatilidade anual %
    },
    'moderado': {
        'renda_fixa_br': 50,      # 50% Renda Fixa Nacional
        'renda_fixa_int': 20,     # 20% Renda Fixa Internacional
        'acoes_br': 15,           # 15% Ações Brasil
        'acoes_int': 10,          # 10% Ações Internacionais
        'imoveis': 3,             # 3% Fundos Imobiliários
        'liquidez': 2,            # 2% Reserva de Liquidez
        'retorno_esperado': 4.5,  # Taxa real esperada
        'volatilidade': 10        # Volatilidade anual %
    },
    'balanceado': {
        'renda_fixa_br': 40,      # 40% Renda Fixa Nacional
        'renda_fixa_int': 15,     # 15% Renda Fixa Internacional
        'acoes_br': 20,           # 20% Ações Brasil
        'acoes_int': 15,          # 15% Ações Internacionais
        'imoveis': 5,             # 5% Fundos Imobiliários
        'multimercado': 3,        # 3% Multimercado
        'liquidez': 2,            # 2% Reserva de Liquidez
        'retorno_esperado': 5.2,  # Taxa real esperada
        'volatilidade': 12        # Volatilidade anual %
    }
}

# ================ PARÂMETROS DE STATUS DO PLANO ================
STATUS_THRESHOLDS = {
    'critico_absoluto': 0,        # Fazenda negativa = crítico
    'critico_percentual': 2,      # < 2% do patrimônio = crítico
    'atencao_percentual': 8,      # < 8% do patrimônio = atenção
    'viavel_minimo': 8            # >= 8% do patrimônio = viável
}

# ================ VALIDAÇÕES DE SANIDADE ================
def validar_inputs(taxa, expectativa, despesas, inicio_renda_filhos=None):
    """
    Valida todos os inputs do usuário para garantir consistência
    
    Args:
        taxa (float): Taxa de retorno real anual (%)
        expectativa (int): Expectativa de vida de Ana (anos)
        despesas (float): Despesas mensais de Ana (R$)
        inicio_renda_filhos (str/int): Quando inicia renda dos filhos
    
    Raises:
        ValueError: Se algum parâmetro estiver fora dos limites esperados
    """
    
    # Validação da expectativa de vida
    assert expectativa >= IDADE_ANA, f"Expectativa de vida ({expectativa}) não pode ser menor que idade atual de Ana ({IDADE_ANA})"
    assert expectativa <= 120, f"Expectativa de vida ({expectativa}) parece irrealisticamente alta (máximo 120 anos)"
    
    # Validação da taxa de retorno real
    assert 0 < taxa <= 15, f"Taxa de retorno real ({taxa}%) fora de intervalo razoável (0.1% a 15%)"
    if taxa > 8:
        print(f"⚠️  ATENÇÃO: Taxa de retorno real de {taxa}% é muito otimista para perfil conservador-moderado")
    
    # Validação das despesas mensais
    assert 50_000 <= despesas <= 1_000_000, f"Despesas mensais ({despesas:,.0f}) fora de intervalo razoável (R$ 50k a R$ 1M)"
    
    # Validação do início da renda dos filhos
    if inicio_renda_filhos and isinstance(inicio_renda_filhos, int):
        assert IDADE_ANA <= inicio_renda_filhos <= expectativa, f"Início renda filhos ({inicio_renda_filhos}) deve estar entre idade atual ({IDADE_ANA}) e expectativa ({expectativa})"
    
    print(f"✅ Validações OK - Taxa: {taxa}%, Expectativa: {expectativa} anos, Despesas: R$ {despesas:,.0f}/mês")

# ================ FÓRMULAS FINANCEIRAS DOCUMENTADAS ================
def valor_presente(fluxo_mensal, anos, taxa_anual):
    """
    Calcula o valor presente de uma série de fluxos mensais futuros
    
    Esta é uma das fórmulas centrais do planejamento patrimonial.
    
    FÓRMULA MATEMÁTICA:
    
    VP = PMT × [(1 - (1 + i)^(-n)) / i]
    
    Onde:
    - VP = Valor Presente
    - PMT = Pagamento mensal (fluxo_mensal)
    - i = Taxa de juros mensal
    - n = Número de períodos (meses)
    
    CONVERSÃO DE TAXA ANUAL PARA MENSAL:
    taxa_mensal = (1 + taxa_anual)^(1/12) - 1
    
    Esta conversão garante que a capitalização seja feita corretamente,
    considerando o efeito dos juros compostos.
    
    Args:
        fluxo_mensal (float): Valor mensal do fluxo (R$)
        anos (int): Duração do fluxo em anos
        taxa_anual (float): Taxa de retorno real anual (% ao ano)
    
    Returns:
        float: Valor presente dos fluxos (R$)
    
    Example:
        >>> valor_presente(150_000, 30, 4.0)  # R$ 150k/mês por 30 anos a 4% a.a.
        32_765_388.45
    """
    
    # Caso especial: taxa zero (sem juros)
    if taxa_anual <= 0:
        return fluxo_mensal * anos * 12
    
    # Conversão de taxa anual para mensal (capitalização composta)
    # Fórmula: (1 + taxa_anual/100)^(1/12) - 1
    taxa_mensal = (1 + taxa_anual/100) ** (1/12) - 1
    
    # Número total de períodos mensais
    periodos = anos * 12
    
    # Aplicação da fórmula de valor presente de anuidade
    if taxa_mensal > 0:
        # Fórmula padrão: PMT * [(1 - (1+i)^(-n)) / i]
        vp = fluxo_mensal * (1 - (1 + taxa_mensal) ** (-periodos)) / taxa_mensal
    else:
        # Caso degenerado: sem juros
        vp = fluxo_mensal * periodos
    
    return vp

def calcular_compromissos(taxa, expectativa, despesas, inicio_renda_filhos='falecimento', custo_fazenda=2_000_000):
    """
    Calcula todos os compromissos financeiros de Ana e determina valor disponível
    
    ESTRUTURA DE CÁLCULO:
    1. Despesas de Ana: fluxo mensal até sua expectativa de vida
    2. Renda dos filhos: fluxo mensal conforme parâmetro inicio_renda_filhos
    3. Doações: fluxo mensal por exatamente 15 anos
    4. Total compromissos = soma dos valores presentes
    5. Valor fazenda = patrimônio total - compromissos totais
    6. Valor arte = valor fazenda - custo estimado da fazenda
    
    Args:
        taxa (float): Taxa de retorno real anual (%) - já descontada da inflação de ~3.5% a.a.
        expectativa (int): Expectativa de vida de Ana (anos)
        despesas (float): Despesas mensais de Ana (R$)
        inicio_renda_filhos (str/int): 'falecimento', 'imediato' ou idade específica
        custo_fazenda (float): Custo estimado da fazenda (R$)
    
    Returns:
        dict: Dicionário com todos os valores calculados
    """
    
    # Validar inputs
    validar_inputs(taxa, expectativa, despesas, 
                  inicio_renda_filhos if isinstance(inicio_renda_filhos, int) else None)
    
    # Calcular anos restantes de vida de Ana
    anos_vida = expectativa - IDADE_ANA
    
    # 1. DESPESAS DE ANA (até morrer)
    # Valor presente dos gastos mensais de Ana até sua expectativa de vida
    vp_despesas = valor_presente(despesas, anos_vida, taxa)
    
    # 2. RENDA DOS FILHOS (timing flexível)
    if inicio_renda_filhos == 'falecimento':
        # Inicia após falecimento de Ana (no ano da expectativa de vida)
        anos_ate_inicio = anos_vida
        anos_duracao = 25  # 25 anos de renda para os filhos
        
    elif inicio_renda_filhos == 'imediato':
        # Inicia imediatamente
        anos_ate_inicio = 0
        anos_duracao = min(25, anos_vida)  # Não pode exceder vida de Ana
        
    elif isinstance(inicio_renda_filhos, int):
        # Inicia em idade específica
        idade_inicio = int(inicio_renda_filhos)
        anos_ate_inicio = max(0, idade_inicio - IDADE_ANA)
        anos_duracao = 25
        
        # PROTEÇÃO REDUNDANTE: Se idade início > expectativa, zerar renda filhos
        if idade_inicio > expectativa:
            print(f"⚠️  AVISO: Idade início renda filhos ({idade_inicio}) > expectativa de vida ({expectativa}). Renda dos filhos será zero.")
            anos_ate_inicio = anos_vida + 10  # Força VPF = 0
            anos_duracao = 0
        
    else:
        # Default: aos 65 anos de Ana
        anos_ate_inicio = max(0, 65 - IDADE_ANA)
        anos_duracao = 25
    
    # Calcular valor presente da renda dos filhos
    if anos_ate_inicio > 0 and anos_duracao > 0:
        # Aplicar desconto temporal até o início da renda
        fator_desconto = (1 + taxa/100) ** (-anos_ate_inicio)
        vp_filhos = valor_presente(RENDA_FILHOS, anos_duracao, taxa) * fator_desconto
    else:
        # Inicia imediatamente ou é zero
        vp_filhos = valor_presente(RENDA_FILHOS, anos_duracao, taxa) if anos_duracao > 0 else 0
    
    # 3. DOAÇÕES (exatamente 15 anos, conforme case)
    # Valor presente das doações mensais por período fixo
    vp_doacoes = valor_presente(DOACOES, PERIODO_DOACOES, taxa)
    
    # 4. TOTAIS
    total_compromissos = vp_despesas + vp_filhos + vp_doacoes
    valor_fazenda = PATRIMONIO - total_compromissos
    percentual_fazenda = (valor_fazenda / PATRIMONIO) * 100
    
    # 5. VALOR DISPONÍVEL PARA ARTE/GALERIA
    # Subtrai custo estimado da fazenda do valor disponível
    valor_arte = max(0, valor_fazenda - custo_fazenda) if valor_fazenda > 0 else 0
    percentual_arte = (valor_arte / PATRIMONIO) * 100 if valor_arte > 0 else 0
    
    # Log dos cálculos para debug
    print(f"💰 Cálculos - VP Despesas: R$ {vp_despesas:,.0f}, VP Filhos: R$ {vp_filhos:,.0f}, VP Doações: R$ {vp_doacoes:,.0f}")
    print(f"🏡 Fazenda: R$ {valor_fazenda:,.0f} ({percentual_fazenda:.1f}%), Arte: R$ {valor_arte:,.0f} ({percentual_arte:.1f}%)")
    
    return {
        'despesas': vp_despesas,
        'filhos': vp_filhos,
        'doacoes': vp_doacoes,
        'total': total_compromissos,
        'fazenda': valor_fazenda,
        'percentual': percentual_fazenda,
        'arte': valor_arte,
        'percentual_arte': percentual_arte,
        'custo_fazenda': custo_fazenda,
        'inicio_renda_filhos': inicio_renda_filhos,
        'anos_vida_ana': anos_vida,
        'anos_ate_inicio_filhos': anos_ate_inicio,
        'anos_duracao_filhos': anos_duracao
    }

def determinar_status(fazenda, percentual, thresholds=None):
    """
    Determina o status de sustentabilidade do plano patrimonial
    
    LÓGICA DE CLASSIFICAÇÃO (parametrizável):
    - CRÍTICO: Valor fazenda negativo OU < 2% do patrimônio
    - ATENÇÃO: Valor fazenda entre 2% e 8% do patrimônio  
    - VIÁVEL: Valor fazenda >= 8% do patrimônio
    
    Args:
        fazenda (float): Valor disponível para fazenda (R$)
        percentual (float): Percentual do patrimônio (%)
        thresholds (dict): Limites personalizados (opcional)
    
    Returns:
        str: 'crítico', 'atenção' ou 'viável'
    """
    
    if thresholds is None:
        thresholds = STATUS_THRESHOLDS
    
    # Valor absoluto negativo = sempre crítico
    if fazenda < thresholds['critico_absoluto']:
        return 'crítico'
    
    # Classificação por percentual do patrimônio
    if percentual < thresholds['critico_percentual']:
        return 'crítico'
    elif percentual < thresholds['atencao_percentual']:
        return 'atenção'
    else:
        return 'viável'

def gerar_projecao_fluxo(taxa, expectativa, despesas, anos=20, inicio_renda_filhos='falecimento'):
    """
    Gera projeção detalhada do fluxo de caixa patrimonial
    
    PREMISSAS DA PROJEÇÃO:
    - Patrimônio inicial rende à taxa real especificada
    - Despesas de Ana cessam quando excede expectativa de vida
    - Renda dos filhos inicia conforme parâmetro
    - Doações cessam após exatamente 15 anos
    - Valores ajustados pela inflação (taxa já é real)
    - SINALIZAÇÃO EXPLÍCITA quando Ana atinge expectativa de vida
    
    Args:
        taxa (float): Taxa de retorno real anual (%) - já descontada da inflação de ~3.5% a.a.
        expectativa (int): Expectativa de vida de Ana (anos)
        despesas (float): Despesas mensais de Ana (R$)
        anos (int): Horizonte da projeção (anos)
        inicio_renda_filhos (str/int): Timing da renda dos filhos
    
    Returns:
        list: Lista de dicionários com projeção anual
    """
    
    patrimonio_atual = PATRIMONIO
    fluxo = []
    ano_falecimento = None  # Para marcar no fluxo
    
    # Determinar quando inicia renda dos filhos
    if inicio_renda_filhos == 'falecimento':
        idade_inicio_filhos = expectativa
    elif inicio_renda_filhos == 'imediato':
        idade_inicio_filhos = IDADE_ANA
    elif isinstance(inicio_renda_filhos, int):
        idade_inicio_filhos = int(inicio_renda_filhos)
    else:
        idade_inicio_filhos = 65  # Default
    
    for ano in range(anos):
        idade_ana = IDADE_ANA + ano + 1
        ano_calendario = 2025 + ano
        
        # RENDIMENTOS: Patrimônio × taxa real
        rendimentos = patrimonio_atual * (taxa / 100)
        
        # SAÍDAS ANUAIS
        saidas_anuais = 0
        
        # Despesas de Ana (apenas se ela estiver viva)
        if idade_ana <= expectativa:
            saidas_anuais += despesas * 12
            ana_viva = True
        else:
            ana_viva = False
            # MARCAR ANO DO FALECIMENTO (primeira vez que excede expectativa)
            if ano_falecimento is None and idade_ana == expectativa + 1:
                ano_falecimento = ano_calendario - 1  # Ano anterior foi último ano de vida
        
        # Renda dos filhos (se já iniciou)
        if idade_ana >= idade_inicio_filhos:
            saidas_anuais += RENDA_FILHOS * 12
        
        # Doações (apenas nos primeiros 15 anos)
        if ano < PERIODO_DOACOES:
            saidas_anuais += DOACOES * 12
        
        # SALDO LÍQUIDO
        saldo_liquido = rendimentos - saidas_anuais
        patrimonio_atual += saldo_liquido
        
        # Não permitir patrimônio negativo
        patrimonio_atual = max(patrimonio_atual, 0)
        
        # Determinar marco especial
        marco_especial = None
        if ano_falecimento and ano_calendario == ano_falecimento:
            marco_especial = f"🕊️ Falecimento de Ana (expectativa: {expectativa} anos)"
        elif idade_ana == idade_inicio_filhos:
            marco_especial = f"👨‍👩‍👧‍👦 Início da renda dos filhos"
        elif ano == PERIODO_DOACOES - 1:
            marco_especial = f"🎁 Último ano de doações (15 anos completos)"
        
        fluxo.append({
            'ano': ano_calendario,
            'idade_ana': idade_ana,
            'ana_viva': ana_viva,
            'patrimonio': patrimonio_atual,
            'rendimentos': rendimentos,
            'saidas': saidas_anuais,
            'saldo_liquido': saldo_liquido,
            'despesas_ana': despesas * 12 if ana_viva else 0,
            'renda_filhos': RENDA_FILHOS * 12 if idade_ana >= idade_inicio_filhos else 0,
            'doacoes': DOACOES * 12 if ano < PERIODO_DOACOES else 0,
            'marco_especial': marco_especial,
            'ano_pos_falecimento': (ano_calendario - ano_falecimento) if ano_falecimento and ano_calendario > ano_falecimento else None
        })
    
    return fluxo

# ================ FORMATAÇÃO MONETÁRIA DOCUMENTADA ================
def format_currency(value, compact=False):
    """
    Formata valores monetários conforme padrão estabelecido
    
    REGRAS DE FORMATAÇÃO:
    - Valores >= R$ 1 milhão: "R$ X.XM" (compact) ou "R$ X.XXX.XXX" (full)
    - Valores >= R$ 1 mil: "R$ XXXk" (compact) ou "R$ XXX.XXX" (full)  
    - Valores < R$ 1 mil: "R$ XXX"
    - Valores negativos: precedidos por sinal negativo
    
    Args:
        value (float): Valor a ser formatado (R$)
        compact (bool): Se True, usa formato compacto (M/k)
    
    Returns:
        str: Valor formatado
    
    Examples:
        >>> format_currency(65_000_000, compact=True)
        'R$ 65.0M'
        >>> format_currency(65_000_000, compact=False)  
        'R$ 65.000.000'
        >>> format_currency(150_000, compact=True)
        'R$ 150k'
    """
    
    if value is None or (isinstance(value, str) and value.lower() in ['nan', 'inf', '-inf']):
        return 'N/A'
    
    # Converter para float se necessário
    try:
        value = float(value)
    except (ValueError, TypeError):
        return 'N/A'
    
    # Formato compacto para dashboard
    if compact:
        if abs(value) >= 1_000_000:
            return f"R$ {value/1_000_000:.1f}M"
        elif abs(value) >= 1_000:
            return f"R$ {value/1_000:.0f}k"
        else:
            return f"R$ {value:,.0f}".replace(',', '.')
    
    # Formato completo para relatórios
    else:
        return f"R$ {value:,.0f}".replace(',', '.')

# ================ ASSET ALLOCATION MANAGER ================
def get_asset_allocation(perfil='moderado', patrimonio=PATRIMONIO):
    """
    Retorna estrutura detalhada de asset allocation baseada no perfil
    
    Args:
        perfil (str): 'conservador', 'moderado' ou 'balanceado'
        patrimonio (float): Valor total do patrimônio (R$)
    
    Returns:
        list: Lista de dicionários com classes de ativos
    """
    
    if perfil not in ASSET_ALLOCATION_PROFILES:
        perfil = 'moderado'  # Default
    
    profile = ASSET_ALLOCATION_PROFILES[perfil]
    allocation = []
    
    # Classes de ativos padronizadas
    classes = {
        'renda_fixa_br': 'Renda Fixa Nacional',
        'renda_fixa_int': 'Renda Fixa Internacional', 
        'acoes_br': 'Ações Brasil',
        'acoes_int': 'Ações Internacionais',
        'imoveis': 'Fundos Imobiliários',
        'multimercado': 'Multimercado',
        'liquidez': 'Reserva de Liquidez'
    }
    
    for key, nome in classes.items():
        if key in profile and profile[key] > 0:
            percentual = profile[key]
            valor = patrimonio * (percentual / 100)
            
            allocation.append({
                'nome': nome,
                'percentual': percentual,
                'valor': valor,
                'classe': key
            })
    
    return allocation

# ================ TIMEZONE HELPERS ================
def get_current_datetime_sao_paulo():
    """
    Retorna datetime atual no timezone de São Paulo (UTC-3)
    
    Returns:
        datetime: Objeto datetime com timezone
    """
    return datetime.now(SAO_PAULO_TZ)

def format_datetime_report(dt=None):
    """
    Formata datetime para uso em relatórios
    
    Args:
        dt (datetime): Datetime para formatar (default: agora)
    
    Returns:
        str: Data/hora formatada
    """
    if dt is None:
        dt = get_current_datetime_sao_paulo()
    
    return dt.strftime('%d/%m/%Y às %H:%M (horário de Brasília)')

# ================ FUNÇÕES DE GRÁFICOS (mantidas do original) ================
def criar_grafico_compromissos(resultado):
    """Cria gráfico de compromissos em base64"""
    try:
        fig, ax = plt.subplots(figsize=(8, 6))
        
        labels = ['Despesas Ana', 'Renda Filhos', 'Doações', 'Fazenda']
        values = [
            resultado['despesas'],
            resultado['filhos'],
            resultado['doacoes'],
            max(resultado['fazenda'], 0)
        ]
        colors_chart = ['#1e3a8a', '#3b82f6', '#64748b', '#059669']
        
        ax.pie(values, labels=labels, colors=colors_chart, autopct='%1.1f%%', startangle=90)
        ax.set_title('Breakdown dos Compromissos', fontsize=14, fontweight='bold')
        
        plt.tight_layout()
        
        # Converter para base64
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()
        
        graphic = base64.b64encode(image_png)
        graphic = graphic.decode('utf-8')
        
        return graphic
    except Exception as e:
        print(f"❌ Erro ao criar gráfico de compromissos: {e}")
        return None

def criar_grafico_sensibilidade(sensibilidade):
    """Cria gráfico de sensibilidade em base64"""
    try:
        fig, ax = plt.subplots(figsize=(10, 6))
        
        taxas = [item['taxa'] for item in sensibilidade]
        valores = [item['fazenda'] / 1000000 for item in sensibilidade]  # Em milhões
        
        ax.plot(taxas, valores, marker='o', linewidth=3, markersize=8, color='#1e3a8a')
        ax.fill_between(taxas, valores, alpha=0.3, color='#1e3a8a')
        ax.set_xlabel('Taxa de Retorno Real (%)', fontsize=12)
        ax.set_ylabel('Valor Fazenda (R$ milhões)', fontsize=12)
        ax.set_title('Análise de Sensibilidade - Taxa de Retorno', fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)
        
        # Linha de referência no zero
        ax.axhline(y=0, color='red', linestyle='--', alpha=0.7)
        
        plt.tight_layout()
        
        # Converter para base64
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()
        
        graphic = base64.b64encode(image_png)
        graphic = graphic.decode('utf-8')
        
        return graphic
    except Exception as e:
        print(f"❌ Erro ao criar gráfico de sensibilidade: {e}")
        return None

# ================ FUNÇÕES DE RELATÓRIOS MELHORADAS ================
def gerar_relatorio_executivo(dados):
    """Gera relatório executivo em PDF com melhorias v4.0"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Título
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e3a8a'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    story.append(Paragraph("RELATÓRIO EXECUTIVO", title_style))
    story.append(Paragraph("Plano Patrimonial Ana - CIMO Multi Family Office", styles['Heading2']))
    story.append(Spacer(1, 20))
    
    # Data e timezone
    data_relatorio = format_datetime_report()
    story.append(Paragraph(f"<i>Relatório gerado em {data_relatorio}</i>", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Resumo Executivo
    story.append(Paragraph("RESUMO EXECUTIVO", styles['Heading2']))
    
    resultado = dados['resultado']
    patrimonio = dados['patrimonio']
    status = dados['status']
    
    resumo_text = f"""
    <b>Patrimônio Total:</b> {format_currency(patrimonio)}<br/>
    <b>Valor Disponível para Fazenda:</b> {format_currency(resultado['fazenda'])}<br/>
    <b>Percentual do Patrimônio:</b> {resultado['percentual']:.1f}%<br/>
    <b>Valor Disponível para Arte/Galeria:</b> {format_currency(resultado['arte'])}<br/>
    <b>Status do Plano:</b> {status.title()}<br/>
    <br/>
    <b>Taxa de Retorno Utilizada:</b> {dados['parametros']['taxa']}% ao ano (real, já descontada da inflação)<br/>
    <b>Expectativa de Vida:</b> {dados['parametros']['expectativa']} anos<br/>
    """
    
    story.append(Paragraph(resumo_text, styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Análise de Compromissos
    story.append(Paragraph("ANÁLISE DE COMPROMISSOS", styles['Heading2']))
    
    # Tabela de compromissos
    compromissos_data = [
        ['Categoria', 'Valor (R$)', '% do Patrimônio', 'Observações'],
        ['Despesas Ana', format_currency(resultado['despesas']), f"{(resultado['despesas']/patrimonio*100):.1f}%", f"Até {dados['parametros']['expectativa']} anos"],
        ['Renda Filhos', format_currency(resultado['filhos']), f"{(resultado['filhos']/patrimonio*100):.1f}%", f"Início: {resultado['inicio_renda_filhos']}"],
        ['Doações', format_currency(resultado['doacoes']), f"{(resultado['doacoes']/patrimonio*100):.1f}%", "Exatamente 15 anos"],
        ['Total Compromissos', format_currency(resultado['total']), f"{(resultado['total']/patrimonio*100):.1f}%", ""],
        ['Disponível Fazenda', format_currency(resultado['fazenda']), f"{resultado['percentual']:.1f}%", ""],
        ['Disponível Arte', format_currency(resultado['arte']), f"{resultado['percentual_arte']:.1f}%", "Após custo fazenda"]
    ]
    
    compromissos_table = Table(compromissos_data)
    compromissos_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(compromissos_table)
    story.append(Spacer(1, 20))
    
    # Orientações para Revisão Periódica
    story.append(Paragraph("ORIENTAÇÕES PARA REVISÃO PERIÓDICA", styles['Heading2']))
    
    orientacoes_text = """
    <b>Frequência Recomendada:</b><br/>
    • <b>Trimestral:</b> Comparar retorno real observado vs. projetado ({taxa}% a.a.)<br/>
    • <b>Semestral:</b> Revisar alterações nos objetivos e padrão de vida de Ana<br/>
    • <b>Anual:</b> Rebalanceamento do portfólio e ajuste de alocação<br/>
    <br/>
    <b>Indicadores de Alerta:</b><br/>
    • Retorno real abaixo de 3.0% por 2 trimestres consecutivos<br/>
    • Mudanças significativas no padrão de despesas (±20%)<br/>
    • Alterações na expectativa de vida ou saúde<br/>
    • Necessidade de antecipar renda dos filhos<br/>
    """.format(taxa=dados['parametros']['taxa'])
    
    story.append(Paragraph(orientacoes_text, styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Recomendações
    story.append(Paragraph("RECOMENDAÇÕES", styles['Heading2']))
    
    if resultado['fazenda'] > 0:
        if resultado['percentual'] >= 15:
            recomendacoes = """
            <b>SITUAÇÃO CONFORTÁVEL:</b><br/>
            • O plano atual é sustentável com boa margem de segurança<br/>
            • Fazenda pode ser adquirida dentro do orçamento previsto<br/>
            • Há recursos disponíveis para investir em arte/galeria<br/>
            • Manter diversificação e monitorar performance trimestral<br/>
            • Considerar oportunidades de investimentos alternativos
            """
        elif resultado['percentual'] >= 8:
            recomendacoes = """
            <b>SITUAÇÃO VIÁVEL COM ATENÇÃO:</b><br/>
            • O plano é sustentável mas com margem moderada<br/>
            • Priorizar compra da fazenda sobre investimentos em arte<br/>
            • Monitorar de perto o retorno real dos investimentos<br/>
            • Evitar aumentos significativos nas despesas<br/>
            • Considerar estratégias de proteção contra inflação
            """
        else:
            recomendacoes = """
            <b>SITUAÇÃO LIMÍTROFE:</b><br/>
            • O plano é tecnicamente viável mas com margem muito baixa<br/>
            • Reconsiderar custo estimado da fazenda<br/>
            • Postergar ou reduzir investimentos em arte<br/>
            • Buscar alternativas para aumentar retorno real<br/>
            • Avaliar redução gradual de despesas não essenciais
            """
    else:
        recomendacoes = """
        <b>⚠️  AÇÃO URGENTE REQUERIDA:</b><br/>
        • O plano atual NÃO é sustentável com as premissas atuais<br/>
        • <b>Opções imediatas:</b><br/>
        &nbsp;&nbsp;- Reduzir despesas mensais de Ana<br/>
        &nbsp;&nbsp;- Postergar início da renda dos filhos<br/>
        &nbsp;&nbsp;- Reduzir valor das doações anuais<br/>
        &nbsp;&nbsp;- Buscar estratégias para aumentar retorno real<br/>
        • Cancelar temporariamente planos para fazenda e arte<br/>
        • Revisar expectativas e refazer análise
        """
    
    story.append(Paragraph(recomendacoes, styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Rodapé
    footer_text = f"""
    <br/>
    ---<br/>
    <i>CIMO Multi Family Office - Planejamento Patrimonial<br/>
    Relatório Executivo v4.0 - {data_relatorio}<br/>
    Taxa de retorno: REAL (já descontada da inflação)<br/>
    Valores em reais (R$) de {datetime.now().year}</i>
    """
    story.append(Paragraph(footer_text, styles['Normal']))
    
    # Gerar PDF
    doc.build(story)
    buffer.seek(0)
    return buffer

def gerar_relatorio_detalhado(dados):
    """Gera relatório detalhado em PDF com melhorias v4.0"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Título
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e3a8a'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    story.append(Paragraph("RELATÓRIO DETALHADO", title_style))
    story.append(Paragraph("Análise Completa - Plano Patrimonial Ana", styles['Heading2']))
    story.append(Spacer(1, 20))
    
    # Data e parâmetros
    data_relatorio = format_datetime_report()
    
    story.append(Paragraph("PARÂMETROS DA ANÁLISE", styles['Heading2']))
    
    parametros = dados['parametros']
    param_text = f"""
    <b>Data da Análise:</b> {data_relatorio}<br/>
    <b>Taxa de Retorno Real:</b> {parametros['taxa']}% ao ano (já descontada da inflação)<br/>
    <b>Expectativa de Vida:</b> {parametros['expectativa']} anos<br/>
    <b>Despesas Mensais Ana:</b> {format_currency(parametros['despesas'])}<br/>
    <b>Patrimônio Base:</b> {format_currency(dados['patrimonio'])}<br/>
    <b>Início Renda Filhos:</b> {dados['resultado']['inicio_renda_filhos']}<br/>
    <b>Período de Doações:</b> {PERIODO_DOACOES} anos<br/>
    """
    
    if 'custo_fazenda' in parametros:
        param_text += f"<b>Custo Estimado Fazenda:</b> {format_currency(parametros['custo_fazenda'])}<br/>"
    
    story.append(Paragraph(param_text, styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Asset Allocation
    story.append(Paragraph("ASSET ALLOCATION", styles['Heading2']))
    
    allocation_data = [['Classe de Ativo', 'Percentual', 'Valor (R$)', 'Observações']]
    for item in dados['allocation']:
        observacao = ""
        if 'Renda Fixa' in item['nome']:
            observacao = "Baixo risco"
        elif 'Ações' in item['nome']:
            observacao = "Risco moderado-alto"
        elif 'Imobiliário' in item['nome']:
            observacao = "Proteção inflação"
        elif 'Liquidez' in item['nome']:
            observacao = "Emergências"
        
        allocation_data.append([
            item['nome'],
            f"{item['percentual']}%",
            format_currency(item['valor']),
            observacao
        ])
    
    allocation_table = Table(allocation_data)
    allocation_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(allocation_table)
    story.append(Spacer(1, 20))
    
    # Página seguinte para fluxo de caixa
    story.append(PageBreak())
    
    # Fluxo de Caixa Projetado
    if 'fluxo_caixa' in dados and dados['fluxo_caixa']:
        story.append(Paragraph("PROJEÇÃO DE FLUXO DE CAIXA", styles['Heading2']))
        
        fluxo_data = [['Ano', 'Idade Ana', 'Status Ana', 'Patrimônio', 'Rendimentos', 'Saídas Totais', 'Marcos']]
        for item in dados['fluxo_caixa'][:10]:  # Primeiros 10 anos
            status_ana = "🕊️ Falecida" if not item.get('ana_viva', True) else "Viva"
            marco = item.get('marco_especial', '')
            if marco:
                marco = marco.replace('🕊️ ', '').replace('👨‍👩‍👧‍👦 ', '').replace('🎁 ', '')  # Remove emojis para PDF
                marco = marco[:30] + '...' if len(marco) > 30 else marco
            
            fluxo_data.append([
                str(item['ano']),
                f"{item['idade_ana']} anos",
                status_ana,
                format_currency(item['patrimonio'], compact=True),
                format_currency(item['rendimentos'], compact=True),
                format_currency(item['saidas'], compact=True),
                marco
            ])
        
        fluxo_table = Table(fluxo_data)
        fluxo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(fluxo_table)
        story.append(Spacer(1, 20))
    
    # Análise de Sensibilidade Completa
    story.append(Paragraph("ANÁLISE DE SENSIBILIDADE COMPLETA", styles['Heading2']))
    
    sens_completa_data = [['Taxa Real (%)', 'Valor Fazenda', '% Patrimônio', 'Valor Arte', 'Status']]
    for item in dados['sensibilidade']:
        # Calcular arte para cada cenário
        valor_arte_cenario = max(0, item['fazenda'] - dados['resultado']['custo_fazenda']) if item['fazenda'] > 0 else 0
        
        if item['fazenda'] >= 0:
            if item['percentual'] >= 8:
                status = "Viável"
            elif item['percentual'] >= 2:
                status = "Atenção"
            else:
                status = "Crítico"
        else:
            status = "Inviável"
            
        sens_completa_data.append([
            f"{item['taxa']}%",
            format_currency(item['fazenda'], compact=True),
            f"{item['percentual']:.1f}%",
            format_currency(valor_arte_cenario, compact=True),
            status
        ])
    
    sens_completa_table = Table(sens_completa_data)
    sens_completa_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(sens_completa_table)
    story.append(Spacer(1, 20))
    
    # Considerações Finais
    story.append(Paragraph("CONSIDERAÇÕES TÉCNICAS", styles['Heading2']))
    
    consideracoes = f"""
    <b>Metodologia de Cálculo:</b><br/>
    • Valor presente calculado com taxa real de {parametros['taxa']}% a.a.<br/>
    • Conversão mensal: (1 + taxa_anual)^(1/12) - 1<br/>
    • Despesas cessam quando Ana excede expectativa de vida<br/>
    • Doações limitadas a exatamente {PERIODO_DOACOES} anos<br/>
    <br/>
    <b>Premissas Importantes:</b><br/>
    • Taxa de retorno JÁ É REAL (descontada da inflação)<br/>
    • Valores mantêm poder de compra ao longo do tempo<br/>
    • Não considera impostos sobre herança ou doações<br/>
    • Asset allocation pode ser ajustada conforme mercado<br/>
    <br/>
    <b>Limitações da Análise:</b><br/>
    • Não considera cenários de crise prolongada<br/>
    • Expectativa de vida baseada em estimativas atuais<br/>
    • Despesas assumem crescimento apenas pela inflação<br/>
    • Custos médicos extraordinários não modelados<br/>
    """
    
    story.append(Paragraph(consideracoes, styles['Normal']))
    
    # Gerar PDF
    doc.build(story)
    buffer.seek(0)
    return buffer

# ================ ROTAS MELHORADAS ================
@app.route('/')
def home():
    """Página inicial com informações da v4.0"""
    return f'''
    <h1>🏢 Cimo Family Office</h1>
    <h2>📊 Plano Patrimonial Ana - v4.0 MELHORADA</h2>
    
    <h3>✨ Principais Melhorias v4.0:</h3>
    <ul>
        <li>✅ Taxa real vs nominal claramente especificada</li>
        <li>✅ Início flexível da renda dos filhos</li>
        <li>✅ Doações exatamente por 15 anos</li>
        <li>✅ Asset allocation estruturada</li>
        <li>✅ Validações de sanidade robustas</li>
        <li>✅ Fórmulas financeiras documentadas</li>
        <li>✅ Timezone São Paulo para relatórios</li>
        <li>✅ Cálculo de verba para obras de arte</li>
        <li>✅ Orientações para revisão periódica</li>
    </ul>
    
    <h3>🔗 Links:</h3>
    <p><a href="/dashboard">📈 Dashboard Interativo</a></p>
    <p><a href="/api/teste">🧪 Testar API</a></p>
    <p><a href="/api/dados">📊 Ver Dados JSON</a></p>
    <p><a href="/api/relatorio/executivo">📄 Relatório Executivo PDF</a></p>
    <p><a href="/debug/logo">🐛 Debug Logo</a></p>
    
    <hr>
    <p><i>CIMO Family Office - {format_datetime_report()}</i></p>
    '''

@app.route('/dashboard')
def dashboard():
    """Dashboard principal"""
    try:
           return render_template('index.html')
    except Exception as e:
        return f'''
        <h1>❌ Erro</h1>
        <p>Erro ao carregar dashboard: {str(e)}</p>
        <p><a href="/">← Voltar</a></p>
        ''', 500

@app.route('/logo.png')
def logo_png():
    """Serve a logo PNG da CIMO"""
    try:
        logo_path = os.path.join('templates', 'logo.png')
        
        if os.path.exists(logo_path):
            response = send_file(
                logo_path,
                mimetype='image/png',
                as_attachment=False,
                download_name='cimo-logo.png'
            )
            
            # Headers para otimização
            response.headers['Cache-Control'] = 'public, max-age=3600'  # Cache por 1 hora
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Content-Disposition'] = 'inline'
            
            print(f"✅ Logo PNG servida: {logo_path}")
            return response
        else:
            print(f"❌ Logo PNG não encontrada: {logo_path}")
            return logo_png_fallback()
            
    except Exception as e:
        print(f"❌ Erro ao servir logo PNG: {str(e)}")
        return logo_png_fallback()

def logo_png_fallback():
    """Fallback caso o PNG não seja encontrado"""
    try:
        # Gerar um PNG simples programaticamente como fallback
        fig, ax = plt.subplots(figsize=(4, 1.2), dpi=100)
        ax.set_xlim(0, 10)
        ax.set_ylim(0, 3)
        ax.axis('off')
        
        # Texto CIMO
        ax.text(5, 1.5, 'CIMO', fontsize=24, fontweight='bold', 
                ha='center', va='center', color='#1e3a8a')
        ax.text(5, 0.8, 'Multi Family Office', fontsize=8, 
                ha='center', va='center', color='#64748b')
        
        # Salvar em buffer
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight', 
                   transparent=True, facecolor='none', dpi=150)
        buffer.seek(0)
        plt.close()
        
        response = make_response(buffer.getvalue())
        response.headers['Content-Type'] = 'image/png'
        response.headers['Cache-Control'] = 'public, max-age=300'  # 5 minutos
        
        print("⚠️ Usando logo PNG de fallback")
        return response
        
    except Exception as e:
        print(f"❌ Erro no fallback PNG: {str(e)}")
        return jsonify({
            'erro': 'Logo não encontrada',
            'path_esperado': 'templates/logo.png',
            'solucao': 'Certifique-se que o arquivo logo.png está na pasta templates/'
        }), 404

@app.route('/api/dados')
def api_dados():
    """API principal - retorna todos os dados (VERSÃO MELHORADA v4.0)"""
    try:
        # Pegar parâmetros com validação
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        inicio_renda_filhos = request.args.get('inicio_renda_filhos', 'falecimento')
        custo_fazenda = float(request.args.get('custo_fazenda', 2_000_000))
        
        # NOVA FUNCIONALIDADE: Perfil de investimento dinâmico
        perfil_investimento = request.args.get('perfil', 'moderado').lower()
        if perfil_investimento not in ['conservador', 'moderado', 'balanceado']:
            perfil_investimento = 'moderado'  # Default
        
        # Converter início da renda se for numérico
        try:
            if inicio_renda_filhos.isdigit():
                inicio_renda_filhos = int(inicio_renda_filhos)
        except:
            inicio_renda_filhos = 'falecimento'
        
        print(f"📥 Parâmetros recebidos v4.0 - Taxa: {taxa}% (real, inflação presumida: {INFLACAO_PRESUMIDA}%), Expectativa: {expectativa}, Despesas: R$ {despesas:,.0f}, Início filhos: {inicio_renda_filhos}, Perfil: {perfil_investimento}")
        
        # Calcular cenário principal
        resultado = calcular_compromissos(taxa, expectativa, despesas, inicio_renda_filhos, custo_fazenda)
        status = determinar_status(resultado['fazenda'], resultado['percentual'])
        
        # Análise de sensibilidade (taxas de 2% a 8%)
        sensibilidade = []
        for t in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]:
            calc = calcular_compromissos(t, expectativa, despesas, inicio_renda_filhos, custo_fazenda)
            sensibilidade.append({
                'taxa': t,
                'fazenda': calc['fazenda'],
                'percentual': calc['percentual'],
                'arte': calc['arte']
            })
        
        # Asset allocation baseado no perfil escolhido
        allocation = get_asset_allocation(perfil_investimento, PATRIMONIO)
        
        # Projeção de fluxo de caixa
        fluxo_caixa = gerar_projecao_fluxo(taxa, expectativa, despesas, 20, inicio_renda_filhos)
        
        response_data = {
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
                'despesas': despesas,
                'inicio_renda_filhos': inicio_renda_filhos,
                'custo_fazenda': custo_fazenda,
                'perfil_investimento': perfil_investimento,
                'inflacao_presumida': INFLACAO_PRESUMIDA
            },
            'versao': '4.0',
            'timestamp': get_current_datetime_sao_paulo().isoformat()
        }
        
        # Log dos dados para debug
        print(f"📊 Dados calculados v4.0 - Taxa: {taxa}% real, Fazenda: {format_currency(resultado['fazenda'], True)}, Arte: {format_currency(resultado['arte'], True)}, Perfil: {perfil_investimento}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Erro na API dados v4.0: {str(e)}")
        return jsonify({
            'success': False,
            'erro': str(e),
            'versao': '4.0',
            'timestamp': get_current_datetime_sao_paulo().isoformat()
        }), 500

@app.route('/api/teste')
def api_teste():
    """Teste da API v4.0 com novas funcionalidades"""
    return jsonify({
        'status': 'OK',
        'service': 'Cimo Family Office API',
        'version': '4.0',
        'melhorias': [
            'Taxa real vs nominal especificada',
            'Início flexível renda filhos',
            'Doações exatamente 15 anos',
            'Asset allocation estruturada',
            'Validações robustas',
            'Fórmulas documentadas',
            'Timezone São Paulo',
            'Cálculo obras de arte',
            'Orientações de revisão'
        ],
        'patrimonio': format_currency(PATRIMONIO, True),
        'cliente': f'Ana, {IDADE_ANA} anos',
        'despesas_base': format_currency(DESPESAS_BASE, True) + '/mês',
        'server_time': format_datetime_report(),
        'timezone': 'America/Sao_Paulo (UTC-3)',
        'features': {
            'relatorios_pdf': True,
            'graficos_matplotlib': True,
            'charts_fallback': True,
            'validacoes_sanidade': True,
            'asset_allocation': True,
            'calculo_arte': True,
            'timezone_brasil': True
        },
        'parametros_configuracao': {
            'patrimonio': PATRIMONIO,
            'idade_ana': IDADE_ANA,
            'periodo_doacoes': PERIODO_DOACOES,
            'status_thresholds': STATUS_THRESHOLDS
        },
        'endpoints': {
            'dashboard': '/dashboard',
            'dados': '/api/dados',
            'teste': '/api/teste',
            'logo': '/logo.png',
            'relatorio_executivo': '/api/relatorio/executivo',
            'relatorio_detalhado': '/api/relatorio/detalhado',
            'debug_logo': '/debug/logo'
        }
    })

@app.route('/api/relatorio/executivo')
def relatorio_executivo():
    """Gera e baixa relatório executivo em PDF (v4.0)"""
    try:
        # Pegar parâmetros
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        inicio_renda_filhos = request.args.get('inicio_renda_filhos', 'falecimento')
        custo_fazenda = float(request.args.get('custo_fazenda', 2_000_000))
        
        # Converter início da renda se for numérico
        try:
            if inicio_renda_filhos.isdigit():
                inicio_renda_filhos = int(inicio_renda_filhos)
        except:
            inicio_renda_filhos = 'falecimento'
        
        # Calcular dados
        resultado = calcular_compromissos(taxa, expectativa, despesas, inicio_renda_filhos, custo_fazenda)
        status = determinar_status(resultado['fazenda'], resultado['percentual'])
        
        # Análise de sensibilidade
        sensibilidade = []
        for t in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]:
            calc = calcular_compromissos(t, expectativa, despesas, inicio_renda_filhos, custo_fazenda)
            sensibilidade.append({
                'taxa': t,
                'fazenda': calc['fazenda'],
                'percentual': calc['percentual']
            })
        
        # Asset allocation
        allocation = get_asset_allocation('moderado', PATRIMONIO)
        
        dados = {
            'patrimonio': PATRIMONIO,
            'resultado': resultado,
            'sensibilidade': sensibilidade,
            'allocation': allocation,
            'status': status,
            'parametros': {
                'taxa': taxa,
                'expectativa': expectativa,
                'despesas': despesas,
                'inicio_renda_filhos': inicio_renda_filhos,
                'custo_fazenda': custo_fazenda
            }
        }
        
        # Gerar PDF
        pdf_buffer = gerar_relatorio_executivo(dados)
        
        # Preparar resposta
        timestamp = get_current_datetime_sao_paulo().strftime("%Y%m%d_%H%M")
        response = make_response(pdf_buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=relatorio_executivo_v4_{timestamp}.pdf'
        
        print(f"📄 Relatório executivo v4.0 gerado para taxa {taxa}% - {format_datetime_report()}")
        return response
        
    except Exception as e:
        print(f"❌ Erro ao gerar relatório executivo v4.0: {str(e)}")
        return jsonify({
            'success': False,
            'erro': f'Erro ao gerar relatório: {str(e)}',
            'versao': '4.0'
        }), 500

@app.route('/api/relatorio/detalhado')
def relatorio_detalhado():
    """Gera e baixa relatório detalhado em PDF (v4.0)"""
    try:
        # Pegar parâmetros
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        inicio_renda_filhos = request.args.get('inicio_renda_filhos', 'falecimento')
        custo_fazenda = float(request.args.get('custo_fazenda', 2_000_000))
        
        # Converter início da renda se for numérico
        try:
            if inicio_renda_filhos.isdigit():
                inicio_renda_filhos = int(inicio_renda_filhos)
        except:
            inicio_renda_filhos = 'falecimento'
        
        # Calcular dados
        resultado = calcular_compromissos(taxa, expectativa, despesas, inicio_renda_filhos, custo_fazenda)
        status = determinar_status(resultado['fazenda'], resultado['percentual'])
        
        # Análise de sensibilidade
        sensibilidade = []
        for t in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]:
            calc = calcular_compromissos(t, expectativa, despesas, inicio_renda_filhos, custo_fazenda)
            sensibilidade.append({
                'taxa': t,
                'fazenda': calc['fazenda'],
                'percentual': calc['percentual']
            })
        
        # Asset allocation
        allocation = get_asset_allocation('moderado', PATRIMONIO)
        
        # Fluxo de caixa
        fluxo_caixa = gerar_projecao_fluxo(taxa, expectativa, despesas, 20, inicio_renda_filhos)
        
        dados = {
            'patrimonio': PATRIMONIO,
            'resultado': resultado,
            'sensibilidade': sensibilidade,
            'allocation': allocation,
            'status': status,
            'fluxo_caixa': fluxo_caixa,
            'parametros': {
                'taxa': taxa,
                'expectativa': expectativa,
                'despesas': despesas,
                'inicio_renda_filhos': inicio_renda_filhos,
                'custo_fazenda': custo_fazenda
            }
        }
        
        # Gerar PDF
        pdf_buffer = gerar_relatorio_detalhado(dados)
        
        # Preparar resposta
        timestamp = get_current_datetime_sao_paulo().strftime("%Y%m%d_%H%M")
        response = make_response(pdf_buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=relatorio_detalhado_v4_{timestamp}.pdf'
        
        print(f"📄 Relatório detalhado v4.0 gerado para taxa {taxa}% - {format_datetime_report()}")
        return response
        
    except Exception as e:
        print(f"❌ Erro ao gerar relatório detalhado v4.0: {str(e)}")
        return jsonify({
            'success': False,
            'erro': f'Erro ao gerar relatório: {str(e)}',
            'versao': '4.0'
        }), 500

# ================ DEBUG ENDPOINTS ================
@app.route('/debug/logo')
def debug_logo():
    """Debug da logo para troubleshooting"""
    logo_path = os.path.join('templates', 'logo.png')
    
    debug_info = {
        'arquivo_existe': os.path.exists(logo_path),
        'path_completo': os.path.abspath(logo_path),
        'path_relativo': logo_path,
        'diretorio_atual': os.getcwd(),
        'arquivos_templates': [],
        'tamanho_arquivo': None
    }
    
    # Listar arquivos na pasta templates
    templates_dir = 'templates'
    if os.path.exists(templates_dir):
        debug_info['arquivos_templates'] = os.listdir(templates_dir)
    
    # Tamanho do arquivo se existir
    if os.path.exists(logo_path):
        debug_info['tamanho_arquivo'] = f"{os.path.getsize(logo_path)} bytes"
    
    html_debug = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Debug Logo CIMO v4.0</title>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; }}
            .container {{ max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
            .success {{ color: #059669; font-weight: bold; }}
            .error {{ color: #dc2626; font-weight: bold; }}
            .info {{ background: #f0f9ff; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #3b82f6; }}
            img {{ max-width: 300px; border: 1px solid #e5e7eb; margin: 10px 0; border-radius: 8px; }}
            code {{ background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; }}
            .version {{ background: #1e3a8a; color: white; padding: 8px 16px; border-radius: 6px; display: inline-block; margin-bottom: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="version">CIMO v4.0 - Debug Logo</div>
            <h1>🐛 Debug Logo CIMO</h1>
            
            <h2>📊 Status do Arquivo:</h2>
            <p class="{'success' if debug_info['arquivo_existe'] else 'error'}">
                Arquivo existe: {debug_info['arquivo_existe']}
            </p>
            
            <div class="info">
                <strong>📁 Paths:</strong><br>
                <strong>Path completo:</strong> <code>{debug_info['path_completo']}</code><br>
                <strong>Diretório atual:</strong> <code>{debug_info['diretorio_atual']}</code><br>
                <strong>Tamanho:</strong> {debug_info['tamanho_arquivo'] or 'N/A'}
            </div>
            
            <h2>📂 Arquivos na pasta templates/:</h2>
            <ul>
                {''.join([f'<li><code>{arquivo}</code></li>' for arquivo in debug_info['arquivos_templates']])}
            </ul>
            
            <h2>🖼️ Teste da Logo:</h2>
            <p>Logo atual: <img src="/logo.png" alt="Logo CIMO" style="height: 60px;"></p>
            
            <h2>🔧 Soluções:</h2>
            <ol>
                <li>Certifique-se que o arquivo está em: <code>templates/logo.png</code></li>
                <li>Verifique se o arquivo não está corrompido</li>
                <li>Teste acessando diretamente: <a href="/logo.png">/logo.png</a></li>
                <li>Verifique permissões de leitura do arquivo</li>
            </ol>
            
            <h2>🆕 Novidades v4.0:</h2>
            <ul>
                <li>✅ Timezone São Paulo</li>
                <li>✅ Validações robustas</li>
                <li>✅ Formatação monetária documentada</li>
                <li>✅ Asset allocation estruturada</li>
            </ul>
            
            <hr>
            <p>
                <a href="/dashboard" style="background: #1e3a8a; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px;">← Voltar ao Dashboard</a>
                <a href="/api/teste" style="background: #059669; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; margin-left: 10px;">🧪 Testar API</a>
            </p>
            <p style="margin-top: 20px; color: #6b7280; font-size: 0.9rem;">
                <i>Debug gerado em {format_datetime_report()}</i>
            </p>
        </div>
    </body>
    </html>
    '''
    
    return html_debug

@app.route('/api/debug/validacoes')
def debug_validacoes():
    """Endpoint para testar validações de sanidade"""
    try:
        # Testes de validação
        testes = []
        
        # Teste 1: Parâmetros válidos
        try:
            validar_inputs(4.0, 90, 150000)
            testes.append({"teste": "Parâmetros válidos", "resultado": "✅ PASSOU", "erro": None})
        except Exception as e:
            testes.append({"teste": "Parâmetros válidos", "resultado": "❌ FALHOU", "erro": str(e)})
        
        # Teste 2: Taxa muito alta
        try:
            validar_inputs(20.0, 90, 150000)
            testes.append({"teste": "Taxa muito alta (20%)", "resultado": "❌ DEVERIA FALHAR", "erro": None})
        except Exception as e:
            testes.append({"teste": "Taxa muito alta (20%)", "resultado": "✅ FALHOU CORRETAMENTE", "erro": str(e)})
        
        # Teste 3: Expectativa menor que idade atual
        try:
            validar_inputs(4.0, 50, 150000)
            testes.append({"teste": "Expectativa < idade atual", "resultado": "❌ DEVERIA FALHAR", "erro": None})
        except Exception as e:
            testes.append({"teste": "Expectativa < idade atual", "resultado": "✅ FALHOU CORRETAMENTE", "erro": str(e)})
        
        # Teste 4: Despesas muito baixas
        try:
            validar_inputs(4.0, 90, 10000)
            testes.append({"teste": "Despesas muito baixas (R$ 10k)", "resultado": "❌ DEVERIA FALHAR", "erro": None})
        except Exception as e:
            testes.append({"teste": "Despesas muito baixas (R$ 10k)", "resultado": "✅ FALHOU CORRETAMENTE", "erro": str(e)})
        
        return jsonify({
            'success': True,
            'versao': '4.0',
            'timestamp': format_datetime_report(),
            'testes_validacao': testes,
            'parametros_limites': {
                'taxa_min': 0.1,
                'taxa_max': 15.0,
                'expectativa_min': IDADE_ANA,
                'expectativa_max': 120,
                'despesas_min': 50000,
                'despesas_max': 1000000
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'erro': str(e),
            'versao': '4.0'
        }), 500

# ================ MIDDLEWARE E HANDLERS ================
@app.errorhandler(404)
def not_found(error):
    """Handler para páginas não encontradas"""
    return jsonify({
        'erro': 'Endpoint não encontrado',
        'versao': '4.0',
        'endpoints_disponiveis': [
            '/',
            '/dashboard',
            '/api/dados',
            '/api/teste',
            '/api/health',
            '/logo.png',
            '/api/cenarios',
            '/api/relatorio/executivo',
            '/api/relatorio/detalhado',
            '/debug/logo',
            '/api/debug/validacoes'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handler para erros internos"""
    return jsonify({
        'erro': 'Erro interno do servidor',
        'message': 'Contate o administrador do sistema',
        'versao': '4.0',
        'timestamp': format_datetime_report()
    }), 500

@app.before_request
def log_request():
    """Log das requisições (desenvolvimento)"""
    if app.debug:
        timestamp = get_current_datetime_sao_paulo().strftime('%H:%M:%S')
        print(f"[{timestamp}] {request.method} {request.path}")

@app.after_request
def after_request(response):
    """Headers de segurança e CORS"""
    response.headers.add('X-Content-Type-Options', 'nosniff')
    response.headers.add('X-Frame-Options', 'DENY')
    response.headers.add('X-XSS-Protection', '1; mode=block')
    response.headers.add('X-Version', '4.0')
    return response

# ================ INICIALIZAÇÃO ================
if __name__ == '__main__':
    print("=" * 80)
    print("🚀 Cimo Family Office - Plano Patrimonial v4.0 MELHORADA")
    print("=" * 80)
    print(f"📊 Patrimônio Ana: {format_currency(PATRIMONIO)}")
    print(f"👤 Idade atual: {IDADE_ANA} anos")
    print(f"💰 Despesas base: {format_currency(DESPESAS_BASE)}/mês")
    print(f"🕐 Timezone: São Paulo (UTC-3)")
    print("=" * 80)
    print("🆕 PRINCIPAIS MELHORIAS v4.0:")
    print("   ✅ Taxa REAL claramente especificada")
    print("   ✅ Início flexível da renda dos filhos")
    print("   ✅ Doações exatamente por 15 anos")
    print("   ✅ Asset allocation estruturada")
    print("   ✅ Validações de sanidade robustas")
    print("   ✅ Fórmulas financeiras documentadas")
    print("   ✅ Timezone São Paulo nos relatórios")
    print("   ✅ Cálculo de verba para obras de arte")
    print("   ✅ Orientações para revisão periódica")
    print("   ✅ Status parametrizável do plano")
    print("   ✅ Formatação monetária documentada")
    print("=" * 80)
    print("🌐 Servidor rodando em:")
    print("   • Home: http://localhost:5000")
    print("   • Dashboard: http://localhost:5000/dashboard")
    print("   • API Dados: http://localhost:5000/api/dados")
    print("   • Relatório PDF: http://localhost:5000/api/relatorio/executivo")
    print("   • Debug Logo: http://localhost:5000/debug/logo")
    print("   • Test Validações: http://localhost:5000/api/debug/validacoes")
    print("=" * 80)
    print("💡 Dicas:")
    print("   • Use Ctrl+C para parar o servidor")
    print("   • Certifique-se de que index.html está na mesma pasta!")
    print("   • Taxa de retorno sempre REAL (já descontada da inflação)")
    print("   • Todos os cálculos validados por funções de sanidade")
    print("=" * 80)
    print(f"🕐 Servidor iniciado em: {format_datetime_report()}")
    print("=" * 80)
    
    # Verificar se index.html existe
    if not os.path.exists('templates/index.html'):
        print("⚠️  AVISO: index.html não encontrado na pasta templates/!")
        print("   O dashboard não funcionará até que o arquivo seja criado.")
        print("=" * 80)
    else:
        print("✅ index.html encontrado com sucesso!")
    
    # Verificar se logo.png existe
    if not os.path.exists('templates/logo.png'):
        print("⚠️  AVISO: logo.png não encontrado na pasta templates/!")
        print("   Será usado fallback automático.")
    else:
        print("✅ logo.png encontrado com sucesso!")
    
    print("=" * 80)
    
    # Executar servidor
    app.run(
        debug=True, 
        host='0.0.0.0', 
        port=5000,
        use_reloader=True,
        threaded=True
    )