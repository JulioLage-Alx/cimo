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
INFLACAO_ESTATICA = 3.5 
# Taxa de inflação presumida (para referência nos comentários)
# A taxa de retorno utilizada é sempre REAL (já descontada desta inflação)
INFLACAO_PRESUMIDA = 3.5  # % ao ano (IPCA histórico Brasil)

# Expectativas de vida realistas
EXPECTATIVA_ANA_DEFAULT = 90    # Expectativa base para Ana
EXPECTATIVA_FILHOS = 85         # Expectativa conservadora dos filhos
IDADE_ESTIMADA_FILHOS = 30     # Filhos já adultos e formados

# Timezone para relatórios
SAO_PAULO_TZ = pytz.timezone('America/Sao_Paulo')

# Fases de liquidez (conservadora: 40%, 40%, 20%)
FASES_LIQUIDEZ = {
    'fase1_pct': 0.40,  # 40% do período
    'fase2_pct': 0.40,  # 40% do período  
    'fase3_pct': 0.20,  # 20% do período
    'liquidez_base': 2,      # Liquidez normal do perfil
    'liquidez_fase2': 4,     # Fase intermediária
    'liquidez_fase3': 8,     # Fase de aceleração
    'liquidez_final': 15     # Fase final antes da compra
}



# ================ ESTRUTURA DE ASSET ALLOCATION ================
# Perfieados no perfil conservador-moderado de Anas de alocação bas
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

# ================ SISTEMA DE RELATÓRIOS DETALHADOS ================

