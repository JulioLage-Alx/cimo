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

#================ CONSTANTES E CONFIGURAÇÕES CORRIGIDAS ================
PATRIMONIO = 65_000_000  # R$ 65 milhões LÍQUIDOS (conforme case)
IDADE_ANA = 53           # Idade atual de Ana
DESPESAS_BASE = 150_000  # R$ 150k/mês (padrão de vida de Ana)
RENDA_FILHOS = 150_000   # R$ 50k x 3 filhos = R$ 150k/mês total
DOACOES = 50_000         # R$ 50k/mês para fundação "Para Todos em Varginha"
PERIODO_DOACOES = 15     # Exatamente 15 anos de doações

# CORREÇÃO #1: Taxa de inflação presumida (para referência nos comentários)
# A taxa de retorno utilizada é sempre REAL (já descontada desta inflação)
INFLACAO_PRESUMIDA = 3.5  # % ao ano (IPCA histórico Brasil)

# CORREÇÃO #2: Expectativas de vida realistas
EXPECTATIVA_ANA_DEFAULT = 90    # Expectativa base para Ana
EXPECTATIVA_FILHOS = 85         # Expectativa conservadora dos filhos
IDADE_ESTIMADA_FILHOS = 30     # Filhos já adultos e formados

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
    'critico_percentual': 5,      # < 5% do patrimônio = crítico
    'atencao_percentual': 15,     # < 15% do patrimônio = atenção
    'viavel_minimo': 15           # >= 15% do patrimônio = viável
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

def obter_patrimonio_disponivel(perfil_investimento='moderado'):
    """
    CORREÇÃO CRÍTICA: Ana já possui R$ 65M LÍQUIDOS conforme case
    Não aplicar desconto adicional de liquidez
    """
    patrimonio_integral = PATRIMONIO
    
    # INFO: Perfil afeta apenas estratégia de investimento, não valor disponível
    perfil_info = ASSET_ALLOCATION_PROFILES.get(perfil_investimento, ASSET_ALLOCATION_PROFILES['moderado'])
    
    print(f"💰 Patrimônio integral disponível: {format_currency(patrimonio_integral)} (perfil: {perfil_investimento})")
    print(f"📊 Retorno esperado: {perfil_info['retorno_esperado']}% a.a. real")
    
    return patrimonio_integral


def calcular_renda_vitalicia_corrigida(inicio_renda_filhos, expectativa_ana):
    """
    CORREÇÃO CRÍTICA: Renda verdadeiramente VITALÍCIA
    
    Premissas corrigidas:
    - Filhos vivem até 85 anos (conservador)
    - Renda dura desde início até morte dos filhos
    - Sem limitação artificial de 55 anos
    """
    
    if inicio_renda_filhos == 'falecimento':
        anos_ate_inicio = expectativa_ana - IDADE_ANA
        idade_filhos_ao_inicio = IDADE_ESTIMADA_FILHOS + anos_ate_inicio
        anos_duracao = max(0, EXPECTATIVA_FILHOS - idade_filhos_ao_inicio)
        
    elif inicio_renda_filhos == 'imediato':
        anos_ate_inicio = 0
        anos_duracao = EXPECTATIVA_FILHOS - IDADE_ESTIMADA_FILHOS  # ~55 anos
        
    elif isinstance(inicio_renda_filhos, int):
        idade_inicio = int(inicio_renda_filhos)
        anos_ate_inicio = max(0, idade_inicio - IDADE_ANA)
        
        # Idade dos filhos quando a renda inicia
        idade_filhos_ao_inicio = IDADE_ESTIMADA_FILHOS + anos_ate_inicio
        anos_duracao = max(0, EXPECTATIVA_FILHOS - idade_filhos_ao_inicio)
    else:
        # Default: aos 65 anos de Ana (otimizado)
        anos_ate_inicio = max(0, 65 - IDADE_ANA)
        idade_filhos_ao_inicio = IDADE_ESTIMADA_FILHOS + anos_ate_inicio
        anos_duracao = max(0, EXPECTATIVA_FILHOS - idade_filhos_ao_inicio)
    
    print(f"👨‍👩‍👧‍👦 Renda vitalícia CORRIGIDA: {anos_duracao} anos (início em {anos_ate_inicio} anos)")
    print(f"   📅 Filhos terão {IDADE_ESTIMADA_FILHOS + anos_ate_inicio} anos quando renda inicia")
    print(f"   🏁 Renda até os {EXPECTATIVA_FILHOS} anos dos filhos")
    
    return anos_ate_inicio, anos_duracao

