const fs = require("fs")
const path = require("path")
const StringDecoder = require("string_decoder").StringDecoder
const SVGIcons2SVGFontStream = require("svgicons2svgfont")
const svg2ttf = require("svg2ttf")
const SVGO = require("svgo")

const inputDir = "svg"
const optimizedDir = "svg-optimized"
const buildDir = process.argv[2] || "build"
const fontName = "feather-symbols"

const svgicons2svgfontOptions = {
  fontName,
  fontHeight: 1024,
  normalize: true,
}

const findSVGFiles = (dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => path.join(dir, f))

const optimize = async (inputDir, outputDir) => {
  const optimizeSVG = async (file) => {
    const svg = fs.readFileSync(file, "utf8")
    const svgo = new SVGO()
    const res = await svgo.optimize(svg)
    const dest = path.join(outputDir, path.basename(file))
    fs.writeFileSync(dest, res.data)
    return dest
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  return await Promise.all(findSVGFiles(inputDir).map(optimizeSVG))
}

optimize(inputDir, optimizedDir)
  .then((files) =>
    Promise.all(
      files.map(async (file) => {
        const stream = fs.createReadStream(file)
        const name = path.basename(file, ".svg")

        stream.metadata = {
          unicode: [name],
          name: name,
        }
        return stream
      })
    )
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

    fs.writeFileSync(path.join(buildDir, `${fontName}.ttf`), fontFile)
  })
