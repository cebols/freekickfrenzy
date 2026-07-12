# Free Kick Frenzy ⚽

Jogo de cobrança de falta para navegador, inspirado no clássico "Shoot'em In!".

Mova o jogador dentro do semicírculo com o mouse e clique para chutar: a
distância ao centro define a **força**, e o desvio lateral em relação à reta
bola–gol define a **direção** do chute. Mire nos ângulos superiores para
pontuar mais (1–100 por gol, com estrelas e platina).

## Rodando

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # produção (dist/)
```

## Arquitetura

- **Canvas 2D** para o jogo, **DOM** para menus/HUD — sem engine.
- Física **pseudo-3D**: a simulação é 3D de verdade (x lateral, y profundidade,
  z altura) com gravidade e arrasto; o render projeta para a vista vertical e
  desenha a sombra no chão separada da bola para dar leitura de altura.
- Fases **data-driven** em `src/levels/levels.ts` (posição da bola, tamanho da
  barreira, goleiro).

```
src/
  main.ts            bootstrap, game loop (física em timestep fixo), UI DOM
  game/game.ts       máquina de estados: título → mira → voo → resultado
  sim/kick.ts        clique no semicírculo → velocidade inicial (tuning aqui)
  sim/ball.ts        voo da bola + colisões (chão, barreira, goleiro, traves)
  sim/world.ts       constantes físicas do mundo (metros)
  levels/levels.ts   definição das fases
  scoring/score.ts   score 1–100 pela proximidade do ângulo + estrelas
  render/camera.ts   projeção mundo (metros) → tela (pixels)
  render/renderer.ts desenho do campo, gol, jogadores, bola, mira
```

## Roadmap

- [x] **Etapa 1 — core jogável**: mira, chute, voo 3D, gol/defesa/trave
- [x] **Etapa 2 — física completa**: efeito (Magnus), vento randômico com
      indicador, traves como cilindros, goleiro reativo com skill por fase
- [x] **Etapa 3 — meta-jogo**: alvos ¼ de círculo nos ângulos, 9 fases,
      seleção de fases com estrelas persistidas (localStorage)
- [x] **Etapa 4 — polish**: bonecos articulados com expressões, bola
      girando, replay em câmera lenta, sons WebAudio sintetizados (com
      mute), barreira que pula, mergulho do goleiro, torcida que vibra,
      rede que segura a bola e tela de título animada
