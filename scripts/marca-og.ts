// Gera as imagens de marca que o site serve: a imagem de compartilhamento
// (public/marca/og.jpg) e o ícone de Apple (src/app/apple-icon.png).
// Rodar a partir da raiz: npx tsx scripts/marca-og.ts
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CANVAS = { r: 248, g: 243, b: 234 } // --ritu-canvas, tema claro
const PRIMARY = { r: 158, g: 75, b: 43 } // --ritu-primary, tema claro

const CAPA = resolve(RAIZ, "design/login-cover.jpeg")
const LOGO_COMPLETO = resolve(RAIZ, "design/ritu-logo.jpeg")
const SIMBOLO = resolve(RAIZ, "public/marca/simbolo-ritu.png")
const SAIDA_OG = resolve(RAIZ, "public/marca/og.jpg")
const SAIDA_APPLE = resolve(RAIZ, "src/app/apple-icon.png")

const OG_LARGURA = 1200
const OG_ALTURA = 630
const OG_IMAGEM_LARGURA = 660
const OG_LOGO_LARGURA = 320

// Tira a marca de um arquivo com fundo claro (ou de um PNG com transparência):
// a cor do traço vira `cor` e a opacidade vem da escuridão de cada pixel.
async function tintaDeFundoClaro(
  caminho: string,
  recorte: { left: number; top: number; width: number; height: number },
  cor: { r: number; g: number; b: number },
): Promise<{ buffer: Buffer; largura: number; altura: number }> {
  const base = sharp(caminho).extract(recorte).greyscale()
  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true })
  const alfa = Buffer.alloc(info.width * info.height)
  for (let i = 0; i < data.length; i++) {
    const v = ((228 - (data[i] ?? 228)) / (228 - 70)) * 255
    alfa[i] = Math.max(0, Math.min(255, Math.round(v)))
  }
  const alfaPng = await sharp(alfa, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .png()
    .toBuffer()
  const buffer = await sharp({
    create: { width: info.width, height: info.height, channels: 3, background: cor },
  })
    .joinChannel(alfaPng)
    .png()
    .toBuffer()
  return { buffer, largura: info.width, altura: info.height }
}

async function simboloTintado(tamanho: number): Promise<Buffer> {
  const alfa = await sharp(SIMBOLO).resize(tamanho, tamanho).extractChannel(3).png().toBuffer()
  return sharp({
    create: { width: tamanho, height: tamanho, channels: 3, background: PRIMARY },
  })
    .joinChannel(alfa)
    .png()
    .toBuffer()
}

async function geraOg(): Promise<void> {
  const capa = await sharp(CAPA)
    .extract({ left: 522, top: 0, width: 1878, height: 1792 })
    .resize(OG_IMAGEM_LARGURA, OG_ALTURA)
    .toBuffer()

  const logo = await tintaDeFundoClaro(
    LOGO_COMPLETO,
    { left: 400, top: 175, width: 400, height: 550 },
    PRIMARY,
  )
  const logoAltura = Math.round((OG_LOGO_LARGURA * logo.altura) / logo.largura)
  const logoPng = await sharp(logo.buffer).resize(OG_LOGO_LARGURA, logoAltura).png().toBuffer()

  const painelLargura = OG_LARGURA - OG_IMAGEM_LARGURA
  await sharp({
    create: { width: OG_LARGURA, height: OG_ALTURA, channels: 3, background: CANVAS },
  })
    .composite([
      { input: capa, left: 0, top: 0 },
      {
        input: logoPng,
        left: OG_IMAGEM_LARGURA + Math.round((painelLargura - OG_LOGO_LARGURA) / 2),
        top: Math.round((OG_ALTURA - logoAltura) / 2),
      },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(SAIDA_OG)
}

async function geraApple(): Promise<void> {
  const tamanho = 180
  const marca = await simboloTintado(132)
  await sharp({
    create: { width: tamanho, height: tamanho, channels: 3, background: CANVAS },
  })
    .composite([{ input: marca, left: 24, top: 24 }])
    .png()
    .toFile(SAIDA_APPLE)
}

await geraOg()
await geraApple()
console.log("og.jpg e apple-icon.png gerados")
