# PPTX Konva Editor

This React-based slide editor leverages the Konva.js library to create a dynamic canvas for building and editing slides. Users can add text, shapes, and images, and export their creations as PNGs or JSON files. The editor also supports importing slides from PowerPoint files.

🚀 Features

Interactive Canvas: Drag and resize text, shapes, and images.

Slide Management: Add, delete, and navigate through slides.

Text Editing: Double-click to edit text directly on the canvas.

Image Upload: Add images via URLs or file uploads.

Export Options: Save slides as PNG images or export the entire deck as a JSON file.

PPTX Import: Load slides from PowerPoint files.

🧪 Run Locally

Clone the repository:

git clone https://github.com/primehta17/pptx-konva-editor.git
cd pptx-konva-editor


Install dependencies:

npm install


Start the development server:

npm run dev


Open your browser and navigate to:

http://localhost:3000


📦 Deployment

The application is deployed using Vercel. You can access the live demo here:

<!-- 🔗 https://pptx-konva-editor-cnifmko38-primehta17s-projects.vercel.app/ -->
🔗 https://pptx-konva-editor.vercel.app/

📄 Repository

The source code is available on GitHub:

🔗 https://github.com/primehta17/pptx-konva-editor.git

📝 Approach & Considerations

This project utilizes React for the UI and Konva.js for rendering the canvas elements. The useImage hook is employed to load images, and a custom transformer is used to enable resizing and rotating objects.

Trade-offs:

Performance: Handling large PPTX files may lead to performance issues due to parsing overhead.

Cross-Origin Images: Loading images from external URLs may result in CORS issues, affecting image rendering and export functionality.

Future Enhancements:

Image Upload: Implement a file input to allow users to upload pptx images directly from their devices.

Export Formats: Support additional export formats such as PDF or SVG.

Undo/Redo Functionality: Implement undo and redo capabilities for better user experience.

⚠️ Known Issues

Image Upload: Currently, the image upload feature is not functional. This is due to limitations in handling image uploads within the Konva.js framework.

🛠️ Dependencies

react-konva: React bindings for Konva.js.

use-image: React hook for loading images.

jszip: Library for creating and reading ZIP files.

fast-xml-parser: XML parser for JavaScript.