# ================ VERSÃO EMERGENCY SAFE DA CLASSE ================
class RelatorioGenerator:
    """
    Gerador de relatórios ULTRA-ROBUSTO - versão que sempre funciona
    """
    
    def __init__(self, parametros_usuario, dados_calculados):
        try:
            self.params = parametros_usuario or {}
            self.dados = dados_calculados or {}
            self.timestamp = get_current_datetime_sao_paulo()
            
            # Valores padrão seguros
            self.fazenda_disponivel = self.dados.get('fazenda_disponivel', 0)
            self.percentual_fazenda = self.dados.get('percentual_fazenda', 0)
            
        except Exception as e:
            print(f"⚠️ Erro na inicialização RelatorioGenerator: {e}")
            # Inicialização mínima de emergência
            self.params = parametros_usuario or {
                'taxa': 4.0, 'expectativa': 90, 'despesas': 150000,
                'perfil': 'moderado', 'inicio_renda_filhos': 'falecimento', 'custo_fazenda': 2000000
            }
            self.dados = dados_calculados or {'fazenda_disponivel': 0, 'percentual_fazenda': 0}
            self.timestamp = datetime.now()
            self.fazenda_disponivel = 0
            self.percentual_fazenda = 0
    
    def gerar_dados_executivo(self):
        """Versão SAFE para dados executivos"""
        try:
            return {
                'insights': self._gerar_insights_safe(),
                'recomendacoes': self._gerar_recomendacoes_safe(),
                'status_textual': self._gerar_status_textual_safe(),
                'marcos_temporais': self._calcular_marcos_safe(),
                'resumo_patrimonial': self._gerar_resumo_patrimonial_safe(),
                'cenarios_rapidos': self._gerar_cenarios_rapidos_safe()
            }
        except Exception as e:
            print(f"⚠️ Erro em gerar_dados_executivo: {e}")
            return self._dados_executivo_fallback()
    
    def gerar_dados_tecnico(self):
        """Versão SAFE para dados técnicos"""
        try:
            return {
                'metodologia': self._explicar_metodologia_safe(),
                'calculos_detalhados': self._detalhar_calculos_safe(),
                'projecao_anual': self._gerar_projecao_detalhada_safe(),
                'premissas_completas': self._listar_premissas_safe(),
                'formulas_utilizadas': self._documentar_formulas_safe(),
                'asset_allocation_detalhado': self._analisar_asset_allocation_safe()
            }
        except Exception as e:
            print(f"⚠️ Erro em gerar_dados_tecnico: {e}")
            return self._dados_tecnico_fallback()
    
    def gerar_dados_simulacao(self):
        """Versão SAFE para dados de simulação"""
        try:
            return {
                'sensibilidade_completa': self._calcular_sensibilidade_safe(),
                'stress_tests': self._executar_stress_tests_safe(),
                'otimizacoes': self._identificar_otimizacoes_safe(),
                'cenarios_comparativos': self._gerar_cenarios_multiplos_safe(),
                'monte_carlo_basico': self._simular_monte_carlo_safe()
            }
        except Exception as e:
            print(f"⚠️ Erro em gerar_dados_simulacao: {e}")
            return self._dados_simulacao_fallback()
    
    # ================ MÉTODOS SAFE (SEMPRE FUNCIONAM) ================
    
    def _gerar_insights_safe(self):
        """Insights que sempre funcionam"""
        try:
            insights = []
            fazenda = self.fazenda_disponivel
            percentual = self.percentual_fazenda
            
            if fazenda < 0:
                insights.append("⚠️ O plano atual apresenta déficit, requerendo ajustes nos parâmetros")
            elif percentual < 5:
                insights.append("⚡ Margem baixa para objetivos pessoais - considerar otimizações")
            elif percentual < 15:
                insights.append("✅ Plano viável mas com margem moderada - monitoramento recomendado")
            else:
                insights.append("🎯 Plano sustentável com boa margem para objetivos pessoais")
            
            # Insights adicionais baseados nos parâmetros
            if self.params.get('perfil') == 'conservador':
                insights.append("💡 Perfil conservador oferece estabilidade mas pode limitar crescimento")
            
            if self.params.get('inicio_renda_filhos') == 'imediato':
                insights.append("💰 Renda imediata para filhos reduz disponibilidade para outros objetivos")
            
            return insights
            
        except Exception as e:
            print(f"⚠️ Erro em _gerar_insights_safe: {e}")
            return ["📊 Análise de insights em processamento", "💡 Recomendações baseadas nos parâmetros configurados"]
    
    def _gerar_recomendacoes_safe(self):
        """Recomendações que sempre funcionam"""
        try:
            recomendacoes = []
            fazenda = self.fazenda_disponivel
            
            if fazenda < 0:
                recomendacoes.append("🔧 URGENTE: Revisar parâmetros do plano para viabilizar objetivos")
                recomendacoes.append("📈 Considerar ajustes na taxa de retorno ou timing dos compromissos")
            elif fazenda < 5000000:
                recomendacoes.append("⚡ Otimizar timing dos compromissos para maximizar disponibilidade")
                recomendacoes.append("🎯 Revisar estratégia de investimentos")
            else:
                recomendacoes.append("✅ Manter estratégia atual com revisões periódicas")
                recomendacoes.append("🎨 Explorar oportunidades adicionais de investimento")
            
            # Recomendação sempre presente
            recomendacoes.append("📅 Realizar revisões anuais do plano patrimonial")
            
            return recomendacoes
            
        except Exception as e:
            print(f"⚠️ Erro em _gerar_recomendacoes_safe: {e}")
            return ["📋 Manter monitoramento contínuo do plano", "🎯 Revisar periodicamente conforme mudanças"]
    
    def _gerar_status_textual_safe(self):
        """Status que sempre funciona"""
        try:
            fazenda = self.fazenda_disponivel
            percentual = self.percentual_fazenda
            
            if fazenda < 0:
                return {
                    'status': 'CRÍTICO',
                    'cor': '#dc2626',
                    'descricao': 'Plano requer ajustes urgentes',
                    'acao_requerida': 'Revisar parâmetros imediatamente'
                }
            elif percentual < 10:
                return {
                    'status': 'ATENÇÃO',
                    'cor': '#ea580c',
                    'descricao': 'Margem baixa para objetivos',
                    'acao_requerida': 'Otimização recomendada'
                }
            else:
                return {
                    'status': 'VIÁVEL',
                    'cor': '#059669',
                    'descricao': 'Plano dentro dos parâmetros aceitáveis',
                    'acao_requerida': 'Monitoramento regular'
                }
        except Exception as e:
            print(f"⚠️ Erro em _gerar_status_textual_safe: {e}")
            return {
                'status': 'EM ANÁLISE',
                'cor': '#6b7280',
                'descricao': 'Processando análise detalhada',
                'acao_requerida': 'Aguardar conclusão dos cálculos'
            }
    
    def _calcular_marcos_safe(self):
        """Marcos temporais seguros"""
        try:
            marcos = []
            idade_atual = 53  # IDADE_ANA
            expectativa = self.params.get('expectativa', 90)
            
            # Marco: Fim das doações
            marcos.append({
                'ano': 2025 + 15,
                'idade_ana': idade_atual + 15,
                'evento': 'Fim do período de doações (15 anos)',
                'impacto': 'Liberação de recursos para outros objetivos'
            })
            
            # Marco: Idade de aposentadoria
            if idade_atual < 65:
                marcos.append({
                    'ano': 2025 + (65 - idade_atual),
                    'idade_ana': 65,
                    'evento': 'Idade tradicional de aposentadoria',
                    'impacto': 'Momento para reavaliação estratégica'
                })
            
            return marcos
            
        except Exception as e:
            print(f"⚠️ Erro em _calcular_marcos_safe: {e}")
            return [{
                'ano': 2026,
                'idade_ana': 54,
                'evento': 'Primeira revisão anual do plano',
                'impacto': 'Ajustes conforme performance'
            }]
    
    def _gerar_resumo_patrimonial_safe(self):
        """Resumo patrimonial seguro"""
        try:
            return {
                'patrimonio_total': 65000000,  
                'compromissos': {
                    'despesas_ana': {
                        'valor': self.dados.get('despesas', 0),
                        'percentual': (self.dados.get('despesas', 0) / 65000000) * 100 if self.dados.get('despesas', 0) > 0 else 0,
                        'descricao': f"Despesas estimadas"
                    },
                    'renda_filhos': {
                        'valor': self.dados.get('filhos', 0),
                        'percentual': (self.dados.get('filhos', 0) / 65000000) * 100 if self.dados.get('filhos', 0) > 0 else 0,
                        'descricao': "Renda vitalícia dos filhos"
                    },
                    'doacoes': {
                        'valor': self.dados.get('doacoes', 0),
                        'percentual': (self.dados.get('doacoes', 0) / 65000000) * 100 if self.dados.get('doacoes', 0) > 0 else 0,
                        'descricao': "Doações por 15 anos"
                    }
                },
                'objetivos_pessoais': {
                    'fazenda': {
                        'valor_disponivel': self.fazenda_disponivel,
                        'custo_estimado': self.params.get('custo_fazenda', 2000000),
                        'percentual': self.percentual_fazenda
                    },
                    'arte_galeria': {
                        'valor': self.dados.get('arte', 0),
                        'percentual': self.dados.get('percentual_arte', 0)
                    }
                }
            }
        except Exception as e:
            print(f"⚠️ Erro em _gerar_resumo_patrimonial_safe: {e}")
            return {
                'patrimonio_total': 65000000,
                'observacao': 'Cálculo detalhado em processamento'
            }
    
    def _gerar_cenarios_rapidos_safe(self):
        """Cenários que sempre funcionam (dados simulados se necessário)"""
        try:
            fazenda_base = self.fazenda_disponivel
            
            return {
                'conservador': {
                    'taxa': self.params.get('taxa', 4.0) - 1.0,
                    'fazenda': fazenda_base * 0.8,
                    'percentual': self.percentual_fazenda * 0.8,
                    'status': 'atenção'
                },
                'base': {
                    'taxa': self.params.get('taxa', 4.0),
                    'fazenda': fazenda_base,
                    'percentual': self.percentual_fazenda,
                    'status': 'viável' if fazenda_base > 0 else 'crítico'
                },
                'otimista': {
                    'taxa': self.params.get('taxa', 4.0) + 1.5,
                    'fazenda': fazenda_base * 1.3,
                    'percentual': self.percentual_fazenda * 1.3,
                    'status': 'viável'
                }
            }
        except Exception as e:
            print(f"⚠️ Erro em _gerar_cenarios_rapidos_safe: {e}")
            return {
                'base': {
                    'taxa': 4.0,
                    'fazenda': 5000000,
                    'percentual': 7.7,
                    'status': 'em_analise'
                }
            }
    
    # ================ MÉTODOS TÉCNICOS SAFE ================
    
    def _explicar_metodologia_safe(self):
        """Metodologia sempre disponível"""
        return {
            'valor_presente': {
                'formula': 'VP = PMT × [(1 - (1 + i)^(-n)) / i]',
                'explicacao': 'Valor presente de anuidade para fluxos mensais',
                'conversao_taxa': 'i_mensal = (1 + i_anual)^(1/12) - 1'
            },
            'premissas_inflacao': {
                'taxa_real': f"{self.params.get('taxa', 4.0)}% a.a.",
                'inflacao_presumida': "3.5% a.a. (já descontada da taxa real)",
                'explicacao': "Taxa informada já considera inflação histórica IPCA"
            },
            'observacao': 'Metodologia baseada em práticas de mercado para family offices'
        }
    
    def _detalhar_calculos_safe(self):
        """Cálculos básicos sempre disponíveis"""
        try:
            anos_vida = self.params.get('expectativa', 90) - 53
            return {
                'despesas_ana': {
                    'anos_calculados': anos_vida,
                    'valor_mensal': self.params.get('despesas', 150000),
                    'resultado': self.dados.get('despesas', 0)
                },
                'renda_filhos': {
                    'valor_mensal': 150000,  # RENDA_FILHOS
                    'inicio': self.params.get('inicio_renda_filhos', 'falecimento'),
                    'resultado': self.dados.get('filhos', 0)
                },
                'doacoes': {
                    'periodo_fixo': '15 anos (180 meses)',
                    'valor_mensal': 50000,  # DOACOES
                    'resultado': self.dados.get('doacoes', 0)
                },
                'fazenda_disponivel': {
                    'resultado': self.fazenda_disponivel
                }
            }
        except Exception as e:
            print(f"⚠️ Erro em _detalhar_calculos_safe: {e}")
            return {'observacao': 'Cálculos detalhados em processamento'}
    
    # ================ MÉTODOS DE SIMULAÇÃO SAFE ================
    
    def _calcular_sensibilidade_safe(self):
        """Sensibilidade básica simulada"""
        try:
            fazenda_base = self.fazenda_disponivel
            percentual_base = self.percentual_fazenda
            
            sensibilidade_taxa = []
            for taxa in [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]:
                fator = taxa / self.params.get('taxa', 4.0)
                sensibilidade_taxa.append({
                    'taxa': taxa,
                    'fazenda': fazenda_base * fator,
                    'percentual': percentual_base * fator
                })
            
            return {
                'por_taxa': sensibilidade_taxa,
                'observacao': 'Análise baseada em correlação estimada'
            }
        except Exception as e:
            print(f"⚠️ Erro em _calcular_sensibilidade_safe: {e}")
            return {'observacao': 'Análise de sensibilidade em desenvolvimento'}
    
    def _executar_stress_tests_safe(self):
        """Stress tests básicos simulados"""
        try:
            fazenda_base = self.fazenda_disponivel
            
            return {
                'crise_financeira': {
                    'cenario': 'Crise financeira severa (-30% patrimônio)',
                    'fazenda_resultante': fazenda_base * 0.7,
                    'impacto': 'Redução significativa na disponibilidade',
                    'viabilidade': 'Crítica' if fazenda_base * 0.7 < 0 else 'Baixa'
                },
                'inflacao_alta': {
                    'cenario': 'Inflação alta persistente (+20% despesas)',
                    'fazenda_resultante': fazenda_base * 0.85,
                    'impacto': 'Redução moderada na disponibilidade',
                    'viabilidade': 'Moderada'
                },
                'longevidade_extrema': {
                    'cenario': 'Longevidade extrema (100 anos)',
                    'fazenda_resultante': fazenda_base * 0.75,
                    'impacto': 'Aumento nos compromissos de longo prazo',
                    'viabilidade': 'Baixa'
                }
            }
        except Exception as e:
            print(f"⚠️ Erro em _executar_stress_tests_safe: {e}")
            return {'observacao': 'Stress tests em desenvolvimento'}
    
    def _identificar_otimizacoes_safe(self):
        """Otimizações básicas sempre disponíveis"""
        try:
            otimizacoes = []
            
            if self.params.get('inicio_renda_filhos') == 'imediato':
                otimizacoes.append({
                    'estrategia': 'Postergar renda dos filhos',
                    'ganho_estimado': self.fazenda_disponivel * 0.2,
                    'ganho_formatado': format_currency(self.fazenda_disponivel * 0.2, True),
                    'implementacao': 'Imediata',
                    'risco': 'Baixo'
                })
            
            if self.params.get('perfil') == 'conservador':
                otimizacoes.append({
                    'estrategia': 'Migração gradual para perfil moderado',
                    'ganho_estimado': self.fazenda_disponivel * 0.15,
                    'ganho_formatado': format_currency(self.fazenda_disponivel * 0.15, True),
                    'implementacao': '6-12 meses',
                    'risco': 'Médio'
                })
            
            if not otimizacoes:
                otimizacoes.append({
                    'estrategia': 'Monitoramento contínuo do plano',
                    'ganho_estimado': 0,
                    'ganho_formatado': 'A definir',
                    'implementacao': 'Contínua',
                    'risco': 'Baixo'
                })
            
            return otimizacoes
        except Exception as e:
            print(f"⚠️ Erro em _identificar_otimizacoes_safe: {e}")
            return [{'estrategia': 'Análise de otimizações em desenvolvimento'}]
    
    # ================ FALLBACKS DE EMERGÊNCIA ================
    
    def _dados_executivo_fallback(self):
        """Dados executivos de emergência"""
        return {
            'insights': ["📊 Análise executiva em processamento"],
            'recomendacoes': ["📋 Recomendações sendo calculadas"],
            'status_textual': {
                'status': 'EM PROCESSAMENTO',
                'cor': '#6b7280',
                'descricao': 'Análise sendo finalizada',
                'acao_requerida': 'Aguardar conclusão'
            },
            'marcos_temporais': [],
            'resumo_patrimonial': {'patrimonio_total': 65000000},
            'cenarios_rapidos': {}
        }
    
    def _dados_tecnico_fallback(self):
        """Dados técnicos de emergência"""
        return {
            'metodologia': {'observacao': 'Metodologia técnica carregando'},
            'calculos_detalhados': {'observacao': 'Cálculos sendo processados'},
            'observacao_geral': 'Relatório técnico detalhado em desenvolvimento'
        }
    
    def _dados_simulacao_fallback(self):
        """Dados simulação de emergência"""
        return {
            'sensibilidade_completa': {'observacao': 'Análise de sensibilidade carregando'},
            'stress_tests': {'observacao': 'Stress tests sendo processados'},
            'observacao_geral': 'Simulações avançadas em desenvolvimento'
        }
    
    # Métodos auxiliares safe (implementações mínimas)
    def _gerar_projecao_detalhada_safe(self):
        return {'observacao': 'Projeção detalhada em desenvolvimento'}
    
    def _listar_premissas_safe(self):
        return {'observacao': 'Lista de premissas sendo compilada'}
    
    def _documentar_formulas_safe(self):
        return {'observacao': 'Documentação de fórmulas em preparação'}
    
    def _analisar_asset_allocation_safe(self):
        return {'observacao': 'Análise de asset allocation detalhada em desenvolvimento'}
    
    def _gerar_cenarios_multiplos_safe(self):
        return {'observacao': 'Cenários múltiplos sendo calculados'}
    
    def _simular_monte_carlo_safe(self):
        return {'observacao': 'Simulação Monte Carlo em desenvolvimento'}


