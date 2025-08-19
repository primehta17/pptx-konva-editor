# PPTX Konva Editor (Scaffold)

This is a lightweight React + Vite scaffold that uses **react-konva / Konva** for slide editing.
It provides:
- Upload placeholder for `.pptx` (parsing not implemented in scaffold; placeholder slide created)
- Slide thumbnails rail
- Canvas editor with objects (rect, ellipse, text, image)
- Select / move / resize / rotate with Konva Transformer
- Inline text edit (double-click)
- Save/Load JSON
- Export single slide as PNG

## Run locally

1. Install dependencies:
   ```
   npm install
   ```
2. Start dev server:
   ```
   npm run dev
   ```

## Notes

- This scaffold **does not** parse PPTX files — it provides placeholders and an editor UI to continue development.
- To implement PPTX parsing: use `JSZip` to unzip `.pptx` and parse `ppt/slides/slideN.xml` (OOXML); or use a conversion API to SVG and map elements into the editor model.