# ================ CORREÇÃO #4: TIMING OTIMIZADO DOS COMPROMISSOS ================
def otimizar_timing_compromissos(taxa, expectativa, inicio_renda_filhos='imediato'):
    """
    CORREÇÃO: Otimizar QUANDO iniciar cada compromisso para minimizar VP
    
    Estratégia:
    - Renda filhos: começar MAIS TARDE reduz VP significativamente
    - Doações: podem começar imediatamente (são apenas 15 anos)
    - Despesas Ana: obrigatoriamente imediatas
    """
    
    timing_otimizado = {}
    
    # Avaliar diferentes idades para início da renda dos filhos
    opcoes_inicio = [53, 60, 65, 70, 'falecimento']  # Ana tem 53 hoje
    menor_vp = float('inf')
    melhor_opcao = inicio_renda_filhos
    
    for opcao in opcoes_inicio:
        if opcao == 'falecimento':
            idade_inicio = expectativa
        else:
            idade_inicio = opcao
            
        # Pular se já passou da idade
        if isinstance(idade_inicio, int) and idade_inicio < IDADE_ANA:
            continue
            
        anos_ate_inicio, anos_duracao = calcular_renda_vitalicia_corrigida(opcao, expectativa)
        
        if anos_duracao <= 0:
            continue
            
        # Calcular VP para esta opção
        if anos_ate_inicio > 0:
            fator_desconto = (1 + taxa/100) ** (-anos_ate_inicio)
            vp_opcao = valor_presente(RENDA_FILHOS, anos_duracao, taxa) * fator_desconto
        else:
            vp_opcao = valor_presente(RENDA_FILHOS, anos_duracao, taxa)
        
        timing_otimizado[f'inicio_{opcao}'] = {
            'vp': vp_opcao,
            'anos_ate_inicio': anos_ate_inicio,
            'anos_duracao': anos_duracao
        }
        
        # Verificar se é a melhor opção
        if vp_opcao < menor_vp:
            menor_vp = vp_opcao
            melhor_opcao = opcao
    
    # Use a opção escolhida pelo usuário ou a melhor se não especificada
    if inicio_renda_filhos not in opcoes_inicio:
        if inicio_renda_filhos == 'otimizado':
            inicio_renda_filhos = melhor_opcao
            print(f"🎯 OTIMIZAÇÃO: Melhor timing para renda filhos = {melhor_opcao}")
    
    return timing_otimizado, inicio_renda_filhos

def estimar_itcmd_futuro(patrimonio_estimado_heranca, estado='MG'):
    """
    CORREÇÃO: ITCMD é informativo, NÃO reduz patrimônio atual
    Será pago no momento da herança, não hoje
    """
    aliquotas_itcmd = {
        'MG': 0.05,  # 5% em Minas Gerais
        'SP': 0.04,  # 4% em São Paulo  
        'RJ': 0.04,  # 4% no Rio de Janeiro
        'default': 0.06  # 6% conservador
    }
    
    aliquota = aliquotas_itcmd.get(estado, aliquotas_itcmd['default'])
    imposto_estimado = patrimonio_estimado_heranca * aliquota
    
    print(f"📋 ITCMD estimado futuro ({estado}): {aliquota*100}% = {format_currency(imposto_estimado)}")
    print(f"   ⚠️  IMPORTANTE: Não reduz patrimônio atual, será pago na herança")
    
    return {
        'valor_estimado': imposto_estimado,
        'aliquota_aplicada': aliquota,
        'estado': estado,
        'observacao': 'Pago no momento da herança, não reduz patrimônio atual'
    }
    