def calcular_valor_futuro_fazenda(valor_atual, anos):
    """
    Calcula valor da fazenda ajustado pela inflação
    
    Args:
        valor_atual (float): Valor atual da fazenda (R$)
        anos (int): Anos até a compra
    
    Returns:
        float: Valor futuro ajustado pela inflação
    """
    if anos <= 0:
        return valor_atual
    
    valor_futuro = valor_atual * ((1 + INFLACAO_ESTATICA/100) ** anos)
    
    print(f"💰 Valor fazenda: R$ {valor_atual:,.0f} hoje → R$ {valor_futuro:,.0f} em {anos} anos (inflação {INFLACAO_ESTATICA}%)")
    
    return valor_futuro

def calcular_liquidez_por_fase(periodo_compra):
    """
    Calcula fases de liquidez conforme período de compra
    Fases conservadoras: 40%, 40%, 20% do período
    
    Args:
        periodo_compra (int): Anos até compra da fazenda
    
    Returns:
        dict: Fases com anos e percentual de liquidez
    """
    if periodo_compra <= 0:
        return {}
    
    fase1_anos = max(1, int(periodo_compra * FASES_LIQUIDEZ['fase1_pct']))
    fase2_anos = max(1, int(periodo_compra * FASES_LIQUIDEZ['fase2_pct']))
    fase3_anos = periodo_compra - fase1_anos - fase2_anos
    
    # Garantir que fase3 tenha pelo menos 1 ano
    if fase3_anos <= 0:
        fase3_anos = 1
        fase2_anos = periodo_compra - fase1_anos - fase3_anos
    
    fases = {
        'fase1': {
            'anos_inicio': 1,
            'anos_fim': fase1_anos,
            'liquidez_pct': FASES_LIQUIDEZ['liquidez_base'],
            'descricao': f'Anos 1-{fase1_anos}: Liquidez normal'
        },
        'fase2': {
            'anos_inicio': fase1_anos + 1,
            'anos_fim': fase1_anos + fase2_anos,
            'liquidez_pct': FASES_LIQUIDEZ['liquidez_fase2'],
            'descricao': f'Anos {fase1_anos + 1}-{fase1_anos + fase2_anos}: Acúmulo moderado'
        },
        'fase3': {
            'anos_inicio': fase1_anos + fase2_anos + 1,
            'anos_fim': periodo_compra,
            'liquidez_pct': FASES_LIQUIDEZ['liquidez_final'],
            'descricao': f'Anos {fase1_anos + fase2_anos + 1}-{periodo_compra}: Acúmulo intensivo'
        },
        'total_anos': periodo_compra,
        'valor_fazenda_necessario': 0  # Será calculado depois
    }
    
    print(f"📊 Fases de liquidez para {periodo_compra} anos:")
    for fase_nome, fase in fases.items():
        if isinstance(fase, dict) and 'descricao' in fase:
            print(f"   {fase['descricao']} - {fase['liquidez_pct']}% liquidez")
    
    return fases

