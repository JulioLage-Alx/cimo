#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flask Backend - Plano Patrimonial Ana
Cimo Family Office
Versão 3.0 - Com sistema de relatórios completo
"""

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

# ================ FUNÇÕES DE GRÁFICOS ================
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
        print(f"Erro ao criar gráfico: {e}")
        return None

def criar_grafico_sensibilidade(sensibilidade):
    """Cria gráfico de sensibilidade em base64"""
    try:
        fig, ax = plt.subplots(figsize=(10, 6))
        
        taxas = [item['taxa'] for item in sensibilidade]
        valores = [item['fazenda'] / 1000000 for item in sensibilidade]  # Em milhões
        
        ax.plot(taxas, valores, marker='o', linewidth=3, markersize=8, color='#1e3a8a')
        ax.fill_between(taxas, valores, alpha=0.3, color='#1e3a8a')
        ax.set_xlabel('Taxa de Retorno (%)', fontsize=12)
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
        print(f"Erro ao criar gráfico de sensibilidade: {e}")
        return None

# ================ FUNÇÕES DE RELATÓRIOS ================
def format_currency(value):
    """Formata valor como moeda brasileira"""
    if value >= 1000000:
        return f"R$ {value/1000000:.1f}M"
    elif value >= 1000:
        return f"R$ {value/1000:.0f}k"
    else:
        return f"R$ {value:,.0f}".replace(',', '.')

def gerar_relatorio_executivo(dados):
    """Gera relatório executivo em PDF"""
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
    
    # Resumo Executivo
    story.append(Paragraph("RESUMO EXECUTIVO", styles['Heading2']))
    
    resultado = dados['resultado']
    patrimonio = dados['patrimonio']
    status = dados['status']
    
    resumo_text = f"""
    <b>Patrimônio Total:</b> {format_currency(patrimonio)}<br/>
    <b>Valor Disponível para Fazenda:</b> {format_currency(resultado['fazenda'])}<br/>
    <b>Percentual do Patrimônio:</b> {resultado['percentual']:.1f}%<br/>
    <b>Status do Plano:</b> {status.title()}<br/>
    """
    
    story.append(Paragraph(resumo_text, styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Análise de Compromissos
    story.append(Paragraph("ANÁLISE DE COMPROMISSOS", styles['Heading2']))
    
    # Tabela de compromissos
    compromissos_data = [
        ['Categoria', 'Valor (R$)', '% do Patrimônio'],
        ['Despesas Ana', format_currency(resultado['despesas']), f"{(resultado['despesas']/patrimonio*100):.1f}%"],
        ['Renda Filhos', format_currency(resultado['filhos']), f"{(resultado['filhos']/patrimonio*100):.1f}%"],
        ['Doações', format_currency(resultado['doacoes']), f"{(resultado['doacoes']/patrimonio*100):.1f}%"],
        ['Total Compromissos', format_currency(resultado['total']), f"{(resultado['total']/patrimonio*100):.1f}%"],
        ['Disponível Fazenda', format_currency(resultado['fazenda']), f"{resultado['percentual']:.1f}%"]
    ]
    
    compromissos_table = Table(compromissos_data)
    compromissos_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(compromissos_table)
    story.append(Spacer(1, 20))
    
    # Análise de Sensibilidade
    story.append(Paragraph("ANÁLISE DE SENSIBILIDADE", styles['Heading2']))
    
    sensibilidade_text = """
    A análise de sensibilidade demonstra o impacto de diferentes taxas de retorno 
    no valor disponível para a fazenda. Os resultados indicam os pontos críticos 
    para a sustentabilidade do plano patrimonial.
    """
    story.append(Paragraph(sensibilidade_text, styles['Normal']))
    story.append(Spacer(1, 10))
    
    # Tabela de sensibilidade (primeiros 5 cenários)
    sens_data = [['Taxa de Retorno', 'Valor Fazenda', 'Status']]
    for item in dados['sensibilidade'][:5]:
        status_item = "Viável" if item['fazenda'] > 0 else "Inviável"
        sens_data.append([
            f"{item['taxa']}%",
            format_currency(item['fazenda']),
            status_item
        ])
    
    sens_table = Table(sens_data)
    sens_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(sens_table)
    story.append(Spacer(1, 20))
    
    # Recomendações
    story.append(Paragraph("RECOMENDAÇÕES", styles['Heading2']))
    
    if resultado['fazenda'] > 0:
        recomendacoes = """
        • O plano atual é sustentável com as premissas estabelecidas<br/>
        • Monitorar taxas de retorno para manter acima de 3.5% ao ano<br/>
        • Considerar diversificação adicional para reduzir riscos<br/>
        • Revisar periodicamente as projeções de despesas
        """
    else:
        recomendacoes = """
        • <b>AÇÃO REQUERIDA:</b> O plano atual não é sustentável<br/>
        • Considerar redução de despesas mensais<br/>
        • Avaliar postergação da renda dos filhos<br/>
        • Buscar estratégias para aumentar a taxa de retorno<br/>
        • Revisar cronograma de doações
        """
    
    story.append(Paragraph(recomendacoes, styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Rodapé
    footer_text = f"""
    <br/><br/>
    ---<br/>
    Relatório gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')}<br/>
    CIMO Multi Family Office - Plano Patrimonial Ana
    """
    story.append(Paragraph(footer_text, styles['Normal']))
    
    # Gerar PDF
    doc.build(story)
    buffer.seek(0)
    return buffer

def gerar_relatorio_detalhado(dados):
    """Gera relatório detalhado em PDF"""
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
    
    # Parâmetros da Análise
    story.append(Paragraph("PARÂMETROS DA ANÁLISE", styles['Heading2']))
    
    parametros = dados['parametros']
    param_text = f"""
    <b>Taxa de Retorno:</b> {parametros['taxa']}% ao ano<br/>
    <b>Expectativa de Vida:</b> {parametros['expectativa']} anos<br/>
    <b>Despesas Mensais:</b> {format_currency(parametros['despesas'])}<br/>
    <b>Patrimônio Base:</b> {format_currency(dados['patrimonio'])}<br/>
    <b>Data da Análise:</b> {datetime.now().strftime('%d/%m/%Y')}<br/>
    """
    story.append(Paragraph(param_text, styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Asset Allocation
    story.append(Paragraph("ASSET ALLOCATION", styles['Heading2']))
    
    allocation_data = [['Classe de Ativo', 'Percentual', 'Valor (R$)']]
    for item in dados['allocation']:
        allocation_data.append([
            item['nome'],
            f"{item['percentual']}%",
            format_currency(item['valor'])
        ])
    
    allocation_table = Table(allocation_data)
    allocation_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(allocation_table)
    story.append(Spacer(1, 20))
    
    # Fluxo de Caixa Projetado
    if 'fluxo_caixa' in dados and dados['fluxo_caixa']:
        story.append(Paragraph("PROJEÇÃO DE FLUXO DE CAIXA", styles['Heading2']))
        
        fluxo_data = [['Ano', 'Idade Ana', 'Patrimônio', 'Rendimentos', 'Saídas']]
        for item in dados['fluxo_caixa'][:10]:  # Primeiros 10 anos
            fluxo_data.append([
                str(item['ano']),
                f"{item['idade_ana']} anos",
                format_currency(item['patrimonio']),
                format_currency(item['rendimentos']),
                format_currency(item['saidas'])
            ])
        
        fluxo_table = Table(fluxo_data)
        fluxo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(fluxo_table)
        story.append(Spacer(1, 20))
    
    # Análise de Sensibilidade Completa
    story.append(Paragraph("ANÁLISE DE SENSIBILIDADE COMPLETA", styles['Heading2']))
    
    sens_completa_data = [['Taxa', 'Valor Fazenda', '% Patrimônio', 'Status']]
    for item in dados['sensibilidade']:
        if item['fazenda'] >= 0:
            status = "Viável"
            if item['percentual'] < 5:
                status = "Crítico"
        else:
            status = "Inviável"
            
        sens_completa_data.append([
            f"{item['taxa']}%",
            format_currency(item['fazenda']),
            f"{item['percentual']:.1f}%",
            status
        ])
    
    sens_completa_table = Table(sens_completa_data)
    sens_completa_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(sens_completa_table)
    
    # Gerar PDF
    doc.build(story)
    buffer.seek(0)
    return buffer

# ================ ROTAS ================
@app.route('/')
def home():
    """Página inicial"""
    return '''
    <h1>🏢 Cimo Family Office</h1>
    <h2>📊 Plano Patrimonial Ana - v3.0</h2>
    <p><a href="/dashboard">📈 Ir para Dashboard</a></p>
    <p><a href="/api/teste">🧪 Testar API</a></p>
    <p><a href="/api/dados">📊 Ver Dados</a></p>
    <p><a href="/api/relatorio/executivo">📄 Gerar Relatório Executivo</a></p>
    '''

@app.route('/dashboard')
def dashboard():
    """Dashboard principal"""
    try:
        if os.path.exists('templates/index.html'):
            with open('templates/index.html', 'r', encoding='utf-8') as f:
                content = f.read()
            return content
        else:
            return '''
            <h1>❌ Erro</h1>
            <p>Arquivo index.html não encontrado.</p>
            <p>Certifique-se de que o arquivo index.html está na mesma pasta que app.py</p>
            <p><a href="/">← Voltar</a></p>
            ''', 404
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
        import matplotlib.pyplot as plt
        import matplotlib.patches as patches
        from io import BytesIO
        
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
        buffer = BytesIO()
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
        # Fallback final para texto
        return jsonify({
            'erro': 'Logo não encontrada',
            'path_esperado': 'templates/logo.png',
            'solucao': 'Certifique-se que o arquivo logo.png está na pasta templates/'
        }), 404

# ================ ROTA PARA DEBUG DA LOGO ================

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
        <title>Debug Logo CIMO</title>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 20px; }}
            .success {{ color: green; }}
            .error {{ color: red; }}
            .info {{ background: #f0f0f0; padding: 10px; margin: 10px 0; }}
            img {{ max-width: 300px; border: 1px solid #ccc; margin: 10px 0; }}
        </style>
    </head>
    <body>
        <h1>🐛 Debug Logo CIMO</h1>
        
        <h2>Status do Arquivo:</h2>
        <p class="{'success' if debug_info['arquivo_existe'] else 'error'}">
            Arquivo existe: {debug_info['arquivo_existe']}
        </p>
        
        <div class="info">
            <strong>Path completo:</strong> {debug_info['path_completo']}<br>
            <strong>Diretório atual:</strong> {debug_info['diretorio_atual']}<br>
            <strong>Tamanho:</strong> {debug_info['tamanho_arquivo'] or 'N/A'}
        </div>
        
        <h2>Arquivos na pasta templates/:</h2>
        <ul>
            {''.join([f'<li>{arquivo}</li>' for arquivo in debug_info['arquivos_templates']])}
        </ul>
        
        <h2>Teste da Logo:</h2>
        <p>Logo atual: <img src="/logo.png" alt="Logo CIMO" style="height: 60px;"></p>
        
        <h2>Soluções:</h2>
        <ol>
            <li>Certifique-se que o arquivo está em: <code>templates/logo.png</code></li>
            <li>Verifique se o arquivo não está corrompido</li>
            <li>Teste acessando diretamente: <a href="/logo.png">/logo.png</a></li>
        </ol>
        
        <hr>
        <p><a href="/dashboard">← Voltar ao Dashboard</a></p>
    </body>
    </html>
    '''
    
    return html_debug

@app.route('/api/logo/info')
def logo_info():
    """Retorna informações sobre a logo em JSON"""
    logo_path = os.path.join('templates', 'logo.png')
    
    info = {
        'success': os.path.exists(logo_path),
        'path': logo_path,
        'url': '/logo.png',
        'type': 'image/png',
        'size_bytes': os.path.getsize(logo_path) if os.path.exists(logo_path) else None,
        'timestamp': datetime.now().isoformat()
    }
    
    if os.path.exists(logo_path):
        try:
            # Tentar obter dimensões da imagem
            from PIL import Image
            with Image.open(logo_path) as img:
                info['dimensions'] = {
                    'width': img.width,
                    'height': img.height,
                    'format': img.format,
                    'mode': img.mode
                }
        except Exception as e:
            info['dimensions_error'] = str(e)
    
    return jsonify(info)

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
            {'nome': 'Renda Fixa BR', 'valor': 42_250_000, 'percentual': 65},
            {'nome': 'Renda Fixa Int', 'valor': 9_750_000, 'percentual': 15},
            {'nome': 'Fundos Imobiliários', 'valor': 6_500_000, 'percentual': 10},
            {'nome': 'Ações', 'valor': 3_250_000, 'percentual': 5},
            {'nome': 'Reserva de Liquidez', 'valor': 3_250_000, 'percentual': 5}
        ]
        
        # Projeção de fluxo de caixa
        fluxo_caixa = gerar_projecao_fluxo(taxa)
        
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
                'despesas': despesas
            },
            'timestamp': datetime.now().isoformat()
        }
        
        # Log dos dados para debug
        print(f"📊 Dados calculados - Taxa: {taxa}%, Fazenda: R$ {resultado['fazenda']:,.0f}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Erro na API dados: {str(e)}")
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
        'version': '3.0',
        'patrimonio': f'R$ {PATRIMONIO:,.0f}',
        'cliente': f'Ana, {IDADE_ANA} anos',
        'despesas_base': f'R$ {DESPESAS_BASE:,.0f}/mês',
        'server_time': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
        'features': {
            'relatorios_pdf': True,
            'graficos_matplotlib': True,
            'charts_fallback': True
        },
        'endpoints': {
            'dashboard': '/dashboard',
            'dados': '/api/dados',
            'teste': '/api/teste',
            'logo': '/api/logo',
            'relatorio_executivo': '/api/relatorio/executivo',
            'relatorio_detalhado': '/api/relatorio/detalhado'
        }
    })

@app.route('/api/health')
def api_health():
    """Health check endpoint adicional"""
    return api_teste()

@app.route('/api/logo')
def logo():
    """Redireciona para o logo SVG"""
    return logo_png()

# ================ CORREÇÃO DO CHART.JS ================
@app.route('/api/chartjs-status')
def chartjs_status():
    """Endpoint para verificar status do Chart.js"""
    return jsonify({
        'success': True,
        'chart_js_url': 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.min.js',
        'fallback_urls': [
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js',
            'https://unpkg.com/chart.js@4.4.0/dist/chart.min.js'
        ],
        'timestamp': datetime.now().isoformat()
    })

# ================ NOVOS ENDPOINTS PARA GRÁFICOS ================
@app.route('/api/dados/allocation')
def api_dados_allocation():
    """API específica para dados de allocation"""
    try:
        # Asset allocation detalhado
        allocation_detalhada = [
            {'nome': 'Renda Fixa Nacional', 'valor': 26_000_000, 'percentual': 40, 'retorno': 3.5, 'risco': 3},
            {'nome': 'Renda Fixa Internacional', 'valor': 9_750_000, 'percentual': 15, 'retorno': 2.5, 'risco': 4},
            {'nome': 'Multimercado', 'valor': 9_750_000, 'percentual': 15, 'retorno': 4.5, 'risco': 6},
            {'nome': 'Ações Brasil', 'valor': 6_500_000, 'percentual': 10, 'retorno': 6.0, 'risco': 20},
            {'nome': 'Ações Internacionais', 'valor': 6_500_000, 'percentual': 10, 'retorno': 5.5, 'risco': 16},
            {'nome': 'Imóveis/REITs', 'valor': 3_250_000, 'percentual': 5, 'retorno': 4.0, 'risco': 10},
            {'nome': 'Reserva de Liquidez', 'valor': 3_250_000, 'percentual': 5, 'retorno': 1.5, 'risco': 1}
        ]
        
        # Benchmark para comparação
        benchmark = [
            {'nome': 'Renda Fixa Nacional', 'percentual': 50},
            {'nome': 'Renda Fixa Internacional', 'percentual': 15},
            {'nome': 'Multimercado', 'percentual': 15},
            {'nome': 'Ações Brasil', 'percentual': 10},
            {'nome': 'Ações Internacionais', 'percentual': 8},
            {'nome': 'Imóveis/REITs', 'percentual': 2},
            {'nome': 'Reserva de Liquidez', 'percentual': 0}
        ]
        
        return jsonify({
            'success': True,
            'allocation': allocation_detalhada,
            'benchmark': benchmark,
            'total_patrimonio': PATRIMONIO,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'erro': str(e)
        }), 500

@app.route('/api/dados/projecoes')
def api_dados_projecoes():
    """API específica para dados de projeções"""
    try:
        taxa = float(request.args.get('taxa', 4.0))
        
        # Gerar projeções para diferentes cenários
        anos = 20
        cenarios = {
            'conservador': {'taxa': 3.0, 'cor': '#ea580c'},
            'moderado': {'taxa': 4.5, 'cor': '#3b82f6'},
            'agressivo': {'taxa': 6.0, 'cor': '#059669'}
        }
        
        projecoes = {}
        for nome, config in cenarios.items():
            patrimonio_atual = PATRIMONIO
            dados = []
            
            for ano in range(anos):
                idade_ana = IDADE_ANA + ano + 1
                ano_calendario = 2025 + ano
                
                # Rendimentos
                rendimentos = patrimonio_atual * (config['taxa'] / 100)
                
                # Saídas
                saidas = DESPESAS_BASE * 12
                if idade_ana >= 65:
                    saidas += RENDA_FILHOS * 12
                if ano < 15:
                    saidas += DOACOES * 12
                
                # Saldo
                saldo = rendimentos - saidas
                patrimonio_atual += saldo
                
                dados.append({
                    'ano': ano_calendario,
                    'patrimonio': max(patrimonio_atual, 0),
                    'rendimentos': rendimentos,
                    'saidas': saidas,
                    'saldo': saldo
                })
            
            projecoes[nome] = {
                'dados': dados,
                'taxa': config['taxa'],
                'cor': config['cor']
            }
        
        return jsonify({
            'success': True,
            'projecoes': projecoes,
            'patrimonio_inicial': PATRIMONIO,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'erro': str(e)
        }), 500

@app.route('/api/dados/simulacoes')
def api_dados_simulacoes():
    """API específica para dados de simulações Monte Carlo"""
    try:
        import random
        
        # Parâmetros da simulação
        num_simulacoes = 100  # Reduzido para performance
        anos = 20
        taxa_base = 4.0
        volatilidade = 0.15
        
        simulacoes = []
        
        for sim in range(num_simulacoes):
            patrimonio_atual = PATRIMONIO
            dados_sim = []
            
            for ano in range(anos):
                # Taxa de retorno aleatória (distribuição normal)
                taxa_ano = random.normalvariate(taxa_base, volatilidade * 100) / 100
                taxa_ano = max(taxa_ano, -0.30)  # Limitar perdas máximas
                
                # Calcular evolução
                rendimentos = patrimonio_atual * taxa_ano
                saidas = DESPESAS_BASE * 12
                
                if (IDADE_ANA + ano) >= 65:
                    saidas += RENDA_FILHOS * 12
                if ano < 15:
                    saidas += DOACOES * 12
                
                patrimonio_atual = patrimonio_atual + rendimentos - saidas
                patrimonio_atual = max(patrimonio_atual, 0)
                
                dados_sim.append({
                    'ano': 2025 + ano,
                    'patrimonio': patrimonio_atual
                })
            
            simulacoes.append(dados_sim)
        
        # Calcular estatísticas
        valores_finais = [sim[-1]['patrimonio'] for sim in simulacoes]
        valores_finais.sort()
        
        estatisticas = {
            'p10': valores_finais[int(0.1 * len(valores_finais))],
            'p50': valores_finais[int(0.5 * len(valores_finais))],
            'p90': valores_finais[int(0.9 * len(valores_finais))],
            'media': sum(valores_finais) / len(valores_finais),
            'min': min(valores_finais),
            'max': max(valores_finais)
        }
        
        return jsonify({
            'success': True,
            'simulacoes': simulacoes[:20],  # Retornar apenas algumas para o gráfico
            'estatisticas': estatisticas,
            'parametros': {
                'num_simulacoes': num_simulacoes,
                'taxa_base': taxa_base,
                'volatilidade': volatilidade,
                'anos': anos
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'erro': str(e)
        }), 500

# ================ ENDPOINT PARA DEBUGGING ================
@app.route('/api/debug/frontend')
def debug_frontend():
    """Endpoint para ajudar no debug do frontend"""
    return jsonify({
        'status': 'OK',
        'server_time': datetime.now().isoformat(),
        'chart_js_status': 'Chart.js deve ser carregado do CDN',
        'logo_url': '/logo.svg',
        'endpoints_graficos': {
            'dados_gerais': '/api/dados',
            'allocation': '/api/dados/allocation',
            'projecoes': '/api/dados/projecoes',
            'simulacoes': '/api/dados/simulacoes'
        },
        'chart_js_urls': [
            'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.min.js',
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js'
        ]
    })

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

# ================ ROTAS DE RELATÓRIOS ================
@app.route('/api/relatorio/executivo')
def relatorio_executivo():
    """Gera e baixa relatório executivo em PDF"""
    try:
        # Pegar parâmetros ou usar defaults
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        
        # Calcular dados
        resultado = calcular_compromissos(taxa, expectativa, despesas)
        status = determinar_status(resultado['fazenda'], resultado['percentual'])
        
        # Análise de sensibilidade
        sensibilidade = []
        for t in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]:
            calc = calcular_compromissos(t, expectativa, despesas)
            sensibilidade.append({
                'taxa': t,
                'fazenda': calc['fazenda'],
                'percentual': calc['percentual']
            })
        
        # Asset allocation
        allocation = [
            {'nome': 'Renda Fixa BR', 'valor': 42_250_000, 'percentual': 65},
            {'nome': 'Renda Fixa Int', 'valor': 9_750_000, 'percentual': 15},
            {'nome': 'Fundos Imobiliários', 'valor': 6_500_000, 'percentual': 10},
            {'nome': 'Ações', 'valor': 3_250_000, 'percentual': 5},
            {'nome': 'Reserva de Liquidez', 'valor': 3_250_000, 'percentual': 5}
        ]
        
        dados = {
            'patrimonio': PATRIMONIO,
            'resultado': resultado,
            'sensibilidade': sensibilidade,
            'allocation': allocation,
            'status': status,
            'parametros': {
                'taxa': taxa,
                'expectativa': expectativa,
                'despesas': despesas
            }
        }
        
        # Gerar PDF
        pdf_buffer = gerar_relatorio_executivo(dados)
        
        # Preparar resposta
        response = make_response(pdf_buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=relatorio_executivo_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf'
        
        print(f"📄 Relatório executivo gerado para taxa {taxa}%")
        return response
        
    except Exception as e:
        print(f"❌ Erro ao gerar relatório executivo: {str(e)}")
        return jsonify({
            'success': False,
            'erro': f'Erro ao gerar relatório: {str(e)}'
        }), 500

@app.route('/api/relatorio/detalhado')
def relatorio_detalhado():
    """Gera e baixa relatório detalhado em PDF"""
    try:
        # Pegar parâmetros ou usar defaults
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        
        # Calcular dados
        resultado = calcular_compromissos(taxa, expectativa, despesas)
        status = determinar_status(resultado['fazenda'], resultado['percentual'])
        
        # Análise de sensibilidade
        sensibilidade = []
        for t in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]:
            calc = calcular_compromissos(t, expectativa, despesas)
            sensibilidade.append({
                'taxa': t,
                'fazenda': calc['fazenda'],
                'percentual': calc['percentual']
            })
        
        # Asset allocation
        allocation = [
            {'nome': 'Renda Fixa BR', 'valor': 42_250_000, 'percentual': 65},
            {'nome': 'Renda Fixa Int', 'valor': 9_750_000, 'percentual': 15},
            {'nome': 'Fundos Imobiliários', 'valor': 6_500_000, 'percentual': 10},
            {'nome': 'Ações', 'valor': 3_250_000, 'percentual': 5},
            {'nome': 'Reserva de Liquidez', 'valor': 3_250_000, 'percentual': 5}
        ]
        
        # Fluxo de caixa
        fluxo_caixa = gerar_projecao_fluxo(taxa, 20)  # 20 anos para relatório detalhado
        
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
                'despesas': despesas
            }
        }
        
        # Gerar PDF
        pdf_buffer = gerar_relatorio_detalhado(dados)
        
        # Preparar resposta
        response = make_response(pdf_buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=relatorio_detalhado_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf'
        
        print(f"📄 Relatório detalhado gerado para taxa {taxa}%")
        return response
        
    except Exception as e:
        print(f"❌ Erro ao gerar relatório detalhado: {str(e)}")
        return jsonify({
            'success': False,
            'erro': f'Erro ao gerar relatório: {str(e)}'
        }), 500

@app.route('/api/relatorio/json')
def relatorio_json():
    """Retorna dados do relatório em formato JSON para o frontend processar"""
    try:
        # Pegar parâmetros
        taxa = float(request.args.get('taxa', 4.0))
        expectativa = int(request.args.get('expectativa', 90))
        despesas = float(request.args.get('despesas', 150000))
        
        # Calcular dados
        resultado = calcular_compromissos(taxa, expectativa, despesas)
        status = determinar_status(resultado['fazenda'], resultado['percentual'])
        
        # Criar gráficos
        grafico_compromissos = criar_grafico_compromissos(resultado)
        
        # Análise de sensibilidade
        sensibilidade = []
        for t in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]:
            calc = calcular_compromissos(t, expectativa, despesas)
            sensibilidade.append({
                'taxa': t,
                'fazenda': calc['fazenda'],
                'percentual': calc['percentual']
            })
        
        grafico_sensibilidade = criar_grafico_sensibilidade(sensibilidade)
        
        return jsonify({
            'success': True,
            'patrimonio': PATRIMONIO,
            'resultado': resultado,
            'status': status,
            'sensibilidade': sensibilidade,
            'graficos': {
                'compromissos': grafico_compromissos,
                'sensibilidade': grafico_sensibilidade
            },
            'parametros': {
                'taxa': taxa,
                'expectativa': expectativa,
                'despesas': despesas
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Erro ao gerar dados do relatório: {str(e)}")
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
            '/api/cenarios',
            '/api/relatorio/executivo',
            '/api/relatorio/detalhado',
            '/api/relatorio/json'
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
    print("🚀 Cimo Family Office - Plano Patrimonial v3.0")
    print("=" * 60)
    print(f"📊 Patrimônio Ana: R$ {PATRIMONIO:,.0f}")
    print(f"👤 Idade atual: {IDADE_ANA} anos")
    print(f"💰 Despesas base: R$ {DESPESAS_BASE:,.0f}/mês")
    print("=" * 60)
    print("🆕 NOVIDADES v3.0:")
    print("   • 📄 Geração de relatórios PDF")
    print("   • 📊 Gráficos com matplotlib")
    print("   • 🎯 Sistema robusto de fallback")
    print("   • 💾 Downloads automáticos")
    print("=" * 60)
    print("🌐 Servidor rodando em:")
    print("   • Home: http://localhost:5000")
    print("   • Dashboard: http://localhost:5000/dashboard")
    print("   • API Dados: http://localhost:5000/api/dados")
    print("   • Relatório PDF: http://localhost:5000/api/relatorio/executivo")
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