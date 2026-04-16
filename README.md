# Uart Master

Uart Master is a modern, high-performance web-based serial port terminal designed for developers and hardware engineers. It leverages the Web Serial API to provide a seamless debugging experience directly from your browser, enhanced with AI-powered log analysis.

## 🚀 Key Features

- **Web Serial Integration**: Connect to any serial device directly from the browser (Chrome, Edge, Opera).
- **AI-Powered Analysis**: Integrated Gemini AI to analyze serial logs, identify protocol patterns, and suggest fixes.
- **Dual Data Formats**: Support for both **ASCII** and **HEX** views with real-time switching.
- **Smart RX Grouping**: Intelligent buffering to prevent single commands from being split across multiple lines.
- **Command History**: Quick access to recently sent commands via a dedicated history menu.
- **High-Precision Logging**: Millisecond-accurate timestamps for precise timing analysis.
- **Data Export**: Export your session logs to text files for documentation or further analysis.
- **Responsive Design**: A polished, dark-themed industrial UI optimized for productivity.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **AI Engine**: Google Gemini API (@google/genai)
- **Components**: Radix UI / shadcn/ui

## 📦 Deployment

### Prerequisites

- Node.js (v18 or higher)
- A modern web browser with [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API#browser_compatibility) support.
- A Google Gemini API Key (for AI features).

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd uart-master
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

### Production Build

To create an optimized production build:
```bash
npm run build
```
The static files will be generated in the `dist/` directory.

## 📖 Usage Guide

1. **Connect**: Click the **Connect** button in the top bar and select your serial device from the browser prompt.
2. **Configure**: Use the right sidebar to set Baud Rate, Data Bits, Parity, and Stop Bits.
3. **Monitor**: Watch the **Data Console** for incoming (RX) and outgoing (TX) data.
4. **Analyze**: Click **Start Analysis** in the AI sidebar to let the AI interpret the current logs.
5. **Send**: Type commands in the bottom input box. Use the **History** icon to reuse previous commands.

## 🔒 Security & Privacy

- **Local Processing**: Serial data is processed locally in your browser and is never sent to any server except when you explicitly trigger the "AI Analysis" feature.
- **AI Data**: Only the logs currently visible in the console are sent to the Gemini API for analysis when requested.

---
Developed with ❤️ for the hardware community.
