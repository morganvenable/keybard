import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { PrintableKeymap } from './PrintableKeymap';
import type { PrintableLayer } from '@/services/print.service';
import type { KeyboardInfo } from '@/types/keyboard.types';

interface PrintEventDetail {
  keyboard: KeyboardInfo;
  layers: PrintableLayer[];
}

/**
 * Wrapper component that listens for print events and renders the PrintableKeymap
 * Uses a portal to render directly into document.body for proper print styling
 */
export const PrintableKeymapWrapper: React.FC = () => {
  const [printData, setPrintData] = useState<PrintEventDetail | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePrintEvent = (event: CustomEvent<PrintEventDetail>) => {
      console.log('Print event received:', event.detail);
      setPrintData(event.detail);
      setIsPrinting(true);
    };

    window.addEventListener('keybard-print', handlePrintEvent as EventListener);

    return () => {
      window.removeEventListener('keybard-print', handlePrintEvent as EventListener);
    };
  }, []);

  // Trigger print when isPrinting becomes true and content is rendered
  useLayoutEffect(() => {
    if (isPrinting && printData && contentRef.current) {
      console.log('Content rendered, triggering print');
      // Use requestAnimationFrame to ensure paint has happened
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
    }
  }, [isPrinting, printData]);

  // Listen for afterprint to clean up
  useEffect(() => {
    const handleAfterPrint = () => {
      console.log('After print, cleaning up');
      setIsPrinting(false);
      setPrintData(null);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  if (!printData) {
    return null;
  }

  // Use a portal to render directly into document.body
  // This ensures the print content is outside the React app tree
  return createPortal(
    <div
      className={`printable-keymap-wrapper ${isPrinting ? 'printing' : ''}`}
      ref={contentRef}
    >
      <PrintableKeymap
        keyboard={printData.keyboard}
        layers={printData.layers}
      />
    </div>,
    document.body
  );
};

export default PrintableKeymapWrapper;
