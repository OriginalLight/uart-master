/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import SerialTool from './components/SerialTool';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import WindowTitleBar from './components/WindowTitleBar';

export default function App() {
  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        <WindowTitleBar />
        <div className="flex-1 overflow-hidden">
          <SerialTool />
        </div>
      </div>
      <Toaster position="bottom-right" theme="dark" />
    </TooltipProvider>
  );
}
