export type ProjectTemplateFileMap = Record<string, string>;

function emptyTemplate(projectName: string): ProjectTemplateFileMap {
  return {
    "README.md": `# ${projectName}\n\nCreated with Krivana\n`
  };
}

function reactTemplate(projectName: string): ProjectTemplateFileMap {
  return {
    "package.json": JSON.stringify(
      {
        name: projectName.toLowerCase().replace(/\s+/g, "-"),
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          preview: "vite preview"
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1"
        },
        devDependencies: {
          "@types/react": "^18.3.5",
          "@types/react-dom": "^18.3.0",
          "@vitejs/plugin-react": "^4.3.1",
          typescript: "^5.6.3",
          vite: "^5.4.8"
        }
      },
      null,
      2
    ),
    "vite.config.ts": "import { defineConfig } from \"vite\";\nimport react from \"@vitejs/plugin-react\";\n\nexport default defineConfig({\n  plugins: [react()],\n});\n",
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          allowJs: false,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          module: "ESNext",
          moduleResolution: "Node",
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx"
        },
        include: ["src"]
      },
      null,
      2
    ),
    "index.html": `<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>${projectName}</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.tsx\"></script>\n  </body>\n</html>\n`,
    "src/main.tsx": "import React from \"react\";\nimport ReactDOM from \"react-dom/client\";\nimport App from \"./App\";\nimport \"./index.css\";\n\nReactDOM.createRoot(document.getElementById(\"root\")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n",
    "src/App.tsx": `import \"./App.css\";\n\nexport default function App() {\n  return (\n    <main className=\"app-shell\">\n      <section className=\"card\">\n        <p className=\"eyebrow\">Built with Krivana</p>\n        <h1>${projectName}</h1>\n        <p>Start editing <code>src/App.tsx</code> to shape your app.</p>\n      </section>\n    </main>\n  );\n}\n`,
    "src/App.css": ".app-shell {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 2rem;\n  background: linear-gradient(160deg, #f5efe6 0%, #d5e6f4 100%);\n}\n\n.card {\n  width: min(520px, 100%);\n  padding: 2rem;\n  border-radius: 24px;\n  background: rgba(255, 255, 255, 0.85);\n  box-shadow: 0 24px 60px rgba(36, 53, 77, 0.18);\n}\n\n.eyebrow {\n  text-transform: uppercase;\n  letter-spacing: 0.16em;\n  font-size: 0.75rem;\n  color: #6f6f79;\n}\n",
    "src/index.css": ":root {\n  font-family: \"Segoe UI\", sans-serif;\n  color: #1f2430;\n  background: #f4f7fb;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n}\n"
  };
}

function nextTemplate(projectName: string): ProjectTemplateFileMap {
  return {
    "package.json": JSON.stringify(
      {
        name: projectName.toLowerCase().replace(/\s+/g, "-"),
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start"
        },
        dependencies: {
          next: "^15.0.0",
          react: "^18.3.1",
          "react-dom": "^18.3.1"
        },
        devDependencies: {
          typescript: "^5.6.3",
          "@types/node": "^22.7.5",
          "@types/react": "^18.3.5",
          "@types/react-dom": "^18.3.0"
        }
      },
      null,
      2
    ),
    "next.config.js": "/** @type {import(\"next\").NextConfig} */\nconst nextConfig = {};\n\nexport default nextConfig;\n",
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: false,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"]
      },
      null,
      2
    ),
    "app/layout.tsx": "import \"./globals.css\";\nimport type { ReactNode } from \"react\";\n\nexport default function RootLayout({ children }: { children: ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}\n",
    "app/page.tsx": `export default function HomePage() {\n  return (\n    <main className=\"page\">\n      <div className=\"panel\">\n        <span className=\"kicker\">Krivana starter</span>\n        <h1>${projectName}</h1>\n        <p>Ship your app from this scaffold.</p>\n      </div>\n    </main>\n  );\n}\n`,
    "app/globals.css": ":root {\n  color-scheme: light;\n  font-family: Georgia, \"Times New Roman\", serif;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  background: radial-gradient(circle at top, #f6d7c3, #efe8dd 50%, #d7e4ec);\n}\n\n.page {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 2rem;\n}\n\n.panel {\n  width: min(42rem, 100%);\n  padding: 3rem;\n  border: 1px solid rgba(31, 36, 48, 0.08);\n  background: rgba(255, 255, 255, 0.8);\n  backdrop-filter: blur(16px);\n}\n\n.kicker {\n  display: inline-block;\n  margin-bottom: 0.75rem;\n  letter-spacing: 0.18em;\n  text-transform: uppercase;\n  font-size: 0.75rem;\n}\n"
  };
}

function staticTemplate(projectName: string): ProjectTemplateFileMap {
  return {
    "index.html": `<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>${projectName}</title>\n    <link rel=\"stylesheet\" href=\"./styles.css\" />\n  </head>\n  <body>\n    <main class=\"shell\">\n      <section class=\"hero\">\n        <p class=\"eyebrow\">Krivana project</p>\n        <h1>${projectName}</h1>\n        <p>A clean static starter that is easy to extend.</p>\n        <button id=\"cta\">Click me</button>\n      </section>\n    </main>\n    <script src=\"./script.js\"></script>\n  </body>\n</html>\n`,
    "styles.css": ":root {\n  font-family: \"Trebuchet MS\", sans-serif;\n  color: #122033;\n  background: linear-gradient(135deg, #f5e6d3, #d8eef2);\n}\n\nbody {\n  margin: 0;\n}\n\n.shell {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 2rem;\n}\n\n.hero {\n  width: min(560px, 100%);\n  padding: 2.5rem;\n  border-radius: 28px;\n  background: rgba(255, 255, 255, 0.88);\n  box-shadow: 0 18px 50px rgba(18, 32, 51, 0.12);\n}\n\n.eyebrow {\n  text-transform: uppercase;\n  letter-spacing: 0.16em;\n  font-size: 0.75rem;\n}\n\nbutton {\n  padding: 0.85rem 1.4rem;\n  border: 0;\n  border-radius: 999px;\n  background: #122033;\n  color: white;\n  cursor: pointer;\n}\n",
    "script.js": "document.getElementById(\"cta\")?.addEventListener(\"click\", () => {\n  alert(\"Krivana starter is ready.\");\n});\n"
  };
}

export function getTemplateFiles(projectName: string, techStack?: string | null) {
  switch ((techStack ?? "").toLowerCase()) {
    case "react":
    case "vite":
    case "vite-react":
      return reactTemplate(projectName);
    case "next":
    case "nextjs":
      return nextTemplate(projectName);
    case "html":
    case "static":
    case "vanilla":
      return staticTemplate(projectName);
    default:
      return emptyTemplate(projectName);
  }
}