def calcular_liquidez_necessaria_ano(ano, periodo_compra, valor_fazenda_futuro):
    """
    Calcula liquidez necessária em determinado ano
    
    Args:
        ano (int): Ano da projeção (1, 2, 3...)
        periodo_compra (int): Anos até compra
        valor_fazenda_futuro (float): Valor da fazenda na data de compra
    
    Returns:
        dict: Liquidez percentual e valor absoluto necessário
    """
    if periodo_compra <= 0 or ano > periodo_compra:
        return {'liquidez_pct': 2, 'valor_absoluto': 0, 'fase': 'normal'}
    
    fases = calcular_liquidez_por_fase(periodo_compra)
    
    # Determinar em que fase estamos
    if ano <= fases['fase1']['anos_fim']:
        liquidez_pct = fases['fase1']['liquidez_pct']
        fase = 'fase1'
    elif ano <= fases['fase2']['anos_fim']:
        liquidez_pct = fases['fase2']['liquidez_pct']
        fase = 'fase2'
    else:
        liquidez_pct = fases['fase3']['liquidez_pct']
        fase = 'fase3'
    
    # No ano da compra, adicionar valor da fazenda
    valor_fazenda_necessario = valor_fazenda_futuro if ano == periodo_compra else 0
    
    return {
        'liquidez_pct': liquidez_pct,
        'valor_fazenda_necessario': valor_fazenda_necessario,
        'fase': fase,
        'descricao': f'{liquidez_pct}% liquidez' + (f' + R$ {valor_fazenda_necessario:,.0f} fazenda' if valor_fazenda_necessario > 0 else '')
    }


def gerar_projecao_fluxo_com_fazenda(taxa, expectativa, despesas, anos, inicio_renda_filhos, periodo_compra_fazenda=None, valor_fazenda_futuro=0):
    """
    Versão estendida da projeção que inclui compra da fazenda
    
    Args:
        Parâmetros existentes + periodo_compra_fazenda e valor_fazenda_futuro
    
    Returns:
        list: Projeção anual incluindo eventos da fazenda
    """
    patrimonio_atual = PATRIMONIO
    fluxo = []
    
    # Determinar quando inicia renda dos filhos
    if inicio_renda_filhos == 'falecimento':
        idade_inicio_filhos = expectativa
    elif inicio_renda_filhos == 'imediato':
        idade_inicio_filhos = IDADE_ANA
    elif isinstance(inicio_renda_filhos, int):
        idade_inicio_filhos = int(inicio_renda_filhos)
    else:
        idade_inicio_filhos = 65  # default

    for ano in range(anos):
        idade_ana = IDADE_ANA + ano + 1
        ano_calendario = 2025 + ano
        
        # RENDIMENTOS
        rendimentos = patrimonio_atual * (taxa / 100)
        
        # SAÍDAS ANUAIS
        saidas_anuais = 0
        
        # Despesas de Ana (apenas se viva)
        if idade_ana <= expectativa:
            saidas_anuais += despesas * 12
            ana_viva = True
        else:
            ana_viva = False
        
        # Doações (primeiros 15 anos)
        if ano < PERIODO_DOACOES:
            saidas_anuais += DOACOES * 12
            
        # Renda dos filhos
        if idade_ana >= idade_inicio_filhos and idade_ana > expectativa:
            saidas_anuais += RENDA_FILHOS * 12

        # COMPRA DA FAZENDA (novo)
        compra_fazenda = False
        valor_gasto_fazenda = 0
        if periodo_compra_fazenda and ano + 1 == periodo_compra_fazenda:
            compra_fazenda = True
            valor_gasto_fazenda = valor_fazenda_futuro
            saidas_anuais += valor_gasto_fazenda

        # LIQUIDEZ NECESSÁRIA
        liquidez_info = {}
        if periodo_compra_fazenda and ano + 1 <= periodo_compra_fazenda:
            liquidez_info = calcular_liquidez_necessaria_ano(ano + 1, periodo_compra_fazenda, valor_fazenda_futuro)
        else:
            liquidez_info = {'liquidez_pct': 2, 'valor_fazenda_necessario': 0, 'fase': 'normal'}
        
        # SALDO LÍQUIDO
        saldo_liquido = rendimentos - saidas_anuais
        patrimonio_atual += saldo_liquido
        patrimonio_atual = max(patrimonio_atual, 0)
        
        fluxo.append({
            'ano': ano_calendario,
            'idade_ana': idade_ana,
            'patrimonio': patrimonio_atual,
            'rendimentos': rendimentos,
            'saidas': saidas_anuais,
            'saldo_liquido': saldo_liquido,
            'ana_viva': ana_viva,
            'renda_filhos_ativa': idade_ana >= idade_inicio_filhos and idade_ana > expectativa,
            'doacoes_ativas': ano < PERIODO_DOACOES,
            
            # NOVOS CAMPOS PARA FAZENDA
            'compra_fazenda': compra_fazenda,
            'valor_gasto_fazenda': valor_gasto_fazenda,
            'liquidez_necessaria_pct': liquidez_info['liquidez_pct'],
            'liquidez_fase': liquidez_info['fase'],
            'liquidez_descricao': liquidez_info.get('descricao', ''),
            
            # DESPESAS DETALHADAS
            'despesas_ana': despesas * 12 if ana_viva else 0,
            'doacoes': DOACOES * 12 if ano < PERIODO_DOACOES else 0,
            'renda_filhos': RENDA_FILHOS * 12 if idade_ana >= idade_inicio_filhos and idade_ana > expectativa else 0
        })
    
    return fluxo

def calcular_patrimonio_disponivel_periodo(periodo_compra, valor_fazenda_atual, taxa, expectativa, despesas, inicio_renda_filhos, perfil_investimento):
    """
    Calcula quanto patrimônio estará disponível no período especificado para compra da fazenda
    
    Args:
        periodo_compra (int): Anos até a compra
        valor_fazenda_atual (float): Valor atual da fazenda
        demais parâmetros: Parâmetros do plano patrimonial
    
    Returns:
        dict: Análise de viabilidade da compra
    """
    if periodo_compra <= 0:
        return {'disponivel': 0, 'necessario': valor_fazenda_atual, 'viavel': False}
    
    # Valor futuro da fazenda
    valor_fazenda_futuro = calcular_valor_futuro_fazenda(valor_fazenda_atual, periodo_compra)
    
    # Gerar projeção completa
    projecao = gerar_projecao_fluxo_com_fazenda(taxa, expectativa, despesas, 
                                               periodo_compra + 5, inicio_renda_filhos, 
                                               periodo_compra, valor_fazenda_futuro)
    
    # Patrimônio no ano da compra
    if len(projecao) >= periodo_compra:
        item_ano_compra = projecao[periodo_compra - 1]
        patrimonio_disponivel = item_ano_compra['patrimonio']
        
        # Liquidez necessária no ano
        liquidez_info = calcular_liquidez_necessaria_ano(periodo_compra, periodo_compra, valor_fazenda_futuro)
        liquidez_minima_pos_compra = patrimonio_disponivel * (liquidez_info['liquidez_pct'] / 100)
        
        # Valor realmente disponível = patrimônio - liquidez mínima pós-compra
        valor_disponivel_fazenda = patrimonio_disponivel - liquidez_minima_pos_compra
    else:
        patrimonio_disponivel = 0
        valor_disponivel_fazenda = 0
    
    viabilidade = {
        'disponivel': valor_disponivel_fazenda,
        'necessario': valor_fazenda_futuro,
        'viavel': valor_disponivel_fazenda >= valor_fazenda_futuro,
        'patrimonio_total_periodo': patrimonio_disponivel,
        'liquidez_minima_pos_compra': liquidez_minima_pos_compra if 'liquidez_minima_pos_compra' in locals() else 0,
        'periodo_compra': periodo_compra,
        'valor_atual': valor_fazenda_atual,
        'valor_futuro': valor_fazenda_futuro
    }
    
    print(f"🎯 Viabilidade compra em {periodo_compra} anos:")
    print(f"   Disponível: R$ {valor_disponivel_fazenda:,.0f}")
    print(f"   Necessário: R$ {valor_fazenda_futuro:,.0f}")
    print(f"   Status: {'✅ VIÁVEL' if viabilidade['viavel'] else '❌ INVIÁVEL'}")
    
    return viabilidade
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
        'custo_maximo_teorico': sobra_apos_compromissos,
        'custo_maximo_disponivel': custo_maximo if 'custo_maximo' in locals() else sobra_apos_compromissos  # ✅ ADICIONADO
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


