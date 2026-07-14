# Diário de Treino

App estático baseado no PDF `Treino_Iniciante_Upper_Lower_Atualizado.pdf`.

## Como usar

Abra `index.html` no navegador. Os dados ficam salvos no próprio navegador usando `localStorage`.

Para usar como app no iPhone, publique a pasta em um host HTTPS simples, como GitHub Pages, Netlify ou Vercel. Depois abra o link no Safari e escolha `Compartilhar > Adicionar à Tela de Início`.

## Treinos incluídos

- Superior A
- Inferior A
- Superior B
- Inferior B

Cada exercício segue a estrutura `1x12 leve + 1x6 intermediária + 2x8-10 trabalho`.

## Gráficos

O app usa o histórico salvo no navegador para mostrar:

- volume das últimas sessões;
- evolução da maior carga por exercício nas séries de trabalho.

## Relatório do dia

O botão `Relatório do dia` exporta uma planilha `.xlsx` apenas com a data selecionada no app. O nome do arquivo pode ser editado no campo `Nome do relatório`.