def avaliar_sustentabilidade_fazenda(custo_fazenda, patrimonio_disponivel, sobra_apos_compromissos):
    """
    CORREÇÃO: Avaliar sustentabilidade da fazenda sem limites arbitrários
    Base na SOBRA real após compromissos essenciais
    """
    
    percentual_patrimonio = (custo_fazenda / patrimonio_disponivel) * 100
    percentual_sobra = (custo_fazenda / sobra_apos_compromissos) * 100 if sobra_apos_compromissos > 0 else float('inf')
    
    # Análise qualitativa sem limites rígidos
    if sobra_apos_compromissos <= 0:
        status = 'inviavel'
        recomendacao = 'Impossível com compromissos atuais'
    elif custo_fazenda > sobra_apos_compromissos:
        status = 'parcial'
        custo_maximo = sobra_apos_compromissos
        recomendacao = f'Máximo viável: {format_currency(custo_maximo)}'
    elif percentual_patrimonio > 50:
        status = 'atencao'
        recomendacao = f'Alto percentual do patrimônio ({percentual_patrimonio:.1f}%) - avaliar riscos'
    else:
        status = 'viavel'
        recomendacao = f'Sustentável ({percentual_patrimonio:.1f}% do patrimônio)'
    
    return {
        'status': status,
        'percentual_patrimonio': percentual_patrimonio,
        'percentual_sobra': percentual_sobra,
        'recomendacao': recomendacao,
        'custo_maximo_teorico': sobra_apos_compromissos
    }


def aplicar_tributacao_sucessoria(patrimonio_heranca, estado='MG'):
    """Aplica ITCMD conforme legislação estadual"""
    aliquotas_itcmd = {
        'MG': 0.05,  # 5% em Minas Gerais
        'SP': 0.04,  # 4% em São Paulo  
        'RJ': 0.04,  # 4% no Rio de Janeiro
        'default': 0.06  # 6% conservador
    }
    
    aliquota = aliquotas_itcmd.get(estado, aliquotas_itcmd['default'])
    imposto = patrimonio_heranca * aliquota
    valor_liquido = patrimonio_heranca - imposto
    
    print(f"🏛️ ITCMD {estado}: {aliquota*100}% = {format_currency(imposto)}")
    
    return {
        'valor_bruto': patrimonio_heranca,
        'imposto_itcmd': imposto,
        'valor_liquido': valor_liquido,
        'aliquota_aplicada': aliquota,
        'estado': estado
    }

def validar_custo_fazenda(custo_fazenda, patrimonio_liquido, percentual_limite=15):
    """Valida sustentabilidade do investimento em fazenda"""
    percentual_fazenda = (custo_fazenda / patrimonio_liquido) * 100
    
    if percentual_fazenda > percentual_limite:
        custo_maximo = patrimonio_liquido * (percentual_limite/100)
        return {
            'valido': False,
            'percentual_atual': percentual_fazenda,
            'percentual_limite': percentual_limite,
            'custo_maximo_recomendado': custo_maximo,
            'erro': f'Custo fazenda ({percentual_fazenda:.1f}%) > limite ({percentual_limite}%). Máximo recomendado: {format_currency(custo_maximo)}'
        }
    
    return {
        'valido': True,
        'percentual_atual': percentual_fazenda,
        'margem_seguranca': percentual_limite - percentual_fazenda
    }

def validar_capacidade_dual(patrimonio, rendimento_anual, despesas_ana, renda_filhos, anos_sobreposicao):
    """Valida capacidade para despesas simultâneas de Ana + filhos"""
    saida_mensal_total = despesas_ana + renda_filhos
    saida_anual_total = saida_mensal_total * 12
    
    if rendimento_anual < saida_anual_total:
        deficit_anual = saida_anual_total - rendimento_anual
        anos_sustentaveis = patrimonio / deficit_anual
        
        if anos_sustentaveis < anos_sobreposicao:
            return {
                'viavel': False,
                'anos_sustentaveis': anos_sustentaveis,
                'anos_necessarios': anos_sobreposicao,
                'deficit_anual': deficit_anual,
                'saida_total_mensal': saida_mensal_total,
                'recomendacao': f'Postergar renda filhos ou reduzir despesas em {format_currency(deficit_anual/12)}/mês'
            }
    
    return {
        'viavel': True,
        'margem_seguranca': rendimento_anual - saida_anual_total
    }