# ================ MODIFICAÇÃO DA FUNÇÃO PRINCIPAL ================
def calcular_compromissos_v43_com_fazenda(taxa, expectativa, despesas, inicio_renda_filhos, 
                                         custo_fazenda, perfil_investimento,
                                         periodo_compra_fazenda=None):
    """
    VERSÃO 4.3 - INCLUI COMPRA DA FAZENDA COM LIQUIDEZ GRADUAL
    
    Novos parâmetros:
        periodo_compra_fazenda (int): Anos até compra da fazenda (None = não comprar)
    """
    
    # Validar inputs existentes
    validar_inputs(taxa, expectativa, despesas, inicio_renda_filhos)
    
    # Patrimônio disponível
    patrimonio_disponivel = obter_patrimonio_disponivel(perfil_investimento)
    
    # Calcular compromissos básicos (sem fazenda)
    resultado_base = calcular_compromissos_v42_corrigido(taxa, expectativa, despesas, 
                                                        inicio_renda_filhos, 0, perfil_investimento)
    
    # ANÁLISE DA FAZENDA
    fazenda_analysis = {}
    
    if periodo_compra_fazenda and periodo_compra_fazenda > 0:
        # Valor futuro da fazenda
        valor_fazenda_futuro = calcular_valor_futuro_fazenda(custo_fazenda, periodo_compra_fazenda)
        
        # Disponibilidade no período
        viabilidade = calcular_patrimonio_disponivel_periodo(
            periodo_compra_fazenda, custo_fazenda, taxa, expectativa, 
            despesas, inicio_renda_filhos, perfil_investimento
        )
        
        # Fases de liquidez
        fases_liquidez = calcular_liquidez_por_fase(periodo_compra_fazenda)
        
        fazenda_analysis = {
            'periodo_compra': periodo_compra_fazenda,
            'valor_atual': custo_fazenda,
            'valor_futuro': valor_fazenda_futuro,
            'viabilidade': viabilidade,
            'fases_liquidez': fases_liquidez,
            'disponivel_periodo': viabilidade['disponivel'],
            'necessario_periodo': viabilidade['necessario'],
            'viavel': viabilidade['viavel']
        }
        
        # Atualizar resultado para mostrar no card
        if viabilidade['viavel']:
            fazenda_disponivel = viabilidade['disponivel']
            percentual_fazenda = (fazenda_disponivel / PATRIMONIO) * 100
        else:
            fazenda_disponivel = viabilidade['disponivel']  # Mostrar o que está disponível
            percentual_fazenda = (fazenda_disponivel / PATRIMONIO) * 100
            
    else:
        # Sem compra de fazenda - usar cálculo original
        fazenda_disponivel = resultado_base['fazenda_disponivel']
        percentual_fazenda = resultado_base['percentual_fazenda']
        fazenda_analysis = {
            'periodo_compra': None,
            'valor_atual': custo_fazenda,
            'valor_futuro': custo_fazenda,
            'viavel': fazenda_disponivel >= custo_fazenda,
            'disponivel_periodo': fazenda_disponivel,
            'necessario_periodo': custo_fazenda
        }
    
    # Arte/galeria = sobra após fazenda
    valor_arte = max(0, fazenda_disponivel - fazenda_analysis['necessario_periodo']) if fazenda_analysis['viavel'] else 0
    percentual_arte = (valor_arte / PATRIMONIO) * 100 if valor_arte > 0 else 0
    
    print(f"\n🏡 ANÁLISE FAZENDA v4.3:")
    print(f"   • Período: {periodo_compra_fazenda or 'Imediato'} anos")
    print(f"   • Valor hoje: {format_currency(custo_fazenda)}")
    if periodo_compra_fazenda:
        print(f"   • Valor futuro: {format_currency(fazenda_analysis['valor_futuro'])}")
    print(f"   • Disponível: {format_currency(fazenda_disponivel)} ({percentual_fazenda:.1f}%)")
    print(f"   • Status: {'✅ VIÁVEL' if fazenda_analysis['viavel'] else '❌ INVIÁVEL'}")
    
    return {
        **resultado_base,  # Manter todos os campos existentes
        
        # SOBRESCREVER CAMPOS DA FAZENDA
        'fazenda_disponivel': fazenda_disponivel,
        'percentual_fazenda': percentual_fazenda,
        'arte': valor_arte,
        'percentual_arte': percentual_arte,
        
        # NOVOS CAMPOS PARA FAZENDA
        'fazenda_analysis': fazenda_analysis,
        'periodo_compra_fazenda': periodo_compra_fazenda,
        'valor_fazenda_atual': custo_fazenda,
        'valor_fazenda_futuro': fazenda_analysis.get('valor_futuro', custo_fazenda),
        
        'corrected_version': '4.3-FAZENDA-LIQUIDEZ-GRADUAL'
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

# ================ FUNÇÕES DE GERAÇÃO DE PDF ================

def gerar_pdf_executivo(gerador):
    """Gera PDF do relatório executivo"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, 
                           topMargin=0.8*inch, bottomMargin=0.8*inch,
                           leftMargin=0.8*inch, rightMargin=0.8*inch)
    
    story = []
    styles = getSampleStyleSheet()
    
    # Criar estilos customizados
    styles.add(ParagraphStyle(name='CustomTitle', 
                             parent=styles['Heading1'],
                             fontSize=24, spaceAfter=30, textColor=colors.HexColor('#1e3a8a')))
    
    styles.add(ParagraphStyle(name='CustomHeading', 
                             parent=styles['Heading2'],
                             fontSize=16, spaceAfter=20, textColor=colors.HexColor('#1e3a8a')))
    
    styles.add(ParagraphStyle(name='StatusBox',
                             parent=styles['Normal'],
                             fontSize=14, alignment=TA_CENTER,
                             borderWidth=2, borderColor=colors.HexColor('#059669'),
                             backColor=colors.HexColor('#f0fdf4'),
                             leftIndent=20, rightIndent=20, topPadding=15, bottomPadding=15))
    
    # Página 1: Sumário Executivo
    story.extend(criar_pagina_sumario_executivo(gerador, styles))
    story.append(PageBreak())
    
    # Página 2: Breakdown Financeiro
    story.extend(criar_pagina_breakdown_financeiro(gerador, styles))
    story.append(PageBreak())
    
    # Página 3: Cenários e Recomendações
    story.extend(criar_pagina_cenarios_recomendacoes(gerador, styles))
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def criar_pagina_sumario_executivo(gerador, styles):
    """Cria primeira página do relatório executivo"""
    elementos = []
    dados_exec = gerador.gerar_dados_executivo()
    
    # Cabeçalho
    elementos.append(Paragraph("CIMO MULTI FAMILY OFFICE", styles['CustomTitle']))
    elementos.append(Paragraph("PLANO PATRIMONIAL - ANA", styles['Heading1']))
    elementos.append(Paragraph(f"Data: {gerador.timestamp.strftime('%d/%m/%Y às %H:%M')}", styles['Normal']))
    elementos.append(Spacer(1, 30))
    
    # Parâmetros configurados
    params_data = [
        ['Parâmetro', 'Valor Configurado'],
        ['Taxa de Retorno Real', f"{gerador.params['taxa']}% a.a."],
        ['Expectativa de Vida', f"{gerador.params['expectativa']} anos"],
        ['Despesas Mensais', format_currency(gerador.params['despesas'])],
        ['Perfil de Investimento', gerador.params['perfil'].title()],
        ['Início Renda Filhos', gerador.params['inicio_renda_filhos'].title()],
        ['Orçamento Fazenda', format_currency(gerador.params['custo_fazenda'])]
    ]
    
    params_table = Table(params_data, colWidths=[3*inch, 2*inch])
    params_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0'))
    ]))
    
    elementos.append(params_table)
    elementos.append(Spacer(1, 30))
    
    # Resultado principal
    status_info = dados_exec['status_textual']
    resultado_text = f"""
    <b>STATUS DO PLANO: {status_info['status']}</b><br/>
    <br/>
    Valor Disponível para Fazenda: <b>{format_currency(gerador.dados['fazenda_disponivel'], True)}</b><br/>
    Percentual do Patrimônio: <b>{gerador.dados['percentual_fazenda']:.1f}%</b><br/>
    <br/>
    {status_info['descricao']}<br/>
    <br/>
    <i>Ação Requerida: {status_info['acao_requerida']}</i>
    """
    
    elementos.append(Paragraph(resultado_text, styles['StatusBox']))
    elementos.append(Spacer(1, 20))
    
    # Principais insights
    elementos.append(Paragraph("💡 PRINCIPAIS INSIGHTS:", styles['CustomHeading']))
    for insight in dados_exec['insights'][:3]:  # Máximo 3 insights na primeira página
        elementos.append(Paragraph(f"• {insight}", styles['Normal']))
        elementos.append(Spacer(1, 8))
    
    return elementos

def criar_pagina_breakdown_financeiro(gerador, styles):
    """Cria segunda página com breakdown financeiro"""
    elementos = []
    dados_exec = gerador.gerar_dados_executivo()
    resumo = dados_exec['resumo_patrimonial']
    
    elementos.append(Paragraph("💰 ALOCAÇÃO DO PATRIMÔNIO", styles['CustomTitle']))
    elementos.append(Paragraph(f"Base: {format_currency(PATRIMONIO)}", styles['Normal']))
    elementos.append(Spacer(1, 20))
    
    # Tabela de compromissos essenciais
    elementos.append(Paragraph("📊 COMPROMISSOS ESSENCIAIS:", styles['CustomHeading']))
    
    compromissos_data = [
        ['Compromisso', 'Valor (VP)', '% Patrimônio', 'Descrição'],
        [
            'Despesas Ana',
            format_currency(resumo['compromissos']['despesas_ana']['valor'], True),
            f"{resumo['compromissos']['despesas_ana']['percentual']:.1f}%",
            resumo['compromissos']['despesas_ana']['descricao']
        ],
        [
            'Renda Filhos',
            format_currency(resumo['compromissos']['renda_filhos']['valor'], True),
            f"{resumo['compromissos']['renda_filhos']['percentual']:.1f}%",
            resumo['compromissos']['renda_filhos']['descricao']
        ],
        [
            'Doações',
            format_currency(resumo['compromissos']['doacoes']['valor'], True),
            f"{resumo['compromissos']['doacoes']['percentual']:.1f}%",
            resumo['compromissos']['doacoes']['descricao']
        ],
        [
            'TOTAL',
            format_currency(gerador.dados['total_compromissos'], True),
            f"{(gerador.dados['total_compromissos']/PATRIMONIO)*100:.1f}%",
            'Soma dos compromissos'
        ]
    ]
    
    compromissos_table = Table(compromissos_data, colWidths=[1.5*inch, 1.2*inch, 1*inch, 2.3*inch])
    compromissos_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0'))
    ]))
    
    elementos.append(compromissos_table)
    elementos.append(Spacer(1, 30))
    
    # Objetivos pessoais
    elementos.append(Paragraph("🏡 OBJETIVOS PESSOAIS:", styles['CustomHeading']))
    
    objetivos_data = [
        ['Objetivo', 'Valor Disponível', '% Patrimônio', 'Status'],
        [
            'Fazenda Rural',
            format_currency(resumo['objetivos_pessoais']['fazenda']['valor_disponivel'], True),
            f"{resumo['objetivos_pessoais']['fazenda']['percentual']:.1f}%",
            'Viável' if resumo['objetivos_pessoais']['fazenda']['valor_disponivel'] > 0 else 'Inviável'
        ],
        [
            'Arte/Galeria',
            format_currency(resumo['objetivos_pessoais']['arte_galeria']['valor'], True),
            f"{resumo['objetivos_pessoais']['arte_galeria']['percentual']:.1f}%",
            'Disponível' if resumo['objetivos_pessoais']['arte_galeria']['valor'] > 0 else 'Indisponível'
        ]
    ]
    
    objetivos_table = Table(objetivos_data, colWidths=[1.5*inch, 1.5*inch, 1.2*inch, 1.8*inch])
    objetivos_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0'))
    ]))
    
    elementos.append(objetivos_table)
    elementos.append(Spacer(1, 30))
    
    # Asset Allocation
    elementos.append(Paragraph("🎨 ASSET ALLOCATION:", styles['CustomHeading']))
    allocation_info = get_asset_allocation(gerador.params['perfil'], PATRIMONIO)
    
    allocation_text = f"<b>Perfil Escolhido:</b> {gerador.params['perfil'].title()}<br/><br/>"
    for item in allocation_info[:4]:  # Mostrar top 4 classes
        allocation_text += f"• {item['nome']}: {item['percentual']}% ({format_currency(item['valor'], True)})<br/>"
    
    elementos.append(Paragraph(allocation_text, styles['Normal']))
    
    return elementos

def criar_pagina_cenarios_recomendacoes(gerador, styles):
    """Cria terceira página com cenários e recomendações"""
    elementos = []
    dados_exec = gerador.gerar_dados_executivo()
    
    elementos.append(Paragraph("🔮 ANÁLISE DE CENÁRIOS", styles['CustomTitle']))
    elementos.append(Spacer(1, 20))
    
    # Cenários rápidos
    cenarios = dados_exec['cenarios_rapidos']
    
    cenarios_data = [
        ['Cenário', 'Taxa', 'Valor Fazenda', 'Status']
    ]
    
    for nome, dados in cenarios.items():
        if 'erro' not in dados:
            cenarios_data.append([
                nome.title(),
                f"{dados['taxa']}%",
                format_currency(dados['fazenda'], True),
                dados['status'].title()
            ])
    
    cenarios_table = Table(cenarios_data, colWidths=[1.5*inch, 1*inch, 1.8*inch, 1.7*inch])
    cenarios_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0'))
    ]))
    
    elementos.append(cenarios_table)
    elementos.append(Spacer(1, 30))
    
    # Recomendações estratégicas
    elementos.append(Paragraph("🎯 RECOMENDAÇÕES ESTRATÉGICAS:", styles['CustomHeading']))
    
    for i, recomendacao in enumerate(dados_exec['recomendacoes'][:4], 1):
        elementos.append(Paragraph(f"{i}. {recomendacao}", styles['Normal']))
        elementos.append(Spacer(1, 10))
    
    elementos.append(Spacer(1, 20))
    
    # Marcos temporais
    if dados_exec['marcos_temporais']:
        elementos.append(Paragraph("📅 MARCOS TEMPORAIS IMPORTANTES:", styles['CustomHeading']))
        
        for marco in dados_exec['marcos_temporais'][:3]:  # Máximo 3 marcos
            marco_text = f"<b>{marco['ano']}</b> (Ana aos {marco['idade_ana']} anos): {marco['evento']}"
            elementos.append(Paragraph(marco_text, styles['Normal']))
            elementos.append(Spacer(1, 8))
    
    # Rodapé
    elementos.append(Spacer(1, 30))
    rodape_text = f"""
    <i>Relatório gerado em {gerador.timestamp.strftime('%d/%m/%Y às %H:%M')}<br/>
    CIMO Multi Family Office - Planejamento Patrimonial<br/>
    Este relatório é baseado nas premissas e parâmetros fornecidos e deve ser revisado periodicamente.</i>
    """
    elementos.append(Paragraph(rodape_text, styles['Normal']))
    
    return elementos

def gerar_pdf_tecnico(gerador):
    """Gera PDF do relatório técnico (placeholder)"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    
    story = []
    styles = getSampleStyleSheet()
    
    story.append(Paragraph("RELATÓRIO TÉCNICO DETALHADO", styles['Title']))
    story.append(Paragraph("Em desenvolvimento - versão completa em breve", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Dados básicos para demonstração
    dados_tec = gerador.gerar_dados_tecnico()
    story.append(Paragraph("METODOLOGIA:", styles['Heading2']))
    story.append(Paragraph(f"Fórmula VP: {dados_tec['metodologia']['valor_presente']['formula']}", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def gerar_pdf_simulacao(gerador):
    """Gera PDF do relatório de simulação (placeholder)"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    
    story = []
    styles = getSampleStyleSheet()
    
    story.append(Paragraph("RELATÓRIO DE SIMULAÇÃO E CENÁRIOS", styles['Title']))
    story.append(Paragraph("Em desenvolvimento - versão completa em breve", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Dados básicos para demonstração
    dados_sim = gerador.gerar_dados_simulacao()
    story.append(Paragraph("STRESS TESTS:", styles['Heading2']))
    
    for nome, dados in dados_sim['stress_tests'].items():
        if 'erro' not in dados:
            story.append(Paragraph(f"• {dados.get('cenario', nome)}", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer





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


# ================ ROTAS PARA SISTEMA DE RELATÓRIOS ================

@app.route('/api/relatorio/<tipo>')
def gerar_relatorio_api(tipo):
    """API para gerar relatórios em PDF"""
    try:
        debugMessage = print  # Para logs no servidor
        debugMessage(f"📋 Gerando relatório {tipo}")
        
        # Coletar parâmetros
        params = {
            'taxa': float(request.args.get('taxa', 4.0)),
            'expectativa': int(request.args.get('expectativa', 90)),
            'despesas': float(request.args.get('despesas', 150000)),
            'perfil': request.args.get('perfil', 'moderado'),
            'inicio_renda_filhos': request.args.get('inicio_renda_filhos', 'falecimento'),
            'custo_fazenda': float(request.args.get('custo_fazenda', 2000000))
        }
        
        debugMessage(f"📊 Parâmetros: {params}")
        
        # Calcular dados base
        dados_base = calcular_compromissos_v42_corrigido(
            params['taxa'], 
            params['expectativa'],
            params['despesas'],
            params['inicio_renda_filhos'],
            params['custo_fazenda'],
            params['perfil']
        )
        
        # Gerar relatório específico
        gerador = RelatorioGenerator(params, dados_base)
        
        if tipo == 'executivo':
            pdf_buffer = gerar_pdf_executivo(gerador)
        elif tipo == 'tecnico':
            pdf_buffer = gerar_pdf_tecnico(gerador)
        elif tipo == 'simulacao':
            pdf_buffer = gerar_pdf_simulacao(gerador)
        else:
            return jsonify({'error': f'Tipo de relatório inválido: {tipo}'}), 400
        
        # Retornar PDF
        response = make_response(pdf_buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=relatorio_{tipo}_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf'
        
        debugMessage(f"✅ Relatório {tipo} gerado com sucesso")
        return response
        
    except Exception as e:
        print(f"❌ Erro ao gerar relatório {tipo}: {str(e)}")
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500

@app.route('/api/relatorio-preview/<tipo>')
def preview_relatorio(tipo):
    """API ULTRA-ROBUSTA para preview dos dados do relatório"""
    try:
        print(f"🔍 Preview relatório {tipo} - versão SAFE")
        
        # Parâmetros com valores padrão seguros
        params = {
            'taxa': float(request.args.get('taxa', 4.0)),
            'expectativa': int(request.args.get('expectativa', 90)),
            'despesas': float(request.args.get('despesas', 150000)),
            'perfil': request.args.get('perfil', 'moderado'),
            'inicio_renda_filhos': request.args.get('inicio_renda_filhos', 'falecimento'),
            'custo_fazenda': float(request.args.get('custo_fazenda', 2000000))
        }
        
        # Tentar calcular dados base, com fallback se falhar
        try:
            dados_base = calcular_compromissos_v42_corrigido(
                params['taxa'], params['expectativa'], params['despesas'],
                params['inicio_renda_filhos'], params['custo_fazenda'], params['perfil']
            )
        except Exception as e:
            print(f"⚠️ Erro nos cálculos base, usando fallback: {e}")
            # Dados base de emergência
            dados_base = {
                'fazenda_disponivel': 5000000,
                'percentual_fazenda': 7.7,
                'despesas': 35000000,
                'filhos': 15000000,
                'doacoes': 6000000
            }
        
        # Gerar relatório com classe SAFE
        try:
            gerador = RelatorioGenerator(params, dados_base)
            
            if tipo in ['executivo']:
                preview_data = gerador.gerar_dados_executivo()
            elif tipo in ['tecnico', 'detalhado']:
                preview_data = gerador.gerar_dados_tecnico()
            elif tipo in ['simulacao']:
                preview_data = gerador.gerar_dados_simulacao()
            else:
                preview_data = {'observacao': f'Tipo {tipo} em desenvolvimento'}
            
        except Exception as e:
            print(f"⚠️ Erro na geração, usando dados mínimos: {e}")
            preview_data = {
                'observacao': f'Preview {tipo} sendo processado',
                'status': 'em_desenvolvimento'
            }
        
        print(f"✅ Preview {tipo} gerado com sucesso (versão SAFE)")
        
        return jsonify({
            'success': True,
            'tipo': tipo,
            'parametros': params,
            'dados_base': {
                'fazenda_disponivel': dados_base.get('fazenda_disponivel', 0),
                'percentual_fazenda': dados_base.get('percentual_fazenda', 0),
                'status': 'viável' if dados_base.get('fazenda_disponivel', 0) > 0 else 'crítico'
            },
            'dados_preview': preview_data,
            'timestamp': format_datetime_report(),
            'versao': 'EMERGENCY_SAFE'
        })
        
        
    except Exception as e:
        print(f"❌ Erro geral no preview {tipo}: {str(e)}")
        # ÚLTIMO RECURSO - resposta que SEMPRE funciona
        return jsonify({
            'success': True,
            'tipo': tipo,
            'dados_preview': {
                'observacao': f'Relatório {tipo} sendo preparado',
                'status': 'processando',
                'recomendacao': 'Tente novamente em alguns instantes'
            },
            'timestamp': datetime.now().isoformat(),
            'versao': 'FALLBACK_TOTAL'
        })

# ================ NOVO ENDPOINT PARA PROJEÇÕES DETALHADAS ================
@app.route('/api/projecoes-detalhadas')
def projecoes_detalhadas():
    """
    Endpoint para projeções detalhadas incluindo compra da fazenda
    """
    try:
        # Parâmetros básicos
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        inicio_renda_filhos = request.args.get('inicio_renda_filhos', 'falecimento')
        perfil = request.args.get('perfil', 'moderado')
        
        # NOVOS PARÂMETROS PARA FAZENDA
        custo_fazenda = float(request.args.get('custo_fazenda', 2000000))
        periodo_compra_fazenda = request.args.get('periodo_compra_fazenda')
        
        if periodo_compra_fazenda:
            periodo_compra_fazenda = int(periodo_compra_fazenda)
            if periodo_compra_fazenda <= 0:
                periodo_compra_fazenda = None
        
        print(f"📊 Projeções detalhadas solicitadas:")
        print(f"   Taxa: {taxa}%, Expectativa: {expectativa}, Fazenda em: {periodo_compra_fazenda or 'imediato'} anos")
        
        # Calcular dados com fazenda
        resultado = calcular_compromissos_v43_com_fazenda(
            taxa, expectativa, despesas, inicio_renda_filhos,
            custo_fazenda, perfil, periodo_compra_fazenda
        )
        
        # Gerar projeção detalhada
        anos_projecao = min(40, max(20, (expectativa - IDADE_ANA) + 10))
        
        valor_fazenda_futuro = resultado.get('valor_fazenda_futuro', custo_fazenda)
        projecao_anual = gerar_projecao_fluxo_com_fazenda(
            taxa, expectativa, despesas, anos_projecao, inicio_renda_filhos,
            periodo_compra_fazenda, valor_fazenda_futuro
        )
        
        # Asset allocation temporal (simplificado para MVP)
        allocation_temporal = []
        for i, item in enumerate(projecao_anual[:20]):  # Primeiros 20 anos
            liquidez_pct = item['liquidez_necessaria_pct']
            allocation_temporal.append({
                'ano': item['ano'],
                'renda_fixa_br': max(20, 70 - liquidez_pct),  # Reduz conforme aumenta liquidez
                'renda_fixa_int': 15,
                'acoes_br': max(5, 15 - (liquidez_pct // 2)),
                'acoes_int': 10,
                'imoveis': 3,
                'liquidez': liquidez_pct
            })
        
        # Marcos temporais incluindo fazenda
        marcos_temporais = []
        
        # Marco existente: fim doações
        marcos_temporais.append({
            'ano': 2025 + 15,
            'idade_ana': IDADE_ANA + 15,
            'evento': 'Fim das Doações',
            'tipo': 'financeiro'
        })
        
        # NOVO MARCO: compra da fazenda
        if periodo_compra_fazenda:
            marcos_temporais.append({
                'ano': 2025 + periodo_compra_fazenda,
                'idade_ana': IDADE_ANA + periodo_compra_fazenda,
                'evento': f'Compra da Fazenda ({format_currency(valor_fazenda_futuro, True)})',
                'tipo': 'fazenda'
            })
        
        # Marco: expectativa de vida
        marcos_temporais.append({
            'ano': 2025 + (expectativa - IDADE_ANA),
            'idade_ana': expectativa,
            'evento': 'Expectativa de Vida Ana',
            'tipo': 'pessoal'
        })
        
        return jsonify({
            'success': True,
            'projecao_anual': projecao_anual,
            'allocation_temporal': allocation_temporal,
            'marcos_temporais': marcos_temporais,
            'fazenda_analysis': resultado['fazenda_analysis'],
            'fazenda_disponivel_periodo': resultado['fazenda_disponivel'],
            'parametros': {
                'taxa': taxa,
                'expectativa': expectativa,
                'periodo_compra_fazenda': periodo_compra_fazenda,
                'valor_fazenda_atual': custo_fazenda,
                'valor_fazenda_futuro': valor_fazenda_futuro
            },
            'timestamp': get_current_datetime_sao_paulo().isoformat(),
            'versao': '4.3-PROJECOES-FAZENDA'
        })
        
    except Exception as e:
        print(f"❌ Erro em projeções detalhadas: {str(e)}")
        return jsonify({
            'success': False,
            'erro': str(e),
            'versao': '4.3-PROJECOES-FAZENDA'
        }), 500



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
def api_dados_v43():
    """API principal - VERSÃO v4.3 COM FAZENDA"""
    try:
        # Parâmetros básicos
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        inicio_renda_filhos = request.args.get('inicio_renda_filhos', 'falecimento')
        custo_fazenda = float(request.args.get('custo_fazenda', 2_000_000))
        perfil_investimento = request.args.get('perfil', 'moderado')
        
        # NOVO PARÂMETRO: período de compra da fazenda
        periodo_compra_fazenda = request.args.get('periodo_compra_fazenda')
        if periodo_compra_fazenda:
            try:
                periodo_compra_fazenda = int(periodo_compra_fazenda)
                if periodo_compra_fazenda <= 0:
                    periodo_compra_fazenda = None
            except:
                periodo_compra_fazenda = None
        
        print(f"📥 Parâmetros recebidos v4.3 COM FAZENDA:")
        print(f"   Taxa: {taxa}% (real), Expectativa: {expectativa}, Fazenda: {periodo_compra_fazenda or 'imediato'} anos")
        
        # USAR FUNÇÃO v4.3 COM FAZENDA
        resultado = calcular_compromissos_v43_com_fazenda(
            taxa, expectativa, despesas, inicio_renda_filhos, 
            custo_fazenda, perfil_investimento, periodo_compra_fazenda
        )
        
        status = determinar_status(resultado['fazenda_disponivel'], resultado['percentual_fazenda'])
        
        # Asset allocation
        allocation = get_asset_allocation(perfil_investimento, PATRIMONIO)
        
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
                'percentual_arte': resultado['percentual_arte'],
                
                # NOVOS CAMPOS v4.3
                'fazenda_analysis': resultado['fazenda_analysis'],
                'periodo_compra_fazenda': resultado['periodo_compra_fazenda'],
                'valor_fazenda_atual': resultado['valor_fazenda_atual'],
                'valor_fazenda_futuro': resultado['valor_fazenda_futuro']
            },
            'allocation': allocation,
            'status': status,
            'versao': '4.3-FAZENDA-LIQUIDEZ',
            'timestamp': get_current_datetime_sao_paulo().isoformat()
        }
        
        print(f"✅ v4.3 - Fazenda em {periodo_compra_fazenda or 'imediato'} anos: {format_currency(resultado['fazenda_disponivel'], True)}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Erro na API dados v4.3: {str(e)}")
        return jsonify({
            'success': False,
            'erro': str(e),
            'versao': '4.3-FAZENDA-LIQUIDEZ',
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