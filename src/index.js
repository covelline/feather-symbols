const fs = require("fs")
const path = require("path")
const StringDecoder = require("string_decoder").StringDecoder
const SVGIcons2SVGFontStream = require("svgicons2svgfont")
const svg2ttf = require("svg2ttf")
const SVGO = require("svgo")
const { Readable } = require("stream")

const dir = "svg"
const buildDir = process.argv[2] || "build"
const fontName = "feather-symbols"
const optimizeSVG = true

const svgicons2svgfontOptions = {
  fontFamilyName: fontName,
  fontHeight: 1024,
  normalize: true,
}

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".svg"))
  .map((f) => path.join(dir, f))

const createSvgStream = async (file, optimize) => {
  if (optimize) {
    const svg = fs.readFileSync(file, "utf8")
    const svgo = new SVGO()
    const res = await svgo.optimize(svg)
    return Readable.from(res.data)
  } else {
    return fs.createReadStream(file)
  }
}

Promise.all(
  files.map(async (file) => {
    const stream = await createSvgStream(file, optimizeSVG)
    const name = path.basename(file, ".svg")

    stream.metadata = {
      unicode: [name],
      name: name,
    }
    return stream
  })
)
  .then((streams) => {
    return new Promise((resolve) => {
      let font = ""
      const decoder = new StringDecoder("utf8")

      const stream = new SVGIcons2SVGFontStream({
        ...svgicons2svgfontOptions,
        log: console.log,
        error: console.error,
      })

      stream
        .on("data", function (chunk) {
          font += decoder.write(chunk)
        })
        .on("finish", function () {
          resolve(font)
        })

      streams.forEach(function (glyph) {
        stream.write(glyph)
      })
      stream.end()
    })
  })
  .then((svg) => {
    const font = svg2ttf(svg, {})
    const fontFile = Buffer.from(font.buffer)

    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir)
    }

    return fs.promises.writeFile(
      path.join(buildDir, `${fontName}.ttf`),
      fontFile
    )
  })
