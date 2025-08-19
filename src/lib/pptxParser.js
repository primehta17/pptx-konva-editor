// src/lib/pptxParser.js
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

// Parse a PPTX file into slides usable in Editor.jsx
export async function parsePptxFile(file, { width = 960, height = 540 } = {}) {
  const zip = await JSZip.loadAsync(file);
  const parser = new XMLParser({ ignoreAttributes: false });

  const slides = [];

  // Get all slide XML files
  const slideFiles = Object.keys(zip.files).filter((f) =>
    f.match(/^ppt\/slides\/slide\d+\.xml$/)
  );
  slideFiles.sort(); // ensure slide1, slide2 order

  for (const slidePath of slideFiles) {
    const xml = await zip.file(slidePath).async("text");
    const slide = parser.parse(xml);

    const objects = [];

    // --- Parse relationships (map rId -> target path) ---
    const relPath = slidePath.replace("slides/", "slides/_rels/") + ".rels";
    let rels = {};
    if (zip.files[relPath]) {
      const relXml = await zip.file(relPath).async("text");
      const relJson = parser.parse(relXml);
      const relArr = relJson.Relationships?.Relationship || [];
      (Array.isArray(relArr) ? relArr : [relArr]).forEach((r) => {
        rels[r["@_Id"]] = r["@_Target"];
      });
    }

    const spTree = slide["p:sld"]?.["p:cSld"]?.["p:spTree"] || {};

    // --- Background (image or solid fill) ---
    const bg = slide["p:sld"]?.["p:cSld"]?.["p:bg"];
    if (bg?.["p:bgPr"]?.["a:blipFill"]?.["a:blip"]) {
      const embedId = bg["p:bgPr"]["a:blipFill"]["a:blip"]["@_r:embed"];
      if (embedId && rels[embedId]) {
        const target = "ppt/" + rels[embedId].replace("..", "");
        if (zip.files[target]) {
          const blob = await zip.file(target).async("blob");
          const url = URL.createObjectURL(blob);
          objects.push({
            id: "bg-" + Math.random().toString(36).slice(2, 9),
            type: "image",
            x: 0,
            y: 0,
            width,
            height,
            src: url,
            isBackground: true,
          });
        }
      }
    } else if (bg?.["p:bgPr"]?.["a:solidFill"]?.["a:srgbClr"]) {
      const color = "#" + bg["p:bgPr"]["a:solidFill"]["a:srgbClr"]["@_val"];
      objects.push({
        id: "bgcolor-" + Math.random().toString(36).slice(2, 9),
        type: "rect",
        x: 0,
        y: 0,
        width,
        height,
        fill: color,
        isBackground: true,
      });
    }

    // --- Parse text shapes ---
    const shapes = spTree["p:sp"] ? [].concat(spTree["p:sp"]) : [];

    for (const sp of shapes) {
      const txBody = sp["p:txBody"];
      if (txBody && txBody["a:p"]) {
        const paras = [].concat(txBody["a:p"]);
        const text = paras
          .map((p) => {
            const runs = [].concat(p["a:r"] || []);
            return runs.map((r) => r["a:t"]).join("");
          })
          .join("\n");

        if (text.trim().length > 0) {
          objects.push({
            id: "txt-" + Math.random().toString(36).slice(2, 9),
            type: "text",
            x: 100,
            y: 100,
            text,
            fontSize: 24,
          });
        }
      }
    }

    // --- Parse inserted pictures ---
    const pics = spTree["p:pic"] ? [].concat(spTree["p:pic"]) : [];
    for (const pic of pics) {
      const blip = pic["p:blipFill"]?.["a:blip"];
      const embedId = blip?.["@_r:embed"];
      if (embedId && rels[embedId]) {
        const target = "ppt/" + rels[embedId].replace("..", "");
        if (zip.files[target]) {
          const blob = await zip.file(target).async("blob");
          const url = URL.createObjectURL(blob);
          objects.push({
            id: "img-" + Math.random().toString(36).slice(2, 9),
            type: "image",
            x: 200,
            y: 200,
            width: 300,
            height: 200,
            src: url,
          });
        }
      }
    }

    slides.push({
      id: "slide-" + Math.random().toString(36).slice(2, 9),
      width,
      height,
      objects,
    });
  }

  return slides;
}