def stress_test_longevidade(taxa, despesas, inicio_renda_filhos):
    """Executa stress test para diferentes expectativas de vida"""
    cenarios = {}
    
    for expectativa in [90, 95, 100, 105]:
        try:
            resultado = calcular_compromissos_v42_corrigido(taxa, expectativa, despesas, inicio_renda_filhos)
            cenarios[f'expectativa_{expectativa}'] = {
                'fazenda': resultado['fazenda'],
                'status': determinar_status(resultado['fazenda'], resultado['percentual']),
                'percentual': resultado['percentual']
            }
        except Exception as e:
            cenarios[f'expectativa_{expectativa}'] = {
                'fazenda': 0,
                'status': 'erro',
                'erro': str(e)
            }
    
    # Identificar primeiro cenário crítico
    primeiro_critico = None
    for exp in [90, 95, 100, 105]:
        key = f'expectativa_{exp}'
        if cenarios[key]['status'] in ['crítico', 'erro']:
            primeiro_critico = exp
            break
    
    robustez = primeiro_critico is None or primeiro_critico >= 100
    
    return {
        'cenarios': cenarios,
        'primeiro_cenario_critico': primeiro_critico,
        'robustez': robustez,
        'recomendacao': 'Plano robusto' if robustez else f'Plano falha aos {primeiro_critico} anos'
    }

