/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import SerialTool from './components/SerialTool';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';

export default function App() {
  return (
    <TooltipProvider>
      <SerialTool />
      <Toaster position="bottom-right" theme="dark" />
    </TooltipProvider>
  );
}
