# Desktop App Build Instructions

This project now supports packaging as a desktop application using **Electron**.

## How to build locally

Since Electron requires a graphical environment and platform-specific tools, you must build the desktop version on your own machine.

### 1. Download the code
Download the project ZIP or clone it to your local machine.

### 2. Install dependencies
Open your terminal in the project directory and run:
```bash
npm install
```

### 3. Run in Development Mode (Optional)
To see the app running as a desktop window during development:
```bash
npm run dev
```
*Vite will automatically launch the Electron window.*

### 4. Build the Desktop Package
To package the app into an executable (Windows Portable, Mac DMG, or Linux AppImage):
```bash
npm run electron:build
```
The output files will be located in the `release/` folder.

## Key Configuration Files
- `electron/main.ts`: The main process code (handles window creation and serial permissions).
- `vite.config.ts`: Integrated with `vite-plugin-electron`.
- `package.json`: Contains `electron:build` script and build settings.

## Web Serial in Electron
The `electron/main.cjs` file includes special handlers for `select-serial-port` to ensure the Web Serial API works correctly within the Electron environment.