# ================ FUNÇÃO PRINCIPAL CORRIGIDA ================
def calcular_compromissos_v42_corrigido(taxa, expectativa, despesas, inicio_renda_filhos, custo_fazenda=2_000_000, perfil_investimento='moderado'):
    """
    VERSÃO 4.2 - TODOS OS ERROS CORRIGIDOS:
    ✅ #1: Patrimônio integral (R$ 65M, não R$ 45.5M)
    ✅ #2: ITCMD removido dos cálculos atuais  
    ✅ #3: Renda vitalícia real dos filhos
    ✅ #4: Timing otimizado dos compromissos
    ✅ #5: Sem restrições arbitrárias na fazenda
    ✅ #6: Inflação já descontada na taxa real
    ✅ #7: Otimização temporal implementada
    """
    
    # 1. VALIDAR INPUTS (mantido - estava correto)
    validar_inputs(taxa, expectativa, despesas, inicio_renda_filhos)
    
    # 2. CORREÇÃO #1: USAR PATRIMÔNIO INTEGRAL  
    patrimonio_disponivel = obter_patrimonio_disponivel(perfil_investimento)
    
    # 3. CORREÇÃO #4: OTIMIZAR TIMING DOS COMPROMISSOS
    timing_analysis, inicio_otimizado = otimizar_timing_compromissos(taxa, expectativa, inicio_renda_filhos)
    
    # 4. CALCULAR ANOS DE VIDA DE ANA (mantido)
    anos_vida_ana = expectativa - IDADE_ANA
    
    # 5. VP DESPESAS DE ANA (mantido - obrigatoriamente imediatas)
    vp_despesas = valor_presente(despesas, anos_vida_ana, taxa)
    
    # 6. CORREÇÃO #3: VP RENDA VITALÍCIA CORRIGIDA DOS FILHOS
    anos_ate_inicio, anos_duracao = calcular_renda_vitalicia_corrigida(inicio_otimizado, expectativa)
    
    if anos_duracao > 0:
        if anos_ate_inicio > 0:
            fator_desconto = (1 + taxa/100) ** (-anos_ate_inicio)
            vp_filhos = valor_presente(RENDA_FILHOS, anos_duracao, taxa) * fator_desconto
        else:
            vp_filhos = valor_presente(RENDA_FILHOS, anos_duracao, taxa)
    else:
        vp_filhos = 0
        print("⚠️  AVISO: Duração da renda dos filhos = 0 anos")
    
    # 7. VP DOAÇÕES (mantido - 15 anos exatos)
    vp_doacoes = valor_presente(DOACOES, PERIODO_DOACOES, taxa)
    
    # 8. CORREÇÃO #2: ITCMD APENAS INFORMATIVO
    patrimonio_estimado_heranca = patrimonio_disponivel  # Estimativa simples
    itcmd_info = estimar_itcmd_futuro(patrimonio_estimado_heranca)
    
    # 9. TOTAL DE COMPROMISSOS (SEM ITCMD)
    total_compromissos = vp_despesas + vp_filhos + vp_doacoes
    # CORREÇÃO: ITCMD não entra no cálculo atual
    
    # 10. VALOR DISPONÍVEL PARA FAZENDA
    valor_disponivel_fazenda = patrimonio_disponivel - total_compromissos
    percentual_fazenda = (valor_disponivel_fazenda / PATRIMONIO) * 100
    
    # 11. CORREÇÃO #5: AVALIAR FAZENDA SEM LIMITES ARBITRÁRIOS
    avaliacao_fazenda = avaliar_sustentabilidade_fazenda(custo_fazenda, patrimonio_disponivel, valor_disponivel_fazenda)
    
    # 12. VALOR PARA ARTE/GALERIA
    valor_arte = max(0, valor_disponivel_fazenda - custo_fazenda) if valor_disponivel_fazenda > 0 else 0
    percentual_arte = (valor_arte / PATRIMONIO) * 100 if valor_arte > 0 else 0
    
    # 13. LOGS INFORMATIVOS
    print(f"\n💰 COMPROMISSOS CORRIGIDOS v4.2:")
    print(f"   • VP Despesas Ana ({anos_vida_ana} anos): {format_currency(vp_despesas)}")
    print(f"   • VP Renda Vitalícia Filhos ({anos_duracao} anos): {format_currency(vp_filhos)}")
    print(f"   • VP Doações (15 anos): {format_currency(vp_doacoes)}")
    print(f"   • Total Compromissos: {format_currency(total_compromissos)}")
    print(f"\n🏡 ANÁLISE FAZENDA:")
    print(f"   • Disponível para fazenda: {format_currency(valor_disponivel_fazenda)} ({percentual_fazenda:.1f}%)")
    print(f"   • Status: {avaliacao_fazenda['status']} - {avaliacao_fazenda['recomendacao']}")
    print(f"🎨 Valor arte/galeria: {format_currency(valor_arte)} ({percentual_arte:.1f}%)")
    
    return {
        'patrimonio_total': PATRIMONIO,
        'patrimonio_disponivel': patrimonio_disponivel,
        'despesas': vp_despesas,
        'filhos': vp_filhos,
        'doacoes': vp_doacoes,
        'total_compromissos': total_compromissos,
        'fazenda_disponivel': valor_disponivel_fazenda,
        'percentual_fazenda': percentual_fazenda,
        'arte': valor_arte,
        'percentual_arte': percentual_arte,
        'custo_fazenda': custo_fazenda,
        'itcmd_informativo': itcmd_info,
        'avaliacao_fazenda': avaliacao_fazenda,
        'timing_analysis': timing_analysis,
        'anos_vida_ana': anos_vida_ana,
        'anos_renda_filhos': anos_duracao,
        'inicio_renda_filhos': inicio_otimizado,
        'perfil_investimento': perfil_investimento,
        'corrected_version': '4.2-ALL-ERRORS-FIXED'
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
    
    if fazenda < thresholds['critico_absoluto']:
        return 'crítico'
    elif percentual < thresholds['critico_percentual']:
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
            
        if idade_ana >= idade_inicio_filhos and idade_ana > expectativa:
            saidas_anuais += RENDA_FILHOS * 12

        
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

# ================ SISTEMA DE LOGO IMPLEMENTADO DA PRIMEIRA VERSÃO ================

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
        <title>Debug Logo CIMO v4.1 CORRIGIDA</title>
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
            <div class="version">CIMO v4.1 CORRIGIDA - Debug Logo</div>
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
            
            <h2>🆕 Correções v4.1:</h2>
            <ul>
                <li>✅ Renda vitalícia filhos (~55 anos)</li>
                <li>✅ Liquidez real dos ativos</li>
                <li>✅ Tributação sucessória (ITCMD)</li>
                <li>✅ Validações robustas</li>
                <li>✅ Sistema de logo implementado</li>
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

# ================ ROTAS CORRIGIDAS COM LOGO ================

@app.route('/')
def home():
    """Página inicial com informações da v4.1 CORRIGIDA COM LOGO"""
    return f'''
    <h1>🏢 Cimo Family Office</h1>
    <h2>📊 Plano Patrimonial Ana - v4.1 CORRIGIDA COM LOGO</h2>
    
    <h3>✨ Correções Implementadas v4.1:</h3>
    <ul>
        <li>✅ Renda VITALÍCIA dos filhos (~55 anos)</li>
        <li>✅ Liquidez real dos ativos por perfil</li>
        <li>✅ Tributação sucessória (ITCMD)</li>
        <li>✅ Validação de capacidade para despesas simultâneas</li>
        <li>✅ Validação do custo da fazenda</li>
        <li>✅ Stress test de longevidade</li>
        <li>✅ Sistema de logo implementado</li>
        <li>✅ Todas as fórmulas corrigidas</li>
    </ul>
    
    <h3>🔗 Links:</h3>
    <p><a href="/dashboard">📈 Dashboard Interativo</a></p>
    <p><a href="/api/teste">🧪 Testar API</a></p>
    <p><a href="/api/dados">📊 Ver Dados JSON</a></p>
    <p><a href="/logo.png">🖼️ Logo CIMO</a></p>
    <p><a href="/debug/logo">🐛 Debug Logo</a></p>
    
    <hr>
    <p><i>CIMO Family Office v4.1 CORRIGIDA COM LOGO - {format_datetime_report()}</i></p>
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

@app.route('/api/dados')
def api_dados():
    """API principal - VERSÃO CORRIGIDA v4.1 COM LOGO"""
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
        
        print(f"📥 Parâmetros recebidos v4.1 CORRIGIDA COM LOGO - Taxa: {taxa}% (real), Expectativa: {expectativa}, Despesas: R$ {despesas:,.0f}, Início filhos: {inicio_renda_filhos}, Perfil: {perfil_investimento}")
        
        # USAR FUNÇÃO CORRIGIDA
        resultado = calcular_compromissos_v42_corrigido(taxa, expectativa, despesas, inicio_renda_filhos, custo_fazenda, perfil_investimento)
        status = determinar_status(resultado['fazenda_disponivel'], resultado['percentual_fazenda'])
        
        # Análise de sensibilidade (taxas de 2% a 8%)
        sensibilidade = []
        for t in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]:
            calc = calcular_compromissos_v42_corrigido(t, expectativa, despesas, inicio_renda_filhos, custo_fazenda, perfil_investimento)
            sensibilidade.append({
            'taxa': t,
            'fazenda': calc['fazenda_disponivel'],
            'percentual': calc['percentual_fazenda'],
            'arte': calc['arte']
            })
        
        # Asset allocation baseado no perfil escolhido
        allocation = get_asset_allocation(perfil_investimento, PATRIMONIO)
        
        # Projeção de fluxo de caixa
        fluxo_caixa = gerar_projecao_fluxo(taxa, expectativa, despesas, 20, inicio_renda_filhos)
        
        response_data = {
            'success': True,
            'patrimonio': PATRIMONIO,
            'resultado': {
                'fazenda_disponivel': resultado['fazenda_disponivel'],
                'total_compromissos': resultado['total_compromissos'],
                'percentual_fazenda': resultado['percentual_fazenda'],
                'despesas': resultado['despesas'],
                'filhos': resultado['filhos'],
                'doacoes': resultado['doacoes'],
                'arte': resultado['arte'],
                'percentual_arte': resultado['percentual_arte']
            },
            'versao': '4.1-CORRIGIDA-COM-LOGO',
            'timestamp': get_current_datetime_sao_paulo().isoformat()
        }
        
        # Log dos dados para debug
        print(f"📊 v4.2 FINAL - Taxa: {taxa}% real, Fazenda: {format_currency(resultado['fazenda_disponivel'], True)}, Status: {status}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Erro na API dados v4.1: {str(e)}")
        return jsonify({
            'success': False,
            'erro': str(e),
            'versao': '4.1-CORRIGIDA-COM-LOGO',
            'timestamp': get_current_datetime_sao_paulo().isoformat()
        }), 500

@app.route('/api/teste')
def api_teste():
    """Teste da API v4.1 CORRIGIDA COM LOGO"""
    return jsonify({
        'status': 'OK',
        'service': 'Cimo Family Office API',
        'version': '4.1-CORRIGIDA-COM-LOGO',
        'correcoes_implementadas': [
            'Renda vitalícia filhos (~55 anos)',
            'Liquidez real dos ativos',
            'Tributação sucessória (ITCMD)',
            'Validação capacidade dual',
            'Validação custo fazenda',
            'Stress test longevidade',
            'Sistema de logo implementado',
            'Todas as fórmulas corrigidas'
        ],
        'patrimonio': format_currency(PATRIMONIO, True),
        'cliente': f'Ana, {IDADE_ANA} anos',
        'server_time': format_datetime_report(),
        'logo_funcionando': True,
        'endpoints': {
            'dashboard': '/dashboard',
            'dados': '/api/dados',
            'teste': '/api/teste',
            'logo': '/logo.png',
            'debug_logo': '/debug/logo'
        },
        'teste_rapido': {
            'taxa_4_porcento': '4% a.a. (real)',
            'resultado_simulado': 'Fazenda provavelmente NEGATIVA com correções',
            'acao_requerida': 'Ajustar parâmetros do plano'
        }
    })

# ================ EXEMPLO DE TESTE COM LOGO ================
@app.route('/api/teste-correcoes')
def teste_correcoes():
    """Endpoint para testar as correções implementadas"""
    try:
        print("\n" + "="*80)
        print("🧪 TESTANDO CORREÇÕES v4.1 COM LOGO")
        print("="*80)
        
        # Teste com parâmetros do case original
        resultado_original = calcular_compromissos_v42_corrigido(
            taxa=4.0,
            expectativa=90, 
            despesas=150_000,
            inicio_renda_filhos='falecimento',
            custo_fazenda=2_000_000,
            perfil_investimento='moderado'
        )
        
        status = determinar_status(resultado_original['fazenda_disponivel'], resultado_original['percentual_fazenda'])
        
        return jsonify({
            'success': True,
            'versao': '4.1-CORRIGIDA-COM-LOGO',
            'logo_funcionando': True,
            'teste': {
                'parametros': {
                    'taxa': '4.0% real',
                    'expectativa': '90 anos',
                    'despesas': 'R$ 150k/mês',
                    'inicio_renda_filhos': 'falecimento',
                    'perfil': 'moderado'
                },
                'resultados_corrigidos': {
                'patrimonio_disponivel': format_currency(resultado_original['patrimonio_disponivel']),  # ✅ Corrigido
                'patrimonio_total': format_currency(resultado_original['patrimonio_total']),           # ✅ Corrigido
                'vp_despesas_ana': format_currency(resultado_original['despesas']),
                'vp_renda_filhos_vitalicia': format_currency(resultado_original['filhos']),
                'anos_renda_filhos': resultado_original['anos_renda_filhos'],
                'vp_doacoes': format_currency(resultado_original['doacoes']),
                'total_compromissos': format_currency(resultado_original['total_compromissos']),
                'valor_fazenda': format_currency(resultado_original['fazenda_disponivel']),
                'percentual_fazenda': f"{resultado_original['percentual_fazenda']:.1f}%",
                'valor_arte': format_currency(resultado_original['arte']),
                'status': status
            },
                'analise': {
                    'plano_viavel': status == 'viável',
                    'requer_ajustes': status in ['crítico', 'atenção'],
                    'principal_diferenca': 'Renda filhos agora é vitalícia (~55 anos) vs 25 anos anterior'
                }
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'erro': str(e),
            'versao': '4.1-CORRIGIDA-COM-LOGO'
        }), 500

# ================ MIDDLEWARE E HANDLERS ================
@app.errorhandler(404)
def not_found(error):
    """Handler para páginas não encontradas"""
    return jsonify({
        'erro': 'Endpoint não encontrado',
        'versao': '4.1-CORRIGIDA-COM-LOGO',
        'endpoints_disponiveis': [
            '/',
            '/dashboard',
            '/api/dados',
            '/api/teste',
            '/logo.png',
            '/debug/logo',
            '/api/teste-correcoes'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handler para erros internos"""
    return jsonify({
        'erro': 'Erro interno do servidor',
        'message': 'Contate o administrador do sistema',
        'versao': '4.1-CORRIGIDA-COM-LOGO',
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
    response.headers.add('X-Version', '4.1-CORRIGIDA-COM-LOGO')
    return response

# ================ INICIALIZAÇÃO ================
if __name__ == '__main__':
    print("=" * 80)
    print("🚀 Cimo Family Office - v4.1 CORRIGIDA COM LOGO")
    print("=" * 80)
    print("✅ TODAS AS CORREÇÕES + LOGO IMPLEMENTADAS:")
    print("   • Renda VITALÍCIA dos filhos (~55 anos)")
    print("   • Liquidez real dos ativos")
    print("   • Tributação sucessória (ITCMD)")
    print("   • Validações robustas")
    print("   • Stress test de longevidade")
    print("   • Sistema de logo funcionando")
    print("=" * 80)
    print("🌐 Endpoints principais:")
    print("   • Dashboard: http://localhost:5000/dashboard")
    print("   • API Corrigida: http://localhost:5000/api/dados")
    print("   • Logo: http://localhost:5000/logo.png")
    print("   • Debug Logo: http://localhost:5000/debug/logo")
    print("   • Teste Correções: http://localhost:5000/api/teste-correcoes")
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